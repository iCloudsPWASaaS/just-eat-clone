/**
 * Extracts the real product and category images from the saved Just Eat menu
 * page.
 *
 * The page embeds a standard Next.js `__NEXT_DATA__` blob holding the whole
 * menu. The parts we want are:
 *
 *   props.appProps.preloadedState.menu.restaurant.cdn.items.<uuid>
 *       109 `menuitem` objects, each with `name` and `imageSources[].path`
 *
 *   props.appProps.preloadedState.menu.restaurant.subcategories.topLevelCategories[]
 *       16 categories, also with `imageSources[].path`
 *
 * Each path is a Cloudinary URL with a literal `{transformations}` placeholder
 * and no file extension, in one of two flavours:
 *
 *   v1/uk/dishes/267105/<hash>   a photograph this restaurant uploaded
 *   v1/uk/generic-products/...   Just Eat's generic stock, used as a fallback
 *
 * Both are kept, but `kind` records which is which so provenance is never lost.
 *
 *   node scripts/parse-je-images.mjs
 *
 * Reads  data/raw/menu-je.html, data/menu.json
 * Writes data/je-images.json
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "data", "raw", "menu-je.html");
const OUT = join(ROOT, "data", "je-images.json");

if (!existsSync(SRC)) {
  console.error("data/raw/menu-je.html not found — save the Just Eat menu page first.");
  process.exit(1);
}

const html = readFileSync(SRC, "utf8");
const menu = JSON.parse(readFileSync(join(ROOT, "data", "menu.json"), "utf8"));

const blob = html.match(
  /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
);
if (!blob) {
  console.error("No __NEXT_DATA__ blob in the saved page.");
  console.error("Re-save it from Chrome with 'Webpage, Complete'.");
  process.exit(1);
}

const data = JSON.parse(blob[1]);
const restaurant =
  data?.props?.appProps?.preloadedState?.menu?.restaurant;

if (!restaurant) {
  console.error("Menu data not found inside __NEXT_DATA__.");
  process.exit(1);
}

/** Turn a raw Cloudinary path into a fetchable URL plus its provenance. */
function resolve(path) {
  const isRestaurantPhoto = /\/v1\/uk\/dishes\/267105\//.test(path);
  const isGeneric = /\/v1\/uk\/generic-products\//.test(path);
  return {
    url: path.replace("{transformations}", "c_thumb,w_600/f_jpg,q_auto"),
    kind: isRestaurantPhoto
      ? "restaurant-photo"
      : isGeneric
        ? "just-eat-generic"
        : "just-eat-experiment",
  };
}

const firstImage = (node) => {
  const path =
    Array.isArray(node?.imageSources) && node.imageSources.length
      ? node.imageSources[0].path
      : null;
  // Cloudinary's "default" is an empty placeholder, not a photograph.
  if (!path || /\/default$/.test(path)) return null;
  return resolve(path);
};

// --- Products, straight from the page's own item records --------------------
const pageItems = new Map();
for (const item of Object.values(restaurant.cdn?.items ?? {})) {
  if (item?.type !== "menuitem" || !item.name) continue;
  const image = firstImage(item);
  if (!pageItems.has(item.name)) pageItems.set(item.name, image);
}

// --- Category images -------------------------------------------------------
const pageCategories = new Map();
for (const cat of restaurant.subcategories?.topLevelCategories ?? []) {
  if (!cat?.name) continue;
  const image = firstImage(cat);
  if (!pageCategories.has(cat.name)) pageCategories.set(cat.name, image);
}

/** Case/whitespace/punctuation-insensitive fallback for name matching. */
const loose = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const looseItems = new Map([...pageItems].map(([n, v]) => [loose(n), v]));
const looseCategories = new Map([...pageCategories].map(([n, v]) => [loose(n), v]));

const items = {};
const categories = {};
const itemStats = { exact: 0, loose: 0, missing: 0 };
const itemsWithoutPhoto = [];
const itemNamesMissing = [];

for (const category of menu.categories) {
  const catImage = pageCategories.get(category.name) ?? looseCategories.get(loose(category.name)) ?? null;
  if (catImage) categories[category.slug] = { name: category.name, ...catImage };

  for (const item of category.items) {
    let image = pageItems.get(item.name);
    let how = "exact";
    if (!image) {
      image = looseItems.get(loose(item.name));
      how = "loose";
    }

    if (image) {
      itemStats[how]++;
      items[item.sourceId] = { name: item.name, category: category.name, matchedBy: how, ...image };
    } else if (pageItems.has(item.name) || looseItems.has(loose(item.name))) {
      // On the page, but the restaurant uploaded no photo for it.
      itemsWithoutPhoto.push(`${category.name} / ${item.name}`);
    } else {
      itemStats.missing++;
      itemNamesMissing.push(`${category.name} / ${item.name}`);
    }
  }
}

writeFileSync(OUT, JSON.stringify({ items, categories }, null, 2));

const total = menu.categories.reduce((n, c) => n + c.items.length, 0);
const byKind = Object.values(items).reduce(
  (a, i) => ((a[i.kind] = (a[i.kind] ?? 0) + 1), a),
  {}
);
const catKinds = Object.values(categories).reduce(
  (a, c) => ((a[c.kind] = (a[c.kind] ?? 0) + 1), a),
  {}
);

console.log(`product images on page: ${pageItems.size}`);
console.log(`category images on page: ${pageCategories.size}\n`);

console.log(`our menu items: ${total}`);
console.log(`  matched:       ${itemStats.exact + itemStats.loose} (${itemStats.exact} exact, ${itemStats.loose} loose)`);
console.log(`  by kind:       ${JSON.stringify(byKind)}`);
console.log(`  no photo:      ${itemsWithoutPhoto.length}`);
console.log(`  not on page:   ${itemNamesMissing.length}`);

console.log(`\nour categories: ${menu.categories.length}`);
console.log(`  matched:       ${Object.keys(categories).length}`);
console.log(`  by kind:       ${JSON.stringify(catKinds)}`);

console.log(`\nwrote data/je-images.json`);

if (itemsWithoutPhoto.length) {
  console.log(`\nlisted on the page, no photograph (${itemsWithoutPhoto.length}):`);
  for (const n of itemsWithoutPhoto.slice(0, 10)) console.log(`  ${n}`);
  if (itemsWithoutPhoto.length > 10) console.log(`  ... and ${itemsWithoutPhoto.length - 10} more`);
}
if (itemNamesMissing.length) {
  console.log(`\nname not found on page (${itemNamesMissing.length}):`);
  for (const n of itemNamesMissing.slice(0, 10)) console.log(`  ${n}`);
  if (itemNamesMissing.length > 10) console.log(`  ... and ${itemNamesMissing.length - 10} more`);
}
