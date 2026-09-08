import type { Recipe } from "./types";

const INGREDIENT_HEADER =
  /^(ingredients?|what you(?:'|’)ll need|shopping list|you(?:'|’)ll need)\b[:\s-]*$/i;
const STEP_HEADER =
  /^(instructions?|directions?|method|steps?|how to(?: make)?|preparation|prep)\b[:\s-]*$/i;
const SKIP_LINE =
  /^(#\w+|@\w+|follow for more|link in bio|save this|share this|comment|dm me|recipe below|full recipe|ingredients below|let(?:'|’)s (?:cook|make)|watch till end|don(?:'|’)t forget to)/i;
const AMOUNT_START =
  /^(?:\d+\s*[-/]\s*)?\d+(?:[./]\d+)?(?:\s*(?:to|-)\s*\d+(?:[./]\d+)?)?\s*(?:cups?|tbsps?|tbsp|tsps?|tsp|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|l|liters?|litres?|cloves?|slices?|pcs?|pieces?|cans?|packages?|pkg|bunches?|heads?|sticks?|pinches?|dashes?|handfuls?|qt|quarts?|pts?|pints?|gallons?|gal|inches?|cm)?\b/i;
const BULLET = /^[\s]*[-•*▪◦●○◆◇▶️✅✔️☑️➤➔·]+[\s]*/;
const NUMBERED = /^[\s]*\(?\d{1,2}[.)\]:]+\s*/;
const EMOJI_BULLET = /^[\s]*[\p{Emoji_Presentation}\p{Extended_Pictographic}]+\s*/u;

