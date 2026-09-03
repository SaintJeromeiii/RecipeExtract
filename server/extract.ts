import { extractRecipe as extractHtmlRecipe } from "../shared/extract.ts";
import { recipeFromCaption } from "../shared/captionRecipe.ts";
import { fetchOEmbedCaption, isSocialUrl } from "../shared/social.ts";
import type { Recipe } from "../shared/types.ts";
import { fetchSocialCaptionViaYtDlp } from "./social.ts";

async function refineWithGemini(recipe: Recipe, caption: string): Promise<Recipe> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return recipe;

  const prompt = `Extract a clean cooking recipe as JSON from this social media caption.
Return ONLY JSON with keys: title (string), ingredients (string[]), steps (string[]).
Caption:
${caption.slice(0, 8000)}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      },
    );
    if (!response.ok) return recipe;
    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return recipe;
    const parsed = JSON.parse(match[0]) as {
      title?: string;
      ingredients?: string[];
      steps?: string[];
    };
    return {
      ...recipe,
      title:
        typeof parsed.title === "string" && parsed.title.trim()
          ? parsed.title.trim()
          : recipe.title,
      ingredients: Array.isArray(parsed.ingredients)
        ? parsed.ingredients.filter((item): item is string => typeof item === "string")
        : recipe.ingredients,
      steps: Array.isArray(parsed.steps)
        ? parsed.steps.filter((item): item is string => typeof item === "string")
        : recipe.steps,
    };
  } catch {
    return recipe;
  }
}

export async function extractRecipe(sourceUrl: string): Promise<Recipe> {
  if (isSocialUrl(sourceUrl)) {
    const recipe = await (async () => {
      try {
        return await (async () => {
          const caption = await fetchSocialCaptionViaYtDlp(sourceUrl);
          const base = recipeFromCaption(caption.caption, sourceUrl, {
            title: caption.title,
            author: caption.author,
            image: caption.image,
          });
          return refineWithGemini(base, caption.caption);
        })();
      } catch (ytError) {
        try {
          const oembed = await fetchOEmbedCaption(sourceUrl);
          if (!oembed?.caption) throw ytError;
          const base = recipeFromCaption(oembed.caption, sourceUrl, {
            title: oembed.title,
            author: oembed.author,
            image: oembed.image,
          });
          return refineWithGemini(base, oembed.caption);
        } catch {
          throw ytError;
        }
      }
    })();
    return recipe;
  }

  return extractHtmlRecipe(sourceUrl);
}

export async function extractRecipeFromText(
  text: string,
  sourceUrl = "https://pasted.local/caption",
): Promise<Recipe> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Paste the recipe caption text to continue.");
  }
  const base = recipeFromCaption(trimmed, sourceUrl);
  return refineWithGemini(base, trimmed);
}
