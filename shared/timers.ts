import type { TimerMatch } from "./types";

const RANGE =
  /(\d+(?:\.\d+)?)\s*(?:to|-|–|—)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|minutes?|mins?|min|seconds?|secs?|sec)\b/gi;
const SINGLE =
  /(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|minutes?|mins?|min|seconds?|secs?|sec)\b/gi;

function toSeconds(value: number, unit: string): number {
  const key = unit.toLowerCase();
  if (key.startsWith("hour") || key.startsWith("hr")) return Math.round(value * 3600);
  if (key.startsWith("sec")) return Math.round(value);
  return Math.round(value * 60);
}

export function findTimers(text: string): TimerMatch[] {
  const found: TimerMatch[] = [];

  for (const match of text.matchAll(RANGE)) {
    if (match.index == null) continue;
    const seconds = toSeconds(Number(match[1]), match[3]);
    if (seconds < 5) continue;
    found.push({
      start: match.index,
      end: match.index + match[0].length,
      seconds,
      label: match[0],
    });
  }

  for (const match of text.matchAll(SINGLE)) {
    if (match.index == null) continue;
    if (found.some((item) => match.index! >= item.start && match.index! < item.end)) {
      continue;
    }
    const seconds = toSeconds(Number(match[1]), match[2]);
    if (seconds < 5) continue;
    found.push({
      start: match.index,
      end: match.index + match[0].length,
      seconds,
      label: match[0],
    });
  }

  return found.sort((a, b) => a.start - b.start);
}

export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
