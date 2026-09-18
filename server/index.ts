import express from "express";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractRecipe, extractRecipeFromText } from "./extract.ts";
import { checkExtractLimit, clientIp, hasUnlimitedAccess, withExtractSlot } from "./limit.ts";
import { isGroceryCategory } from "../shared/groceryCategories.ts";
import {
  addGroceryLines,
  addWeeklyMeal,
  clearAllGrocery,
  clearCheckedGrocery,
  clearWeekly,
  listGrocery,
  listRecipes,
  listWeekly,
  removeGroceryItem,
  removeRecipe,
  removeWeeklyMeal,
  saveRecipe,
  setAllGroceryChecked,
  setGroceryCategory,
  setGroceryCategoryOrder,
  setGroceryChecked,
  updateRecipe,
  updateWeeklyMeal,
} from "./store.ts";
import { isWeekday } from "../shared/weekly.ts";

const app = express();
const port = Number(process.env.PORT || 8787);
const dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(dirname, "../dist");

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-RecipeGuru-Key");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
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

function sendPublicPage(res: express.Response, fileName: string) {
  const fromDist = path.join(distDir, fileName);
  const fromPublic = path.resolve(dirname, "../public", fileName);
  res.sendFile(process.env.NODE_ENV === "production" ? fromDist : fromPublic);
}

app.get("/privacy", (_req, res) => {
  sendPublicPage(res, "privacy.html");
});
app.get("/privacy.html", (_req, res) => {
  sendPublicPage(res, "privacy.html");
});
app.get("/testers", (_req, res) => {
  sendPublicPage(res, "testers.html");
});
app.get("/testers.html", (_req, res) => {
  sendPublicPage(res, "testers.html");
});

function sendExtractError(res: express.Response, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = message.includes("not allowed")
    ? 400
    : message.includes("clip limit") || message.includes("too quickly") || message.includes("busy reading")
      ? 429
      : 422;
  res.status(status).json({ error: message });
}

app.post("/api/extract", async (req, res) => {
  const url = typeof req.body?.url === "string" ? req.body.url : "";
  if (!url.trim()) {
    res.status(400).json({ error: "Paste a recipe URL to get started." });
    return;
  }

  if (!hasUnlimitedAccess(req)) {
    const limited = checkExtractLimit(clientIp(req));
    if (limited) {
      res.status(429).json({ error: limited });
      return;
    }
  }

  try {
    const recipe = await withExtractSlot(() => extractRecipe(url));
    res.json(recipe);
  } catch (error) {
    sendExtractError(res, error, "Could not extract that recipe.");
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
  if (!hasUnlimitedAccess(req)) {
    const limited = checkExtractLimit(clientIp(req));
    if (limited) {
      res.status(429).json({ error: limited });
      return;
    }
  }
  try {
    const recipe = await withExtractSlot(() => extractRecipeFromText(text, sourceUrl));
    res.json(recipe);
  } catch (error) {
    sendExtractError(res, error, "Could not parse that caption.");
  }
});

if (process.env.NODE_ENV === "production") {
  const closed = (_req: express.Request, res: express.Response) => {
    res.status(410).json({
      error: "Saved recipes stay on your device now. Use the Pluck app or this page in the same browser.",
    });
  };
  app.use("/api/recipes", closed);
  app.use("/api/weekly", closed);
  app.use("/api/grocery", closed);
}

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

app.get("/api/weekly", async (_req, res) => {
  res.json({ meals: await listWeekly() });
});

app.post("/api/weekly", async (req, res) => {
  try {
    const result = await addWeeklyMeal({
      title: typeof req.body?.title === "string" ? req.body.title : undefined,
      recipeId: typeof req.body?.recipeId === "string" ? req.body.recipeId : undefined,
      ingredients: Array.isArray(req.body?.ingredients)
        ? req.body.ingredients.filter((item: unknown): item is string => typeof item === "string")
        : undefined,
      weekday: isWeekday(req.body?.weekday) ? req.body.weekday : null,
    });
    res.status(201).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not add that meal to the week.";
    res.status(400).json({ error: message });
  }
});

app.patch("/api/weekly/:id", async (req, res) => {
  try {
    const meal = await updateWeeklyMeal(String(req.params.id), {
      title: typeof req.body?.title === "string" ? req.body.title : undefined,
      weekday: "weekday" in (req.body ?? {}) ? req.body.weekday : undefined,
      checked: typeof req.body?.checked === "boolean" ? req.body.checked : undefined,
    });
    res.json(meal);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update that weekly meal.";
    res.status(404).json({ error: message });
  }
});

app.delete("/api/weekly", async (_req, res) => {
  res.json({ meals: await clearWeekly() });
});

app.delete("/api/weekly/:id", async (req, res) => {
  await removeWeeklyMeal(String(req.params.id));
  res.status(204).end();
});

app.get("/api/grocery", async (_req, res) => {
  res.json(await listGrocery());
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

app.patch("/api/grocery/checked", async (req, res) => {
  if (typeof req.body?.checked !== "boolean") {
    res.status(400).json({ error: "Send { checked: true or false }." });
    return;
  }
  const items = await setAllGroceryChecked(req.body.checked);
  res.json({ items });
});

app.put("/api/grocery/order", async (req, res) => {
  const categoryOrder = await setGroceryCategoryOrder(req.body?.categoryOrder ?? req.body?.order);
  res.json({ categoryOrder });
});

app.delete("/api/grocery", async (_req, res) => {
  const items = await clearAllGrocery();
  res.json({ items });
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
  console.log(`Pluck API on http://127.0.0.1:${port}`);
  for (const address of lanAddresses()) {
    console.log(`Phone / Expo:     http://${address}:${port}`);
  }
});
