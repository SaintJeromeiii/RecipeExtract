import type { Recipe } from "./types";

export function recipeAsText(recipe: Recipe, extras?: { notes?: string; tags?: string[] }): string {
  const lines = [
    recipe.title,
    recipe.sourceUrl,
    recipe.yield ? `Yield: ${recipe.yield}` : "",
    recipe.totalTime ? `Time: ${recipe.totalTime}` : "",
    extras?.tags?.length ? `Tags: ${extras.tags.join(", ")}` : "",
    "",
    "Ingredients",
    ...recipe.ingredients.map((item) => `• ${item}`),
    "",
    "Steps",
    ...recipe.steps.map((step, index) => `${index + 1}. ${step}`),
    extras?.notes ? `\nNotes\n${extras.notes}` : "",
  ];
  return lines.filter((line) => line !== "").join("\n");
}

export function recipeAsHtml(recipe: Recipe): string {
  const ingredients = recipe.ingredients
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const steps = recipe.steps
    .map((step, index) => `<li><strong>${index + 1}.</strong> ${escapeHtml(step)}</li>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(recipe.title)}</title>
  <style>body{font-family:Georgia,serif;padding:24px;color:#1a1209}h1{font-size:28px}li{margin:8px 0}</style>
  </head><body>
  <h1>${escapeHtml(recipe.title)}</h1>
  <p>${escapeHtml(recipe.sourceUrl)}</p>
  ${recipe.yield ? `<p>Yield: ${escapeHtml(recipe.yield)}</p>` : ""}
  <h2>Ingredients</h2><ul>${ingredients}</ul>
  <h2>Steps</h2><ol>${steps}</ol>
  </body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
