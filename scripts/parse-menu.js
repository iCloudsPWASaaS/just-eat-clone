// Parses the scraped Woodfarm Kebab & Pizza menu HTML into structured JSON.
// Source: eateasy.co.uk mirror of the restaurant's own published takeaway menu.
const fs = require("fs");
const path = require("path");

const SRC = process.argv[2] || path.join(__dirname, "..", "data", "raw", "menu.html");
const OUT = process.argv[3] || path.join(__dirname, "..", "data", "menu.json");

const html = fs.readFileSync(SRC, "utf8");

const decode = (s) => {
  let out = s
    .replace(/<[^>]+>/g, " ")
    .replace(/&pound;/gi, "\u00a3")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  // Source double-encodes some entities (e.g. `&#039;`), so run the numeric
  // + named entity pass until the value is stable.
  for (let i = 0; i < 3; i++) {
    const next = out
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&nbsp;/gi, " ")
      .replace(/&apos;/gi, "'")
      .replace(/&rsquo;/gi, "'")
      .replace(/&lsquo;/gi, "'")
      .replace(/&amp;/gi, "&");
    if (next === out) break;
    out = next;
  }
  return out.trim();
};

const CATEGORY_START = /<div id="([A-Za-z0-9_]+)Category"[^>]*>\s*<h2>([\s\S]*?)<\/h2>/g;
const starts = [];
let m;
while ((m = CATEGORY_START.exec(html)) !== null) {
  starts.push({ key: m[1], name: decode(m[2]), index: m.index });
}

const categories = [];
const items = [];

for (let i = 0; i < starts.length; i++) {
  const start = starts[i];
  const end = i + 1 < starts.length ? starts[i + 1].index : html.length;
  const slice = html.slice(start.index, end);

  const catId = `cat-${String(categories.length + 1).padStart(2, "0")}`;
  const category = {
    id: catId,
    name: start.name,
    slug: start.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    sortOrder: i + 1,
    items: [],
  };

  const rowRe = /<tr class="(?:odd|even)">([\s\S]*?)<\/tr>/g;
  let row;
  let current = null;

  while ((row = rowRe.exec(slice)) !== null) {
    const chunk = row[1];
    // addItem(itemId, categoryId, 'Display Name', price, groupIndex, 'variantFlags', 'CategoryKey')
    // groupIndex is -1 (and variantFlags is empty) for categories without variants.
    const add = chunk.match(
      /addItem\((\d+),\s*(\d+),\s*'((?:[^'\\]|\\')*)',\s*([\d.]+),\s*(-?\d+),\s*'([^']*)'/
    );
    if (!add) continue;

    const sourceId = add[1];
    const displayName = decode(add[3]);
    const price = parseFloat(add[4]);
    const groupIndex = add[5];
    const variantFlags = add[6];

    const cells = chunk.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
    const firstCell = cells[0] || "";
    const h6 = firstCell.match(/<h6>([\s\S]*?)<\/h6>/);
    const itemName = h6 ? decode(h6[1]) : "";
    const descMatch = firstCell.match(/<div>([\s\S]*?)<\/div>/);
    const description = descMatch ? decode(descMatch[1]) : "";

    let variation = "";
    if (cells[1]) variation = decode(cells[1]);

    // A row with a non-empty <h6> always starts a new item. An empty <h6>
    // means "same item, different variation" ONLY in categories that declare
    // variant grouping (groupIndex >= 0). Categories with groupIndex -1 and
    // empty variant flags (Drinks, Dips, ...) use an empty <h6> to mean a
    // separate product, so the variation cell is the real item name there.
    const isGrouped = groupIndex !== "-1" && variantFlags !== "";
    if (itemName || !current || !isGrouped) {
      current = {
        sourceId,
        groupIndex,
        variantFlags,
        name: itemName || variation || displayName,
        description,
        categoryId: catId,
        calories: null,
        variations: [],
      };
      items.push(current);
      category.items.push(current);
    }

    const variationName = variation || "";
    current.variations.push({
      sourceId: `${sourceId}-${current.variations.length}`,
      name: variationName || "Standard",
      displayName: displayName,
      price,
      calories: null,
    });
  }

  if (category.items.length) categories.push(category);
}

const out = {
  source: "eateasy.co.uk mirror of woodfarmkebabpizza.uk",
  generatedAt: new Date().toISOString(),
  categories,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

const totalVariations = items.reduce((n, i) => n + i.variations.length, 0);
console.log(`categories: ${categories.length}`);
console.log(`items:      ${items.length}`);
console.log(`variations: ${totalVariations}`);
for (const c of categories) {
  console.log(`  ${c.name.padEnd(22)} items=${String(c.items.length).padStart(3)}`);
}
