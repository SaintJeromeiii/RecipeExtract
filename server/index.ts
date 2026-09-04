import express from "express";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractRecipe, extractRecipeFromText } from "./extract.ts";
import { isGroceryCategory } from "../shared/groceryCategories.ts";
import {
  addGroceryLines,
  clearCheckedGrocery,
  listGrocery,
  listRecipes,
  removeGroceryItem,
  removeRecipe,
  saveRecipe,
  setGroceryCategory,
  setGroceryChecked,
  updateRecipe,
} from "./store.ts";

const app = express();
const port = Number(process.env.PORT || 8787);
const dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(dirname, "../dist");

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/extract", async (req, res) => {
  const url = typeof req.body?.url === "string" ? req.body.url : "";
  if (!url.trim()) {
    res.status(400).json({ error: "Paste a recipe URL to get started." });
    return;
  }

  try {
    const recipe = await extractRecipe(url);
    res.json(recipe);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not extract that recipe.";
    const status = message.includes("not allowed") ? 400 : 422;
    res.status(status).json({ error: message });
  }
});

app.post("/api/extract-text", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const sourceUrl =
    typeof req.body?.sourceUrl === "string" && req.body.sourceUrl.trim()
      ? req.body.sourceUrl.trim()
      : "https://pasted.local/caption";
  if (!text.trim()) {
    res.status(400).json({ error: "Paste the recipe caption text to continue." });
    return;
  }
  try {
    const recipe = await extractRecipeFromText(text, sourceUrl);
    res.json(recipe);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not parse that caption.";
    res.status(422).json({ error: message });
  }
});

app.get("/api/recipes", async (_req, res) => {
  const recipes = await listRecipes();
  res.json({ recipes });
});

app.post("/api/recipes", async (req, res) => {
  try {
    const recipe = await saveRecipe(req.body);
    res.status(201).json(recipe);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save that recipe.";
    res.status(400).json({ error: message });
  }
});

app.patch("/api/recipes/:id", async (req, res) => {
  try {
    const recipe = await updateRecipe(String(req.params.id), req.body ?? {});
    res.json(recipe);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update that recipe.";
    res.status(404).json({ error: message });
  }
});

app.delete("/api/recipes/:id", async (req, res) => {
  try {
    await removeRecipe(String(req.params.id));
    res.status(204).end();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not remove that recipe.";
    res.status(404).json({ error: message });
  }
});

app.get("/api/grocery", async (_req, res) => {
  res.json({ items: await listGrocery() });
});

app.post("/api/grocery", async (req, res) => {
  const ingredients = Array.isArray(req.body?.ingredients)
    ? req.body.ingredients.filter((item: unknown): item is string => typeof item === "string")
    : [];
  if (!ingredients.length) {
    res.status(400).json({ error: "Send ingredients to add." });
    return;
  }
  const items = await addGroceryLines({
    ingredients,
    recipeId: typeof req.body?.recipeId === "string" ? req.body.recipeId : undefined,
    recipeTitle:
      typeof req.body?.recipeTitle === "string" ? req.body.recipeTitle : undefined,
  });
  res.status(201).json({ items });
});

app.patch("/api/grocery/:id", async (req, res) => {
  const checked = typeof req.body?.checked === "boolean" ? req.body.checked : undefined;
  const category = isGroceryCategory(req.body?.category) ? req.body.category : undefined;
  if (checked === undefined && category === undefined) {
    res.status(400).json({ error: "Send checked or a grocery category." });
    return;
  }
  try {
    let item;
    if (checked !== undefined) {
      item = await setGroceryChecked(String(req.params.id), checked);
    }
    if (category !== undefined) {
      item = await setGroceryCategory(String(req.params.id), category);
    }
    res.json(item);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update that item.";
    res.status(404).json({ error: message });
  }
});

app.delete("/api/grocery/checked", async (_req, res) => {
  const items = await clearCheckedGrocery();
  res.json({ items });
});

app.delete("/api/grocery/:id", async (req, res) => {
  await removeGroceryItem(String(req.params.id));
  res.status(204).end();
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(distDir));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

function lanAddresses(): string[] {
  const addresses: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        addresses.push(addr.address);
      }
    }
  }
  return addresses;
}

app.listen(port, "0.0.0.0", () => {
  console.log(`RecipeGuru API on http://127.0.0.1:${port}`);
  for (const address of lanAddresses()) {
    console.log(`Phone / Expo:     http://${address}:${port}`);
  }
});
