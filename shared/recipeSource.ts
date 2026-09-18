import { socialPlatform } from "./social";
import type { Recipe } from "./types";

export function clippedAgo(iso: string | undefined): string {
  if (!iso) return "Clipped";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "Clipped";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

export function sourceBadge(recipe: Pick<Recipe, "sourceUrl" | "sourceName">): string {
  const platform = socialPlatform(recipe.sourceUrl);
  if (platform === "tiktok") return "TIKTOK";
  if (platform === "instagram") return "INSTAGRAM";
  if (platform === "youtube") return "YOUTUBE";
  if (platform === "facebook") return "FACEBOOK";
  if (recipe.sourceName?.trim()) return recipe.sourceName.trim().toUpperCase();
  try {
    return new URL(recipe.sourceUrl).hostname.replace(/^www\./, "").toUpperCase();
  } catch {
    return "RECIPE";
  }
}

export function canOpenSource(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.replace(/^www\./, "");
    return host !== "pasted.local" && host !== "recipeextract.local";
  } catch {
    return false;
  }
}
