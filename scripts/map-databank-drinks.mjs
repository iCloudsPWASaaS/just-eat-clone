import { readFileSync, writeFileSync } from "node:fs";

const images = JSON.parse(readFileSync("data/je-images.json", "utf8"));
const menu = JSON.parse(readFileSync("data/menu.json", "utf8"));
const html = readFileSync("data/raw/menu-je.html", "utf8");

const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
const d = JSON.parse(m[1]);
const pageItems = Object.values(d.props.appProps.preloadedState.menu.restaurant.cdn.items).filter(
  (i) => i.type === "menuitem"
);

/** Drop packaging words so "…500ml Bottle" and "…500ml" compare equal. */
function normalise(name) {
  return name
    .toLowerCase()
    .replace(/zero['’]?d apple sugar free/g, "tango apple")
    .replace(/\b(can|bottle|pack|multipack)\b/g, "")
    .replace(/\bcoca[\s-]?cola\b/g, "coke")
    .replace(/\bcoke cola\b/g, "coke")
    .replace(/\boriginal taste\b/g, "")
    .replace(/[^a-z0-9.']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const byName = new Map();
for (const item of pageItems) {
  const path = item.imageSources?.[0]?.path;
  if (!item.name || !path) continue;
  byName.set(normalise(item.name), {
    pageName: item.name,
    url: path.replace("{transformations}", "c_thumb,w_600/f_jpg,q_auto"),
    databank: path.includes("/databank-products/"),
  });
}

const category = menu.categories.find((c) => c.id === "cat-15");
let databank = 0;

// Earlier keyword-based runs mis-assigned variants (e.g. Pepsi Max -> Pepsi
// Diet), so drinks are re-matched by name from scratch. Anything without a
// databank photo falls back to the entry already in the file.
const fallback = new Map();
for (const item of category.items) {
  const current = images.items[item.sourceId];
  if (current) fallback.set(item.sourceId, current);
}

for (const item of category.items) {
  const hit = byName.get(normalise(item.name));
  if (hit?.databank) {
    images.items[item.sourceId] = {
      name: item.name,
      category: category.name,
      matchedBy: "databank-name",
      url: hit.url,
      kind: "just-eat-databank",
    };
    databank++;
    console.log(`MATCHED  ${item.name} -> ${hit.pageName}`);
    continue;
  }

  const keep = fallback.get(item.sourceId);
  if (keep) images.items[item.sourceId] = keep;
  console.log(`KEPT     ${item.name} (${hit ? "no databank photo" : "no page image"})`);
}

writeFileSync("data/je-images.json", JSON.stringify(images, null, 2));
console.log(`\ndatabank mappings: ${databank}`);