import { readFileSync, writeFileSync } from "node:fs";

/**
 * A couple of generic Just Eat image paths 404: the vegetarian wraps point at
 * `..._VEGETARIAN/VEGAN-0`, which is not a real asset. Swap in the closest
 * paths that do resolve, verified over HTTP.
 */
const REPLACEMENTS = {
  "251448522": "v1/uk/generic-products/Vegetarian_Wrap_TURKISH-0",
  "251448524": "v1/uk/generic-products/Falafel_Kebab_TURKISH-0",
};

const FILE = "data/je-images.json";
const images = JSON.parse(readFileSync(FILE, "utf8"));
const prefix =
  "https://just-eat-prod-eu-res.cloudinary.com/image/upload/c_thumb,w_600/f_jpg,q_auto/t_jet_ai_watermark_generic/";

for (const [sourceId, path] of Object.entries(REPLACEMENTS)) {
  const entry = images.items[sourceId];
  if (!entry) {
    console.log(`MISSING ${sourceId}`);
    continue;
  }
  const url = prefix + path;
  const status = (await fetch(url)).status;
  if (status !== 200) {
    console.log(`SKIP ${entry.name} (${status})`);
    continue;
  }
  entry.url = url;
  entry.matchedBy = "generic-fix";
  console.log(`FIXED  ${entry.name} -> ${path}`);
}

writeFileSync(FILE, JSON.stringify(images, null, 2));