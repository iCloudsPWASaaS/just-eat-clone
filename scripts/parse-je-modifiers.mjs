/**
 * Extracts the "choose your ..." pickers from the saved Just Eat menu page and
 * joins them onto our own menu in data/menu.json.
 *
 * The page embeds a Next.js `__NEXT_DATA__` blob. The relevant parts are:
 *
 *   ...menu.restaurant.cdn.modifierGroups[]
 *       25 groups: { id, name, minChoices, maxChoices, modifiers: [modifierSetId] }
 *
 *   ...menu.restaurant.cdn.modifierSets[]
 *       186 sets: { id, modifier: { name, additionPrice, minChoices, maxChoices } }
 *
 *   ...menu.restaurant.cdn.items.<uuid>.variations[].modifierGroupsIds[]
 *       the join: which groups apply to which *variation*
 *
 * Semantics, which are the whole point of this script:
 *
 *   minChoices === 0        optional      -> UI shows "Optional"
 *   minChoices >= 1         required      -> UI shows "N required"
 *   maxChoices === 1        single        -> radio buttons
 *   maxChoices > 1          multiple      -> checkboxes behind a "Show N more" expander
 *
 * `additionPrice` on each modifier is a real price delta in pounds (+£2.00 for
 * chips on a kebab, +£1.80 for a pizza topping on a 14" but +£1.20 on a 10"),
 * which is why groups hang off the variation rather than the item.
 *
 * The two datasets do not share ids — data/menu.json carries eateasy source ids
 * like "251448461-0" while Just Eat uses uuids — so items and variations are
 * matched by normalised name. Three item names are ambiguous ("Chicken
 * Shawarma" is both a kebab and a pizza), so those are disambiguated by
 * description and price before falling back to an ordered candidate.
 *
 * Groups are deduplicated by (name, min, max, options): the 25 upstream groups
 * collapse to 13 distinct ones, with "Choose Your Salad" repeated 4 times and
 * shared by 18 variations.
 *
 *   node scripts/parse-je-modifiers.mjs
 *
 * Reads  data/raw/menu-je.html, data/menu.json
 * Writes data/modifiers.json
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "data", "raw", "menu-je.html");
const OUT = join(ROOT, "data", "modifiers.json");

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
const restaurant = data?.props?.appProps?.preloadedState?.menu?.restaurant;
const cdn = restaurant?.cdn;
if (!cdn?.modifierGroups?.length) {
  console.error("No modifierGroups in the saved page — re-save it from the menu URL.");
  process.exit(1);
}

/** Case/whitespace/punctuation-insensitive key, same approach as parse-je-images. */
const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// --- Resolve the upstream groups into deduplicated, normalised records --------

const setById = new Map((cdn.modifierSets ?? []).map((s) => [String(s.id), s.modifier]));

/**
 * Identity for deduplication. Two groups with the same name and constraints but
 * different option prices are genuinely different groups (the +£1.80 and +£1.20
 * pizza topping lists), so price is part of the key.
 */
const signature = (g) =>
  JSON.stringify([
    g.name,
    g.minSelect,
    g.maxSelect,
    g.options.map((o) => [o.name, o.priceDelta]),
  ]);

const groups = [];
/** upstream group id -> key of the deduplicated group it collapses to */
const keyByUpstreamId = new Map();

for (const upstream of cdn.modifierGroups) {
  const options = (upstream.modifiers ?? [])
    .map((id) => setById.get(String(id)))
    .filter(Boolean)
    .map((m) => ({
      name: m.name,
      description: m.description ?? null,
      // additionPrice is in pounds. removePrice exists upstream but nothing in
      // this menu uses it, so it is not carried across.
      priceDelta: Number(m.additionPrice ?? 0) || 0,
    }));

  const record = {
    name: upstream.name,
    // Just Eat sends no description on a group; the field is kept for
    // restaurants whose tooling does.
    description: upstream.description ?? null,
    minSelect: Math.max(0, Number(upstream.minChoices ?? 0) || 0),
    // 99 is their "unlimited" sentinel. Clamping keeps the quantity stepper
    // usable and stops an unbounded repeat-order loophole.
    maxSelect: Math.min(Math.max(1, Number(upstream.maxChoices ?? 1) || 1), 20),
    options,
  };

  const sig = signature(record);
  let key = groups.find((g) => g.sig === sig)?.key;
  if (!key) {
    key = createHash("sha1").update(sig).digest("hex").slice(0, 12);
    groups.push({ key, sig, name: record.name, description: record.description, minSelect: record.minSelect, maxSelect: record.maxSelect, options: record.options });
  }
  keyByUpstreamId.set(String(upstream.id), key);
}

// --- Index the Just Eat items by name ----------------------------------------

const jeItems = Object.values(cdn.items ?? {}).filter((i) => i && i.name);
const jeByName = new Map();
for (const item of jeItems) {
  const key = norm(item.name);
  if (!jeByName.has(key)) jeByName.set(key, []);
  jeByName.get(key).push(item);
}

/** Prices of an item's variations, ascending — used as a matching fingerprint. */
const priceSet = (item) =>
  (item.variations ?? [])
    .map((v) => Number(v.basePrice ?? 0))
    .sort((a, b) => a - b);

