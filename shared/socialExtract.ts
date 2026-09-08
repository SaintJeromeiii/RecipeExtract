import { recipeFromCaption } from "./captionRecipe";
import {
  fetchOEmbedCaption,
  fetchTikTokPageCaption,
  isSocialUrl,
  normalizeSourceUrl,
  socialPlatform,
} from "./social";
import type { Recipe } from "./types";

export { isSocialUrl, normalizeSourceUrl, socialPlatform } from "./social";
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
  providers: CaptionProvider[] = [fetchOEmbedCaption, fetchTikTokPageCaption],
): Promise<Recipe> {
  const url = normalizeSourceUrl(sourceUrl);
  if (!isSocialUrl(url)) {
    throw new Error("Not a social media URL.");
  }

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const result = await provider(url);
      if (!result?.caption?.trim()) continue;
      return recipeFromCaption(result.caption, url, {
        title: result.title,
        author: result.author,
        image: result.image,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const platform = socialPlatform(url);
  const hint =
    platform === "tiktok"
      ? "Couldn't read a recipe from that TikTok. Paste the caption (ingredients and steps) instead."
      : platform === "facebook"
        ? "Facebook Reels need the recipe extractor service (or paste the caption text)."
        : "Couldn't read a recipe from that post. Paste the caption text instead.";
  throw new Error(errors[0] ? `${hint} ${errors[0]}` : hint);
}
