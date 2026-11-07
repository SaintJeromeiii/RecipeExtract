import type { Recipe } from "./types";

const INGREDIENT_HEADER =
  /^(ingredients?|what you(?:'|’)ll need|shopping list|you(?:'|’)ll need)\b[:\s-]*$/i;
const STEP_HEADER =
  /^(instructions?|directions?|method|steps?|how to(?: make)?|preparation|prep)\b[:\s-]*$/i;
const SKIP_LINE =
  /^(#\w+|@\w+|follow for more|link in bio|save this|share this|comment|dm me|recipe below|full recipe|ingredients below|let(?:'|’)s (?:cook|make)|watch till end|don(?:'|’)t forget to|subscribe|like and|original audio|sound\b|music\b|credits?:|created by|recipe by|chef\b)/i;
const NUTRITION_LINE =
  /(?:\bmacros?\b|\bnutrition(?:al)?(?:\s+facts)?\b|\b(?:\d+(?:\.\d+)?\s*(?:g|grams?)\s*(?:of\s+)?(?:protein|carbs?|carbohydrates?|fat|fiber|sugar|sodium))\b|\b(?:protein|carbs?|carbohydrates?|fat|fiber|calories?|kcal)\s*[:\-]?\s*\d|\b\d+\s*(?:kcal|cal(?:ories)?)\b)/i;
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

export function isRecipeJunkLine(line: string): boolean {
  const value = line.trim();
  if (!value) return true;
  if (SKIP_LINE.test(value) || NUTRITION_LINE.test(value)) return true;
  if (/^#\w+(\s+#\w+)*$/.test(value)) return true;
  if (/^[🎵🎶🎤]+/.test(value)) return true;
  const withoutAmount = value.replace(AMOUNT_START, "").trim();
  if (
    /^(protein|carbs?|carbohydrates?|fat|fiber|calories?|kcal|macros?|nutrition)$/i.test(
      withoutAmount,
    )
  ) {
    return true;
  }
  if (/\b(high protein|low calorie|macro friendly|ww points?)\b/i.test(value) && !AMOUNT_START.test(value)) {
    return true;
  }
  return false;
}

function looksLikeIngredient(line: string): boolean {
  if (!line || line.length < 2 || line.length > 180) return false;
  if (isRecipeJunkLine(line)) return false;
  if (STEP_HEADER.test(line) || INGREDIENT_HEADER.test(line)) return false;
  if (AMOUNT_START.test(line) && !isRecipeJunkLine(line.replace(AMOUNT_START, "").trim())) return true;
  if (looksLikeClickbaitTitle(line)) return false;
  if (/^[A-Za-z].{0,60}$/.test(line) && !/[.!?]$/.test(line) && line.split(" ").length <= 8) {
    return true;
  }
  return false;
}

function looksLikeStep(line: string): boolean {
  if (!line || line.length < 8) return false;
  if (isRecipeJunkLine(line)) return false;
  if (INGREDIENT_HEADER.test(line) || STEP_HEADER.test(line)) return false;
  if (AMOUNT_START.test(line) && line.split(" ").length <= 8) return false;
  return true;
}

function looksLikeClickbaitTitle(text: string): boolean {
  const value = text.trim();
  if (!value) return true;
  if (isRecipeJunkLine(value)) return true;
  if (/[|#]/.test(value)) return true;
  if (
    /\b(viral|pov:|wait for it|you won'?t believe|must try|easy dinner idea|link in bio|follow for|watch this)\b/i.test(
      value,
    )
  ) {
    return true;
  }
  return false;
}

function titleCaseIfShouting(text: string): string {
  if (text.length < 12) return text;
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 8) return text;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  if (upper / letters.length < 0.85) return text;
  return text
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

export function sanitizeDishTitle(text: string): string {
  const parts = text
    .replace(/#\w+/g, " ")
    .replace(/@\w+/g, " ")
    .split(/\s*[|•·]\s*|\s+[–—]\s+|:\s+/);
  const kept = parts
    .map((part) =>
      part
        .replace(/\b\d+\s*(?:g|grams?)\s*(?:protein|carbs?|fat|fiber)\b/gi, "")
        .replace(/\b\d+\s*(?:kcal|cal(?:ories)?)\b/gi, "")
        .replace(/\b(high[- ]protein|low[- ]calorie|macro[- ]friendly|must[- ]try|viral|macros?)\b/gi, "")
        .trim(),
    )
    .filter((part) => part && !isRecipeJunkLine(part) && !looksLikeClickbaitTitle(part));
  let value = (kept[0] || "")
    .replace(/\s+/g, " ")
    .trim();
  value = titleCaseIfShouting(value);
  if (!value || isRecipeJunkLine(value) || looksLikeClickbaitTitle(value)) return "";
  if (value.length > 72) value = `${value.slice(0, 69).trim()}…`;
  return value;
}

function sameAsTitle(line: string, title: string): boolean {
  const a = line.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const b = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!a || !b || AMOUNT_START.test(line)) return false;
  if (a === b) return true;
  return a.length > 12 && (a.startsWith(b) || b.startsWith(a));
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

export function sanitizeExtractedRecipe(recipe: Recipe): Recipe {
  const title = sanitizeDishTitle(recipe.title) || recipe.title.trim() || "Social recipe";
  const ingredients = uniqueLines(
    recipe.ingredients
      .map((line) => cleanCaptionLine(line))
      .filter(
        (line) =>
          line &&
          !isRecipeJunkLine(line) &&
          !sameAsTitle(line, title) &&
          (AMOUNT_START.test(line) || !looksLikeClickbaitTitle(line)),
      ),
  );
  const steps = uniqueLines(
    recipe.steps
      .map((line) => cleanCaptionLine(line))
      .filter(
        (line) =>
          line &&
          !isRecipeJunkLine(line) &&
          !sameAsTitle(line, title) &&
          !INGREDIENT_HEADER.test(line) &&
          !STEP_HEADER.test(line),
      ),
  );
  return {
    ...recipe,
    title,
    description:
      recipe.description && !isRecipeJunkLine(recipe.description) && !NUTRITION_LINE.test(recipe.description)
        ? recipe.description
        : null,
    ingredients,
    steps,
  };
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
    if (!line || isRecipeJunkLine(line)) continue;

    if (mode === "ingredients") {
      if (looksLikeStep(line) && !AMOUNT_START.test(line) && line.split(" ").length > 12) {
        mode = "steps";
        steps.push(line);
      } else if (looksLikeIngredient(line)) {
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
    if (looksLikeIngredient(line) && (AMOUNT_START.test(line) || BULLET.test(raw))) {
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
      if (!line || isRecipeJunkLine(line)) continue;
      if (looksLikeIngredient(line) && AMOUNT_START.test(line)) ingredients.push(line);
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
      .filter((line) => line && !isRecipeJunkLine(line) && !/^#/.test(line));
    for (const line of body) {
      if (looksLikeIngredient(line) && AMOUNT_START.test(line)) ingredients.push(line);
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

  const title = pickCaptionTitle(extras?.title, preamble, caption);

  return sanitizeExtractedRecipe({
    title,
    description: preamble.filter((line) => !isRecipeJunkLine(line)).slice(0, 3).join(" ") || null,
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
  });
}

function pickCaptionTitle(
  extrasTitle: string | null | undefined,
  preamble: string[],
  caption: string,
): string {
  const fromPreamble = sanitizeDishTitle(preamble[0] || "");
  const fromCaption = sanitizeDishTitle(firstSentenceTitle(caption, ""));
  const fromVideo = extrasTitle ? sanitizeDishTitle(extrasTitle) : "";
  return fromPreamble || fromCaption || fromVideo || "Social recipe";
}
