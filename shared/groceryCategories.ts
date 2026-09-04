import type { GroceryCategory, GroceryItem } from "./types";

export const GROCERY_CATEGORIES: GroceryCategory[] = [
  "produce",
  "fruit",
  "meat",
  "seafood",
  "dairy",
  "bakery",
  "pantry",
  "other",
];

export const GROCERY_CATEGORY_LABELS: Record<GroceryCategory, string> = {
  produce: "Veggies",
  fruit: "Fruit",
  meat: "Meat",
  seafood: "Seafood",
  dairy: "Dairy",
  bakery: "Bakery",
  pantry: "Pantry",
  other: "Other",
};

const CATEGORY_PHRASES: Array<[GroceryCategory, string[]]> = [
  [
    "pantry",
    [
      "fish sauce",
      "oyster sauce",
      "chili powder",
      "garlic powder",
      "onion powder",
      "cayenne",
      "tomato paste",
      "tomato sauce",
      "chicken broth",
      "beef broth",
      "vegetable broth",
      "chicken stock",
      "beef stock",
      "coconut milk",
    ],
  ],
  [
    "seafood",
    [
      "salmon",
      "shrimp",
      "prawn",
      "tuna",
      "cod",
      "tilapia",
      "halibut",
      "trout",
      "sardine",
      "anchovy",
      "crab",
      "lobster",
      "scallop",
      "clam",
      "mussel",
      "oyster",
      "fish",
    ],
  ],
  [
    "meat",
    [
      "chicken",
      "beef",
      "steak",
      "pork",
      "bacon",
      "sausage",
      "turkey",
      "lamb",
      "ham",
      "prosciutto",
      "salami",
      "pepperoni",
      "chorizo",
      "brisket",
      "ribs",
      "veal",
      "duck",
      "ground beef",
      "ground turkey",
      "ground pork",
      "meatball",
      "hot dog",
    ],
  ],
  [
    "dairy",
    [
      "milk",
      "cream",
      "half and half",
      "half-and-half",
      "butter",
      "ghee",
      "yogurt",
      "yoghurt",
      "cheese",
      "mozzarella",
      "parmesan",
      "cheddar",
      "ricotta",
      "feta",
      "cottage cheese",
      "sour cream",
      "buttermilk",
      "egg",
    ],
  ],
  [
    "fruit",
    [
      "apple",
      "banana",
      "strawberry",
      "blueberry",
      "raspberry",
      "blackberry",
      "berry",
      "orange",
      "lemon",
      "lime",
      "grape",
      "mango",
      "pineapple",
      "peach",
      "pear",
      "cherry",
      "watermelon",
      "cantaloupe",
      "melon",
      "kiwi",
      "plum",
      "apricot",
      "grapefruit",
      "pomegranate",
      "papaya",
      "coconut",
      "raisin",
      "cranberry",
      "date",
      "fig",
    ],
  ],
  [
    "produce",
    [
      "onion",
      "garlic",
      "shallot",
      "leek",
      "scallion",
      "green onion",
      "tomato",
      "potato",
      "sweet potato",
      "carrot",
      "celery",
      "bell pepper",
      "red pepper",
      "green pepper",
      "yellow pepper",
      "jalapeno",
      "jalapeño",
      "chile",
      "chili",
      "spinach",
      "lettuce",
      "kale",
      "arugula",
      "cabbage",
      "broccoli",
      "cauliflower",
      "zucchini",
      "cucumber",
      "mushroom",
      "avocado",
      "corn",
      "pea",
      "green bean",
      "asparagus",
      "eggplant",
      "squash",
      "pumpkin",
      "beet",
      "radish",
      "turnip",
      "ginger",
      "cilantro",
      "parsley",
      "basil",
      "mint",
      "dill",
      "rosemary",
      "thyme",
      "chive",
      "fennel",
      "okra",
      "artichoke",
      "tofu",
    ],
  ],
  [
    "bakery",
    [
      "bread",
      "bun",
      "roll",
      "bagel",
      "pita",
      "naan",
      "tortilla",
      "croissant",
      "baguette",
    ],
  ],
  [
    "pantry",
    [
      "flour",
      "sugar",
      "brown sugar",
      "oil",
      "olive oil",
      "vegetable oil",
      "vinegar",
      "soy sauce",
      "fish sauce",
      "hot sauce",
      "broth",
      "stock",
      "rice",
      "pasta",
      "noodle",
      "lentil",
      "chickpea",
      "black bean",
      "kidney bean",
      "canned",
      "tomato paste",
      "tomato sauce",
      "salt",
      "black pepper",
      "peppercorn",
      "cumin",
      "paprika",
      "cinnamon",
      "oregano",
      "baking soda",
      "baking powder",
      "vanilla",
      "honey",
      "maple syrup",
      "ketchup",
      "mustard",
      "mayo",
      "mayonnaise",
      "cornstarch",
      "cornmeal",
    ],
  ],
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nameMatches(haystack: string, phrase: string): boolean {
  const forms = new Set([phrase, `${phrase}s`]);
  if (phrase.endsWith("y") && phrase.length > 2 && !/[aeiou]y$/i.test(phrase)) {
    forms.add(`${phrase.slice(0, -1)}ies`);
  }
  if (phrase.endsWith("o") && phrase.length > 2) forms.add(`${phrase}es`);
  if (/(?:s|x|ch|sh)$/.test(phrase)) forms.add(`${phrase}es`);
  return [...forms].some((form) => {
    const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(form)}(?:\\s|$)`, "i");
    return pattern.test(haystack);
  });
}

export function isGroceryCategory(value: unknown): value is GroceryCategory {
  return (
    typeof value === "string" &&
    (GROCERY_CATEGORIES as readonly string[]).includes(value)
  );
}

export function guessGroceryCategory(name: string): GroceryCategory {
  const hay = name.toLowerCase().replace(/-/g, " ");
  for (const [category, phrases] of CATEGORY_PHRASES) {
    if (phrases.some((phrase) => nameMatches(hay, phrase))) return category;
  }
  return "other";
}

export function groceryCategoryLabel(category: GroceryCategory | undefined): string {
  return GROCERY_CATEGORY_LABELS[isGroceryCategory(category) ? category : "other"];
}

export function nextGroceryCategory(category: GroceryCategory | undefined): GroceryCategory {
  const current = isGroceryCategory(category) ? category : "other";
  const index = GROCERY_CATEGORIES.indexOf(current);
  return GROCERY_CATEGORIES[(index + 1) % GROCERY_CATEGORIES.length];
}

export function groupGroceryItems(items: GroceryItem[]): Array<{
  category: GroceryCategory;
  label: string;
  items: GroceryItem[];
}> {
  const buckets = new Map<GroceryCategory, GroceryItem[]>();
  for (const category of GROCERY_CATEGORIES) buckets.set(category, []);
  for (const item of items) {
    const category = isGroceryCategory(item.category)
      ? item.category
      : guessGroceryCategory(item.name || item.label);
    buckets.get(category)?.push(item);
  }
  return GROCERY_CATEGORIES.filter((category) => (buckets.get(category)?.length ?? 0) > 0).map(
    (category) => ({
      category,
      label: GROCERY_CATEGORY_LABELS[category],
      items: buckets.get(category) ?? [],
    }),
  );
}
