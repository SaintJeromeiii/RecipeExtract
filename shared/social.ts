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

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/** Pull the first http(s) URL out of TikTok/Instagram share-sheet text. */
export function firstHttpUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"'{}|\\^[`\]]+/i);
  if (!match) return null;
  const candidate = match[0].replace(/[),.;!?»«]+$/g, "");
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeSourceUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  try {
    return new URL(trimmed).toString();
  } catch {
    return firstHttpUrl(trimmed) || trimmed;
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(normalizeSourceUrl(url)).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function socialPlatform(url: string): SocialPlatform | null {
  const host = hostOf(url);
  if (!host) return null;
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
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
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

export function isTikTokWatchUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeSourceUrl(url));
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "tiktok.com" && !host.endsWith(".tiktok.com")) return false;
    return /\/(video|photo)\/\d+/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function isTikTokShortUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeSourceUrl(url));
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "tiktok.com" && !host.endsWith(".tiktok.com")) return false;
    if (host === "vm.tiktok.com" || host === "vt.tiktok.com") return true;
    return /^\/t\//i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function stripTracking(url: string): string {
  try {
    const parsed = new URL(url);
    if (socialPlatform(parsed.toString()) === "tiktok") {
      if (parsed.hostname.toLowerCase() === "m.tiktok.com") {
        parsed.hostname = "www.tiktok.com";
      }
      parsed.search = "";
      parsed.hash = "";
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Follow vm/vt/t short links to the canonical @user/video/ID URL. */
export async function resolveSocialUrl(url: string): Promise<string> {
  const start = stripTracking(normalizeSourceUrl(url));
  if (!isTikTokShortUrl(start)) return start;

  try {
    const response = await fetchWithTimeout(
      start,
      {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
      },
      8000,
    );
    const finalUrl = stripTracking(response.url || start);
    try {
      await response.body?.cancel();
    } catch {
      // React Native / older fetch may not expose body.cancel.
    }
    if (isTikTokWatchUrl(finalUrl)) return finalUrl;
    return start;
  } catch {
    return start;
  }
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": BROWSER_UA,
        },
      },
      12000,
    );
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

function captionFromOEmbedHtml(html: string): string {
  const paragraph = html.match(/<p>([\s\S]*?)<\/p>/i);
  if (!paragraph) return "";
  return paragraph[1]
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function metaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const named = html.match(
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
  );
  if (named?.[1]) return named[1];
  const reversed = html.match(
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`,
      "i",
    ),
  );
  return reversed?.[1] ?? null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const point = Number(code);
      return Number.isNaN(point) ? "" : String.fromCodePoint(point);
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isNaN(point) ? "" : String.fromCodePoint(point);
    });
}

function descFromTikTokJson(value: unknown, depth = 0): string | null {
  if (depth > 10 || value == null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = descFromTikTokJson(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const nested =
    rec["__DEFAULT_SCOPE__"] && typeof rec["__DEFAULT_SCOPE__"] === "object"
      ? (rec["__DEFAULT_SCOPE__"] as Record<string, unknown>)["webapp.video-detail"]
      : rec["webapp.video-detail"];
  if (nested && typeof nested === "object") {
    const item = nested as Record<string, unknown>;
    const info = item.itemInfo;
    if (info && typeof info === "object") {
      const struct = (info as Record<string, unknown>).itemStruct;
      if (struct && typeof struct === "object") {
        const desc = (struct as Record<string, unknown>).desc;
        if (typeof desc === "string" && desc.trim()) return desc.trim();
      }
    }
  }
  if (typeof rec.desc === "string" && rec.desc.trim() && (rec.video || rec.author || rec.id)) {
    return rec.desc.trim();
  }
  for (const child of Object.values(rec)) {
    const found = descFromTikTokJson(child, depth + 1);
    if (found) return found;
  }
  return null;
}

function captionFromTikTokHtml(html: string): {
  caption: string | null;
  canonical: string | null;
  image: string | null;
} {
  let caption: string | null = null;
  for (const id of ["__UNIVERSAL_DATA_FOR_REHYDRATION__", "SIGI_STATE"]) {
    const block = html.match(
      new RegExp(`<script[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)</script>`, "i"),
    );
    if (!block?.[1]) continue;
    try {
      caption = descFromTikTokJson(JSON.parse(block[1]));
      if (caption) break;
    } catch {
      // Ignore malformed embedded JSON.
    }
  }
  if (!caption) {
    const og = metaContent(html, "og:description");
    caption = og ? decodeHtmlEntities(og).trim() : null;
  }
  return {
    caption,
    canonical: metaContent(html, "og:url"),
    image: metaContent(html, "og:image"),
  };
}

/** Public oEmbed where available (TikTok / YouTube). Caption quality varies. */
export async function fetchOEmbedCaption(url: string): Promise<SocialCaption | null> {
  const platform = socialPlatform(url);
  if (!platform) return null;

  if (platform === "tiktok") {
    const resolved = await resolveSocialUrl(url);
    const data = asRecord(
      await fetchJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(resolved)}`),
    );
    const title = typeof data?.title === "string" ? data.title.trim() : "";
    const htmlCaption =
      typeof data?.html === "string" ? captionFromOEmbedHtml(data.html) : "";
    const caption = htmlCaption.length > title.length ? htmlCaption : title;
    if (!caption) return null;
    return {
      platform,
      caption,
      title: title.split("\n")[0]?.slice(0, 80) || caption.slice(0, 80),
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

/** Scrape caption / og:description from a TikTok watch page. */
export async function fetchTikTokPageCaption(url: string): Promise<SocialCaption | null> {
  if (socialPlatform(url) !== "tiktok") return null;
  const resolved = await resolveSocialUrl(url);
  try {
    const response = await fetchWithTimeout(
      resolved,
      {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
      12000,
    );
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 1_500_000);
    const parsed = captionFromTikTokHtml(html);
    if (!parsed.caption) return null;
    return {
      platform: "tiktok",
      caption: parsed.caption,
      title: parsed.caption.split("\n")[0]?.slice(0, 80) || parsed.caption.slice(0, 80),
      author: null,
      image: parsed.image,
    };
  } catch {
    return null;
  }
}
