import { assertSafeUrl, extractRecipe as extractHtmlRecipe } from "../shared/extract.ts";
import { recipeFromCaption } from "../shared/captionRecipe.ts";
import { CAPTION_FALLBACK, recipeLooksEmpty } from "../shared/recipeQuality.ts";
import {
  fetchOEmbedCaption,
  fetchTikTokPageCaption,
  isSocialUrl,
  normalizeSourceUrl,
  resolveSocialUrl,
  socialPlatform,
  type SocialCaption,
  type SocialPlatform,
} from "../shared/social.ts";
import type { Recipe } from "../shared/types.ts";
import { fetchSocialCaptionViaYtDlp } from "./social.ts";

function emptyRecipe(sourceUrl: string, extras?: SocialCaption): Recipe {
  let sourceName: string | null = null;
  try {
    sourceName = new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    sourceName = socialPlatform(sourceUrl);
  }
  return {
    title: extras?.title?.trim() || "Social recipe",
    description: null,
    image: extras?.image ?? null,
    author: extras?.author ?? null,
    sourceUrl,
    sourceName,
    yield: null,
    prepTime: null,
    cookTime: null,
    totalTime: null,
    ingredients: [],
    steps: [],
  };
}

async function refineWithGemini(recipe: Recipe, caption: string): Promise<Recipe> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return recipe;

  const prompt = `Extract a clean cooking recipe as JSON from this social media caption.
Return ONLY JSON with keys: title (string), ingredients (string[]), steps (string[]).
If the caption is not a recipe, return empty arrays for ingredients and steps.
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
    const ingredients = Array.isArray(parsed.ingredients) && parsed.ingredients.length
      ? parsed.ingredients.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : recipe.ingredients;
    const steps = Array.isArray(parsed.steps) && parsed.steps.length
      ? parsed.steps.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : recipe.steps;
    return {
      ...recipe,
      title:
        typeof parsed.title === "string" && parsed.title.trim()
          ? parsed.title.trim()
          : recipe.title,
      ingredients,
      steps,
    };
  } catch {
    return recipe;
  }
}

function tidySocialError(error: unknown, platform: SocialPlatform | null): Error {
  if (error instanceof Error) {
    const message = error.message;
    if (
      message.startsWith("ERROR:") ||
      message.includes("yt-dlp") ||
      message.includes("Unexpected response") ||
      message.includes("Unsupported URL")
    ) {
      if (platform === "tiktok") {
        return new Error(
          "Couldn't read that TikTok. Make sure the video is public, or paste the caption (ingredients and steps) instead.",
        );
      }
      return new Error(
        "Couldn't read that social video. Make sure the post is public, or paste the caption instead.",
      );
    }
    return error;
  }
  return new Error("Couldn't read that social post.");
}

async function fetchSocialCaption(url: string): Promise<SocialCaption> {
  const platform = socialPlatform(url) ?? "other";

  if (platform === "tiktok") {
    const oembed = await fetchOEmbedCaption(url);
    if (oembed?.caption?.trim()) return oembed;
    const page = await fetchTikTokPageCaption(url);
    if (page?.caption?.trim()) return page;
    try {
      return await fetchSocialCaptionViaYtDlp(url);
    } catch (error) {
      throw tidySocialError(error, platform);
    }
  }

  try {
    return await fetchSocialCaptionViaYtDlp(url);
  } catch (ytError) {
    const oembed = await fetchOEmbedCaption(url);
    if (oembed?.caption?.trim()) return oembed;
    throw tidySocialError(ytError, platform);
  }
}

async function recipeFromSocialCaption(
  caption: SocialCaption,
  sourceUrl: string,
): Promise<Recipe> {
  try {
    const base = recipeFromCaption(caption.caption, sourceUrl, {
      title: caption.title,
      author: caption.author,
      image: caption.image,
    });
    return refineWithGemini(base, caption.caption);
  } catch (parseError) {
    const draft = await refineWithGemini(emptyRecipe(sourceUrl, caption), caption.caption);
    if (draft.ingredients.length || draft.steps.length > 1) {
      return draft;
    }
    throw parseError;
  }
}

function requireUsableRecipe(recipe: Recipe): Recipe {
  if (recipeLooksEmpty(recipe)) {
    throw new Error(CAPTION_FALLBACK);
  }
  return recipe;
}

export async function extractRecipe(sourceUrl: string): Promise<Recipe> {
  const url = normalizeSourceUrl(assertSafeUrl(sourceUrl).toString());
  if (isSocialUrl(url)) {
    const canonical =
      socialPlatform(url) === "tiktok" ? await resolveSocialUrl(url) : url;
    const caption = await fetchSocialCaption(canonical);
    return requireUsableRecipe(await recipeFromSocialCaption(caption, canonical));
  }

  return requireUsableRecipe(await extractHtmlRecipe(url));
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
  return requireUsableRecipe(await refineWithGemini(base, trimmed));
}
