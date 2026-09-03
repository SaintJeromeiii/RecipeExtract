import type { Recipe } from "./types.ts";

const JUNK_LINE =
  /^(jump to|pin (this|it)|share this|advertisement|you may also|subscribe|related recipes|print recipe|save recipe|rate this|leave a comment|this post (contains|may contain)|affiliate|as an amazon|shop this|more recipes|don't miss|sign up)/i;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Upgrade-Insecure-Requests": "1",
};

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textOf(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return cleanText(value);
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return textOf(value.find((item) => textOf(item)));
  if (isRecord(value)) {
    return textOf(
      value.text ?? value.name ?? value["@value"] ?? value.description,
    );
  }
  return "";
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  frac14: "¼",
  frac12: "½",
  frac34: "¾",
  frac13: "⅓",
  frac23: "⅔",
  frac18: "⅛",
  frac38: "⅜",
  frac58: "⅝",
  frac78: "⅞",
  deg: "°",
  times: "×",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  trade: "™",
  copy: "©",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&([a-z0-9]+);/gi, (match, name: string) => {
      return NAMED_ENTITIES[name.toLowerCase()] ?? match;
    })
    .replace(/&#(\d+);/g, (_, code: string) => {
      const point = Number(code);
      return Number.isNaN(point) ? "" : String.fromCodePoint(point);
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isNaN(point) ? "" : String.fromCodePoint(point);
    });
}

function cleanText(value: string): string {
  return decodeEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatYield(value: unknown): string | null {
  const raw = textOf(value);
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) return `${raw} servings`;
  return raw;
}

function isJunkLine(line: string): boolean {
  if (!line) return true;
  if (line.length < 2) return true;
  return JUNK_LINE.test(line);
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const cleaned = cleanText(line);
    if (isJunkLine(cleaned)) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function recipeTypes(value: unknown): string[] {
  return asArray(value).map((item) =>
    String(item)
      .toLowerCase()
      .replace(/^https?:\/\/schema\.org\//, ""),
  );
}

function isRecipeNode(node: unknown): boolean {
  if (!isRecord(node)) return false;
  return recipeTypes(node["@type"]).includes("recipe");
}

function findRecipeNode(node: unknown): Record<string, unknown> | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(node)) return null;
  if (isRecipeNode(node)) return node as Record<string, unknown>;
  if (node["@graph"]) return findRecipeNode(node["@graph"]);
  if (node.mainEntity) {
    const found = findRecipeNode(node.mainEntity);
    if (found) return found;
  }
  return null;
}

function flattenInstructions(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") {
    return uniqueLines(
      value
        .split(/\n+|<\/p>|<\/li>|<br\s*\/?>/i)
        .flatMap((chunk) =>
          chunk.split(/(?<=\.)\s+(?=[A-Z])/).map((part) => cleanText(part)),
        ),
    );
  }
  if (Array.isArray(value)) return value.flatMap(flattenInstructions);
  if (!isRecord(value)) return [];

  const types = recipeTypes(value["@type"]);
  if (types.includes("howtosection")) {
    return flattenInstructions(value.itemListElement ?? value.steps);
  }
  if (types.includes("howtostep") || types.includes("howtodirection")) {
    const step = textOf(value.text ?? value.name);
    return step ? [step] : [];
  }
  if (value.itemListElement) return flattenInstructions(value.itemListElement);
  const fallback = textOf(value.text ?? value.name);
  return fallback ? [fallback] : [];
}

function firstImage(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstImage(item);
      if (found) return found;
    }
    return null;
  }
  if (isRecord(value)) {
    return firstImage(value.url ?? value.contentUrl);
  }
  return null;
}

function formatDuration(value: unknown): string | null {
  const raw = textOf(value);
  if (!raw) return null;
  const match = raw.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i,
  );
  if (!match) return raw.replace(/^PT/, "").toLowerCase();
  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0) + days * 24;
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  const parts: string[] = [];
  if (hours) parts.push(`${hours} hr${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} min`);
  if (!parts.length && seconds) parts.push(`${seconds} sec`);
  return parts.join(" ") || null;
}

