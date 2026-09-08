type Bucket = { hits: number[] };

const perIp = new Map<string, Bucket>();
let inFlight = 0;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const MAX_PER_MINUTE = 8;
const MAX_PER_HOUR = 40;
const MAX_IN_FLIGHT = 3;

function prune(bucket: Bucket, now: number): void {
  bucket.hits = bucket.hits.filter((time) => now - time < HOUR_MS);
}

export function clientIp(req: { headers: Record<string, unknown>; ip?: string; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(",")[0]?.trim() || "unknown";
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function headerValue(
  headers: Record<string, unknown>,
  name: string,
): string {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && raw[0]) return String(raw[0]).trim();
  return "";
}

export function unlimitedKeys(): string[] {
  return (process.env.EXTRACT_UNLIMITED_KEYS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function hasUnlimitedAccess(req: {
  headers: Record<string, unknown>;
  ip?: string;
  socket?: { remoteAddress?: string };
}): boolean {
  const offered = headerValue(req.headers, "x-recipeguru-key");
  if (offered && unlimitedKeys().includes(offered)) return true;
  const ip = clientIp(req);
  const ips = (process.env.EXTRACT_UNLIMITED_IPS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return Boolean(ip && ips.includes(ip));
}

export function checkExtractLimit(ip: string): string | null {
  const now = Date.now();
  const bucket = perIp.get(ip) ?? { hits: [] };
  prune(bucket, now);
  const lastMinute = bucket.hits.filter((time) => now - time < MINUTE_MS).length;
  if (lastMinute >= MAX_PER_MINUTE) {
    return "You're clipping too quickly. Wait a minute, or paste the caption instead.";
  }
  if (bucket.hits.length >= MAX_PER_HOUR) {
    return "This device has hit the hourly clip limit. Paste the caption, or try again later.";
  }
  if (inFlight >= MAX_IN_FLIGHT) {
    return "RecipeGuru is busy reading other posts. Try again in a moment, or paste the caption.";
  }
  bucket.hits.push(now);
  perIp.set(ip, bucket);
  return null;
}

export async function withExtractSlot<T>(work: () => Promise<T>): Promise<T> {
  inFlight += 1;
  try {
    return await work();
  } finally {
    inFlight -= 1;
  }
}