/**
 * Picks the right Just Eat item when several share a name. Compares
 * description and the set of variation prices, which separates the kebab
 * "Chicken Shawarma" (9.40/10.90) from the pizza one (16.40/14.40).
 */
function pickCandidate(candidates, mine) {
  if (candidates.length === 1) return candidates[0];

  const minePrices = priceSet(mine);
  const scored = candidates
    .map((c) => {
      let score = 0;
      if (norm(c.description) && norm(c.description) === norm(mine.description)) score += 4;
      score += priceSet(c).filter((p) => minePrices.includes(p)).length;
      return { candidate: c, score };
    })
    .sort((a, b) => b.score - a.score);

  // Only trust a tiebreak that actually discriminated something.
  return scored[0].score > scored[1].score ? scored[0].candidate : candidates[0];
}

/**
 * Maps one of our variations onto a Just Eat variation.
 *
 * Single-variation items are the awkward case: Just Eat names those variations
 * "" (the `NoVariation` type), so name matching has to fall back to position
 * once both sides agree the item only has one option.
 */
function pickVariation(jeItem, mine, index, total) {
  const vars = jeItem.variations ?? [];
  if (!vars.length) return null;
  if (vars.length === 1 && total === 1) return vars[0];

  const exact = vars.find((v) => norm(v.name) === norm(mine.name));
  if (exact) return exact;

  // Pizza sizes and kebab sizes line up by index even when the labels differ
  // (our "Chicken Shawarma" pizza lists 14"/10", theirs "Reg"/"Lrg").
  return vars[index] ?? null;
}

// --- Join onto our menu ------------------------------------------------------

/** variation sourceId -> ordered, deduplicated group keys */
const variationGroups = {};
const stats = {
  itemsMatched: 0,
  itemsAmbiguous: 0,
  itemsUnmatched: 0,
  variationsLinked: 0,
  variationsUnlinked: 0,
};
const unmatchedItems = [];

for (const category of menu.categories) {
  for (const item of category.items) {
    const candidates = jeByName.get(norm(item.name));
    if (!candidates?.length) {
      stats.itemsUnmatched++;
      unmatchedItems.push(`${category.name} / ${item.name}`);
      continue;
    }
    stats.itemsMatched++;
    if (candidates.length > 1) stats.itemsAmbiguous++;

    const jeItem = pickCandidate(candidates, item);

    item.variations.forEach((variation, index) => {
      const jeVariation = pickVariation(jeItem, variation, index, item.variations.length);
      const ids = jeVariation?.modifierGroupsIds ?? [];
      if (!ids.length) {
        stats.variationsUnlinked++;
        return;
      }

      // Preserve the order Just Eat lists the groups in — that is the order the
      // customer sees them stacked on the real site.
      const keys = [];
      for (const id of ids) {
        const key = keyByUpstreamId.get(String(id));
        if (key && !keys.includes(key)) keys.push(key);
      }

      if (keys.length) {
        variationGroups[variation.sourceId] = keys;
        stats.variationsLinked++;
      } else {
        stats.variationsUnlinked++;
      }
    });
  }
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: "just-eat.co.uk __NEXT_DATA__ cdn.modifierGroups / cdn.modifierSets",
      generatedAt: new Date().toISOString(),
      groups: groups.map(({ sig, ...g }) => g),
      variationGroups,
    },
    null,
    2
  )
);

// --- Report ------------------------------------------------------------------

const optionCount = groups.reduce((n, g) => n + g.options.length, 0);
const shapes = new Map();
for (const g of groups) {
  const shape = `${g.minSelect > 0 ? "required" : "optional"} / ${g.maxSelect > 1 ? "multi" : "single"}`;
  shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
}

console.log(`upstream groups:  ${cdn.modifierGroups.length} -> ${groups.length} distinct`);
console.log(`options:          ${optionCount}`);
console.log(`group shapes:     ${[...shapes].map(([k, v]) => `${k} x${v}`).join(", ")}`);
console.log(`\nour items:       ${menu.categories.reduce((n, c) => n + c.items.length, 0)}`);
console.log(`  matched:        ${stats.itemsMatched} (${stats.itemsAmbiguous} needed a tiebreak)`);
console.log(`  not on page:    ${stats.itemsUnmatched}`);
console.log(`variations:       ${stats.variationsLinked} with pickers, ${stats.variationsUnlinked} without`);

console.log(`\ndistinct groups:`);
for (const g of groups) {
  const prices = [...new Set(g.options.map((o) => o.priceDelta))].filter((p) => p !== 0);
  const priceNote = prices.length ? `  (+£${prices.join(", +£")})` : "";
  console.log(`  ${g.name}${priceNote}`);
  console.log(
    `    min=${g.minSelect} max=${g.maxSelect} options=${g.options.length}\n    ${g.options.map((o) => o.name).join(", ")}`
  );
}

console.log(`\nwrote data/modifiers.json`);

if (unmatchedItems.length) {
  console.log(`\nnot found on the page (${unmatchedItems.length}) — no pickers for these:`);
  for (const n of unmatchedItems.slice(0, 10)) console.log(`  ${n}`);
  if (unmatchedItems.length > 10) console.log(`  ... and ${unmatchedItems.length - 10} more`);
}