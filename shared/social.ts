export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "twitter"
  | "other";

export type SocialCaption = {
  platform: SocialPlatform;
  caption: string;
  title?: string | null;
  author?: string | null;
  image?: string | null;
};

export function socialPlatform(url: string): SocialPlatform | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  if (
    host === "facebook.com" ||
    host === "m.facebook.com" ||
    host === "fb.watch" ||
    host === "fb.com" ||
    host.endsWith(".facebook.com")
  ) {
    return "facebook";
  }
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com") || host === "vm.tiktok.com") {
    return "tiktok";
  }
  if (host === "youtube.com" || host === "youtu.be" || host.endsWith(".youtube.com")) {
    return "youtube";
  }
  if (host === "x.com" || host === "twitter.com" || host.endsWith(".twitter.com")) {
    return "twitter";
  }
  return null;
}

export function isSocialUrl(url: string): boolean {
  return socialPlatform(url) != null;
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Public oEmbed where available (TikTok / YouTube). Caption quality varies. */
export async function fetchOEmbedCaption(url: string): Promise<SocialCaption | null> {
  const platform = socialPlatform(url);
  if (!platform) return null;

  if (platform === "tiktok") {
    const data = asRecord(
      await fetchJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`),
    );
    const title = typeof data?.title === "string" ? data.title.trim() : "";
    if (!title) return null;
    return {
      platform,
      caption: title,
      title: title.split("\n")[0]?.slice(0, 80) || title.slice(0, 80),
      author: typeof data?.author_name === "string" ? data.author_name : null,
      image: typeof data?.thumbnail_url === "string" ? data.thumbnail_url : null,
    };
  }

  if (platform === "youtube") {
    const data = asRecord(
      await fetchJson(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      ),
    );
    const title = typeof data?.title === "string" ? data.title.trim() : "";
    if (!title) return null;
    // oEmbed title alone is weak for recipes — still return so yt-dlp / AI can enrich
    return {
      platform,
      caption: title,
      title,
      author: typeof data?.author_name === "string" ? data.author_name : null,
      image: typeof data?.thumbnail_url === "string" ? data.thumbnail_url : null,
    };
  }

  return null;
}