function hostName(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function absolutize(maybeUrl: string | null, base: string): string | null {
  if (!maybeUrl) return null;
  try {
    return new URL(maybeUrl, base).toString();
  } catch {
    return null;
  }
}

function httpErrorMessage(status: number): string {
  if (status === 404) return "That recipe page was not found. Check the URL.";
  if (status === 401 || status === 403) {
    return "That site blocked the extractor. Try a different recipe URL.";
  }
  return `The site responded with ${status}.`;
}

function fromJsonLd(data: Record<string, unknown>, sourceUrl: string): Recipe {
  const ingredients = uniqueLines(
    asArray(data.recipeIngredient ?? data.ingredients).map(textOf),
  );
  const steps = uniqueLines(flattenInstructions(data.recipeInstructions));
  return {
    title: textOf(data.name) || "Untitled recipe",
    description: textOf(data.description) || null,
    image: firstImage(data.image),
    author: textOf(data.author) || null,
    sourceUrl,
    sourceName: hostName(sourceUrl),
    yield: formatYield(data.recipeYield ?? data.yield),
    prepTime: formatDuration(data.prepTime),
    cookTime: formatDuration(data.cookTime),
    totalTime: formatDuration(data.totalTime),
    ingredients,
    steps,
  };
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function assertSafeUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error("Enter a valid http(s) recipe URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }
  const host = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::1" ||
    host === "[::1]"
  ) {
    throw new Error("That URL is not allowed.");
  }
  const unbracketed = host.replace(/^\[|\]$/g, "");
  if (isPrivateIpv4(unbracketed) || unbracketed === "::1") {
    throw new Error("That URL is not allowed.");
  }
  return parsed;
}

function classRe(className: string): string {
  return `class=["'][^"']*\\b${className}\\b[^"']*["']`;
}

function innersByClass(html: string, className: string): string[] {
  const re = new RegExp(
    `<([a-zA-Z0-9]+)(?=[^>]*${classRe(className)})[^>]*>([\\s\\S]*?)</\\1>`,
    "gi",
  );
  return [...html.matchAll(re)].map((match) => match[2]);
}

function firstMeta(html: string, names: string[]): string {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const propertyFirst = new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
      "i",
    );
    const contentFirst = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`,
      "i",
    );
    const match = html.match(propertyFirst) || html.match(contentFirst);
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}

function firstTagText(html: string, tag: string): string {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? cleanText(match[1]) : "";
}

function attrValues(html: string, attr: string, names: string[]): string[] {
  const values: string[] = [];
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `<[^>]+${attr}=["']${escaped}["'][^>]*(?:content=["']([^"']*)["'])?[^>]*>([\\s\\S]*?)(?:</[^>]+>)?`,
      "gi",
    );
    for (const match of html.matchAll(re)) {
      const text = cleanText(match[1] || match[2] || "");
      if (text) values.push(text);
    }
  }
  return values;
}

