import { spawn } from "node:child_process";
import type { SocialCaption, SocialPlatform } from "../shared/social.ts";
import { socialPlatform } from "../shared/social.ts";

type YtDlpInfo = {
  title?: string;
  description?: string;
  fulltitle?: string;
  uploader?: string;
  channel?: string;
  creator?: string;
  thumbnail?: string;
  thumbnails?: Array<{ url?: string }>;
};

function runYtDlp(url: string): Promise<YtDlpInfo> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "yt-dlp",
      [
        "--dump-single-json",
        "--no-download",
        "--no-warnings",
        "--skip-download",
        "--no-playlist",
        "--socket-timeout",
        "15",
        "--retries",
        "2",
        "--user-agent",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "--referer",
        "https://www.tiktok.com/",
        url,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Timed out reading that social video."));
    }, 25000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(
        error.message.includes("ENOENT")
          ? new Error("yt-dlp is not installed on the server.")
          : error,
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() ||
              "Couldn't read that social video. Make sure the Reel is public.",
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout) as YtDlpInfo);
      } catch {
        reject(new Error("Couldn't parse social video metadata."));
      }
    });
  });
}

function pickImage(info: YtDlpInfo): string | null {
  if (typeof info.thumbnail === "string" && info.thumbnail) return info.thumbnail;
  const thumbs = info.thumbnails ?? [];
  for (let i = thumbs.length - 1; i >= 0; i--) {
    const url = thumbs[i]?.url;
    if (url) return url;
  }
  return null;
}

export async function fetchSocialCaptionViaYtDlp(
  url: string,
): Promise<SocialCaption> {
  const platform: SocialPlatform = socialPlatform(url) ?? "other";
  const info = await runYtDlp(url);
  const description = (info.description || "").trim();
  const title = (info.title || info.fulltitle || "").trim();
  const caption = description || title;
  if (!caption) {
    throw new Error(
      "That video has no caption we could read. Copy the recipe text from the post and paste it in.",
    );
  }
  return {
    platform,
    caption,
    title: title || null,
    author: info.uploader || info.channel || info.creator || null,
    image: pickImage(info),
  };
}
