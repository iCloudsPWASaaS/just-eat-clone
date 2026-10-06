import type { MenuItem } from "./types";

/** A menu item paired with the category it sits under — needed for scoring. */
export type CatalogEntry = { item: MenuItem; categoryName: string };

const DIET_FLAGS = ["isVegetarian", "isVegan", "isHalal", "isSpicy"] as const;

/** Default size price, else the first size, else the base price. */
function priceOf(item: MenuItem): number {
  return (
    (item.variations.find((v) => v.isDefault) ?? item.variations[0])?.price ??
    item.basePrice
  );
}

/** Words in the name + description, short filler words dropped. */
function words(item: MenuItem): Set<string> {
  const text = `${item.name} ${item.description ?? ""}`.toLowerCase();
  return new Set(text.split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
}

/** Jaccard overlap between two word sets, 0–1. */
function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/**
 * Ranks every other dish by how much it resembles the seed, powering the
 * item popup's "Have you seen…?" strip. Score = same menu section, shared
 * dietary/spicy tags, nearby price and overlapping words, with a small lift
 * for items flagged Popular. Deterministic: ties fall back to menu order,
 * then name.
 */
export function rankByResemblance(
  seed: MenuItem,
  catalog: CatalogEntry[]
): MenuItem[] {
  const seedCategory =
    catalog.find((e) => e.item.id === seed.id)?.categoryName ?? null;
  const seedPrice = priceOf(seed);
  const seedWords = words(seed);

  const scored = catalog
    .filter((e) => e.item.id !== seed.id && e.item.isAvailable)
    .map((e) => {
      const candidate = e.item;
      let score = 0;

      if (seedCategory && e.categoryName === seedCategory) score += 30;
      if (candidate.isPopular) score += 12;

      for (const flag of DIET_FLAGS) {
        if (seed[flag] && candidate[flag]) score += 7;
        else if (seed[flag] !== candidate[flag]) score -= 3;
      }

      const price = priceOf(candidate);
      const gap = Math.abs(seedPrice - price) / Math.max(seedPrice, price, 1);
      score += 14 * (1 - Math.min(gap, 1));
      score += 20 * overlap(seedWords, words(candidate));

      return { item: candidate, score, sortOrder: candidate.sortOrder };
    });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.sortOrder - b.sortOrder ||
      a.item.name.localeCompare(b.item.name)
  );
  return scored.map((e) => e.item);
}