function listItemsNearClass(html: string, className: string): string[] {
  const idx = html.search(new RegExp(classRe(className), "i"));
  if (idx < 0) return [];
  const window = html.slice(Math.max(0, idx - 80), idx + 12000);
  return uniqueLines(
    [...window.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((match) => match[1]),
  );
}

function wprmIngredients(html: string): string[] {
  const lines: string[] = [];
  for (const block of innersByClass(html, "wprm-recipe-ingredient")) {
    const amount = cleanText(innersByClass(block, "wprm-recipe-ingredient-amount")[0] || "");
    const unit = cleanText(innersByClass(block, "wprm-recipe-ingredient-unit")[0] || "");
    const name = cleanText(innersByClass(block, "wprm-recipe-ingredient-name")[0] || "");
    const notes = cleanText(innersByClass(block, "wprm-recipe-ingredient-notes")[0] || "");
    const fallback = cleanText(block);
    const composed = [amount, unit, name].filter(Boolean).join(" ");
    const line = composed || fallback;
    const withNotes = notes && composed ? `${composed} (${notes})` : line;
    if (withNotes) lines.push(withNotes);
  }
  return uniqueLines(lines);
}

function collectList(html: string, classNames: string[]): string[] {
  for (const className of classNames) {
    const lines = listItemsNearClass(html, className);
    if (lines.length) return lines;
  }
  return [];
}

function fromHtml(html: string, sourceUrl: string): Recipe {
  const title =
    firstMeta(html, ["og:title"]) ||
    firstTagText(html, "h1") ||
    firstTagText(html, "title") ||
    "Untitled recipe";

  const description =
    firstMeta(html, ["og:description", "description"]) || null;

  const image = firstMeta(html, ["og:image"]) || null;

  const wprm = wprmIngredients(html);
  const ingredients =
    wprm.length > 0
      ? wprm
      : uniqueLines([
          ...attrValues(html, "itemprop", ["recipeIngredient"]),
          ...collectList(html, [
            "tasty-recipes-ingredients",
            "mv-create-ingredients",
            "recipe-ingredients",
            "wprm-recipe-ingredients",
            "ingredients",
          ]),
        ]);

  const steps = uniqueLines([
    ...innersByClass(html, "wprm-recipe-instruction-text").map(cleanText),
    ...attrValues(html, "itemprop", ["recipeInstructions"]),
    ...collectList(html, [
      "tasty-recipes-instructions",
      "mv-create-instructions",
      "recipe-instructions",
      "instructions",
      "prep-steps",
      "directions",
    ]),
  ]);

  const yieldText =
    attrValues(html, "itemprop", ["recipeYield"])[0] ||
    cleanText(innersByClass(html, "wprm-recipe-servings")[0] || "");

  return {
    title,
    description,
    image,
    author: null,
    sourceUrl,
    sourceName: hostName(sourceUrl),
    yield: formatYield(yieldText || null),
    prepTime: null,
    cookTime: null,
    totalTime: null,
    ingredients,
    steps,
  };
}

function parseJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const regex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const raw = match[1]
      .replace(/^\s*<!--/, "")
      .replace(/-->\s*$/, "")
      .trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      try {
        blocks.push(JSON.parse(raw.replace(/[\u0000-\u001F]+/g, " ")));
      } catch {
        // Ignore malformed JSON-LD blocks.
      }
    }
  }
  return blocks;
}

export async function extractRecipe(sourceUrl: string): Promise<Recipe> {
  const url = assertSafeUrl(sourceUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The recipe page took too long to load.");
    }
    throw new Error("Could not reach that URL. Check the address and your connection.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(httpErrorMessage(response.status));
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType && !/html|json|text|xml/i.test(contentType)) {
    throw new Error("That URL does not look like a recipe page.");
  }

  const html = await response.text();
  if (html.length > 2_500_000) {
    throw new Error("That page is too large to extract.");
  }

  let recipe: Recipe | null = null;
  for (const block of parseJsonLdBlocks(html)) {
    const node = findRecipeNode(block);
    if (!node) continue;
    recipe = fromJsonLd(node, url.toString());
    if (recipe.ingredients.length || recipe.steps.length) break;
  }

  if (!recipe || (!recipe.ingredients.length && !recipe.steps.length)) {
    const htmlRecipe = fromHtml(html, url.toString());
    recipe = recipe
      ? {
          ...htmlRecipe,
          title: recipe.title !== "Untitled recipe" ? recipe.title : htmlRecipe.title,
          description: recipe.description || htmlRecipe.description,
          image: recipe.image || htmlRecipe.image,
          ingredients: recipe.ingredients.length
            ? recipe.ingredients
            : htmlRecipe.ingredients,
          steps: recipe.steps.length ? recipe.steps : htmlRecipe.steps,
        }
      : htmlRecipe;
  }

  if (!recipe.ingredients.length && !recipe.steps.length) {
    throw new Error(
      "Couldn't find a recipe on that page. Try a URL that has a recipe card.",
    );
  }

  return {
    ...recipe,
    image: absolutize(recipe.image, url.toString()),
  };
}
