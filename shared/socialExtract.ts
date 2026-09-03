import { recipeFromCaption } from "./captionRecipe";
import { fetchOEmbedCaption, isSocialUrl, socialPlatform } from "./social";
import type { Recipe } from "./types";

export { isSocialUrl, socialPlatform } from "./social";
export { recipeFromCaption } from "./captionRecipe";

type CaptionProvider = (url: string) => Promise<{
  caption: string;
  title?: string | null;
  author?: string | null;
  image?: string | null;
} | null>;

/**
 * Extract a recipe from a social URL using caption providers (oEmbed, yt-dlp, etc.).
 */
export async function extractSocialRecipe(
  sourceUrl: string,
  providers: CaptionProvider[] = [fetchOEmbedCaption],
): Promise<Recipe> {
  if (!isSocialUrl(sourceUrl)) {
    throw new Error("Not a social media URL.");
  }

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const result = await provider(sourceUrl);
      if (!result?.caption?.trim()) continue;
      return recipeFromCaption(result.caption, sourceUrl, {
        title: result.title,
        author: result.author,
        image: result.image,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const platform = socialPlatform(sourceUrl);
  const hint =
    platform === "facebook"
      ? "Facebook Reels need the recipe extractor service (or paste the caption text)."
      : "Couldn't read a recipe from that post. Paste the caption text instead.";
  throw new Error(errors[0] ? `${hint} ${errors[0]}` : hint);
}