function cleanCaptionLine(line: string): string {
  return line
    .replace(BULLET, "")
    .replace(NUMBERED, "")
    .replace(EMOJI_BULLET, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeIngredient(line: string): boolean {
  if (!line || line.length < 2 || line.length > 180) return false;
  if (SKIP_LINE.test(line)) return false;
  if (STEP_HEADER.test(line) || INGREDIENT_HEADER.test(line)) return false;
  if (AMOUNT_START.test(line)) return true;
  if (/^[A-Za-z].{0,60}$/.test(line) && !/[.!?]$/.test(line) && line.split(" ").length <= 10) {
    // Short noun-ish lines in an ingredients section
    return true;
  }
  return false;
}

function looksLikeStep(line: string): boolean {
  if (!line || line.length < 8) return false;
  if (SKIP_LINE.test(line)) return false;
  if (INGREDIENT_HEADER.test(line) || STEP_HEADER.test(line)) return false;
  if (AMOUNT_START.test(line) && line.split(" ").length <= 8) return false;
  return true;
}

function firstSentenceTitle(text: string, fallback: string): string {
  const cleaned = text
    .replace(/#\w+/g, " ")
    .replace(/@\w+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return fallback;
  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
  const clipped = sentence.length > 80 ? `${sentence.slice(0, 77).trim()}…` : sentence;
  return clipped || fallback;
}

function hostName(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** TikTok captions are often one paragraph: "Ingredients: … Method: …". */
export function expandCaptionForParse(caption: string): string {
  return caption
    .replace(/\r\n/g, "\n")
    .replace(/\u2028|\u2029/g, "\n")
    .replace(
      /(?:^|[ \t])(?:[\p{Emoji_Presentation}\p{Extended_Pictographic}][\uFE0F\u200D]*)*\s*(ingredients?|what you(?:'|’)ll need|shopping list|you(?:'|’)ll need)\s*[:\-–]\s*/giu,
      "\nIngredients:\n",
    )
    .replace(
      /(?:^|[ \t])(?:[\p{Emoji_Presentation}\p{Extended_Pictographic}][\uFE0F\u200D]*)*\s*(instructions?|directions?|method|steps?|how to(?: make)?|prep(?:aration)?)\s*[:\-–]\s*/giu,
      "\nInstructions:\n",
    )
    .replace(/\s+[•●▪◦➤➔·]\s*/g, "\n• ")
    .replace(/\s+(?=\d{1,2}[.)]\s+)/g, "\n");
}

function captionSubstance(text: string): string {
  return text
    .replace(/#\w+/g, " ")
    .replace(/@\w+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Turn a social caption / post text into a structured recipe.
 * Handles common Reel formats: Ingredients:/Instructions: headers,
 * bulleted lists, numbered steps, and amount-led ingredient lines.
 */
export function recipeFromCaption(
  caption: string,
  sourceUrl: string,
  extras?: {
    title?: string | null;
    author?: string | null;
    image?: string | null;
  },
): Recipe {
  const rawLines = expandCaptionForParse(caption)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let mode: "unknown" | "ingredients" | "steps" = "unknown";
  const ingredients: string[] = [];
  const steps: string[] = [];
  const preamble: string[] = [];

  for (const raw of rawLines) {
    const headerOnly = cleanCaptionLine(raw);
    if (INGREDIENT_HEADER.test(raw) || INGREDIENT_HEADER.test(headerOnly)) {
      mode = "ingredients";
      continue;
    }
    if (STEP_HEADER.test(raw) || STEP_HEADER.test(headerOnly)) {
      mode = "steps";
      continue;
    }

    const line = cleanCaptionLine(raw);
    if (!line || SKIP_LINE.test(line)) continue;

    if (mode === "ingredients") {
      if (looksLikeStep(line) && !AMOUNT_START.test(line) && line.split(" ").length > 12) {
        mode = "steps";
        steps.push(line);
      } else if (looksLikeIngredient(line) || AMOUNT_START.test(line)) {
        ingredients.push(line);
      } else if (looksLikeStep(line)) {
        mode = "steps";
        steps.push(line);
      }
      continue;
    }

    if (mode === "steps") {
      if (looksLikeStep(line)) steps.push(line);
      continue;
    }

    // unknown: classify
    if (AMOUNT_START.test(line) || (BULLET.test(raw) && looksLikeIngredient(line))) {
      ingredients.push(line);
      mode = "ingredients";
    } else if (NUMBERED.test(raw) && looksLikeStep(line)) {
      steps.push(line);
      mode = "steps";
    } else {
      preamble.push(line);
    }
  }

  // If we only got preamble + amount lines mixed in preamble path, re-scan
  if (!ingredients.length && !steps.length) {
    for (const raw of rawLines) {
      const line = cleanCaptionLine(raw);
      if (!line || SKIP_LINE.test(line)) continue;
      if (AMOUNT_START.test(line)) ingredients.push(line);
      else if (NUMBERED.test(raw) || looksLikeStep(line)) steps.push(line);
    }
  }

  // Promote long preamble sentences into steps when we have ingredients but no steps
  if (ingredients.length && !steps.length) {
    for (const line of preamble) {
      if (looksLikeStep(line)) steps.push(line);
    }
  }

  // If still no structure, treat non-hashtag lines as steps and amount lines as ingredients
  if (!ingredients.length && !steps.length) {
    const body = rawLines
      .map(cleanCaptionLine)
      .filter((line) => line && !SKIP_LINE.test(line) && !/^#/.test(line));
    for (const line of body) {
      if (AMOUNT_START.test(line)) ingredients.push(line);
      else steps.push(line);
    }
  }

  if (!ingredients.length && !steps.length) {
    throw new Error(
      "Found the post, but couldn't find a recipe in the caption. Copy the ingredients and steps from the caption and paste them instead.",
    );
  }

  // Reject near-empty social captions (title-only videos, hashtag soup, etc.)
  if (
    !ingredients.length &&
    steps.length <= 2 &&
    captionSubstance(steps.join(" ")).length < 80
  ) {
    throw new Error(
      "That post's caption doesn't look like a full recipe. Paste the ingredients and steps from the caption (or comments) instead.",
    );
  }

  const title =
    extras?.title?.trim() ||
    firstSentenceTitle(preamble[0] || caption, "Social recipe");

  return {
    title,
    description: preamble.slice(0, 3).join(" ") || null,
    image: extras?.image ?? null,
    author: extras?.author ?? null,
    sourceUrl,
    sourceName: hostName(sourceUrl),
    yield: null,
    prepTime: null,
    cookTime: null,
    totalTime: null,
    ingredients,
    steps: steps.length ? steps : ["See ingredients — steps weren't listed in the caption."],
  };
}
