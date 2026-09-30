/**
 * Imports the scraped restaurant data into the `justeat` Postgres schema.
 *
 *   node --env-file=.env scripts/import.mjs
 *
 * Uses the service-role key, so it bypasses RLS and can write the catalogue.
 * Safe to re-run: the restaurant is upserted by source_id and the menu is
 * replaced wholesale for that restaurant.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Allow running without `--env-file` by parsing .env ourselves.
if (existsSync(join(ROOT, ".env")) && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  for (const line of readFileSync(join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([\w-]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trimStart().startsWith("#")) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "justeat";

if (!URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Add SUPABASE_SERVICE_ROLE_KEY to .env — see supabase/schema.sql header."
  );
  process.exit(1);
}

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: SCHEMA },
});

const restaurantSeed = JSON.parse(readFileSync(join(ROOT, "data", "restaurant.json"), "utf8"));
const menuSeed = JSON.parse(readFileSync(join(ROOT, "data", "menu.json"), "utf8"));

// Written by scripts/upload-images.mjs. Absent until images have been uploaded,
// in which case the catalogue simply has no image_url values.
const imageManifestPath = join(ROOT, "data", "images.json");
const images = existsSync(imageManifestPath)
  ? JSON.parse(readFileSync(imageManifestPath, "utf8"))
  : { items: {}, restaurant: {} };

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Best-effort dietary tagging from the item name and description. */
function tags(item) {
  const text = `${item.name} ${item.description ?? ""}`.toLowerCase();
  return {
    is_vegetarian:
      /veggie|vegetable|falafel|halloumi|mushroom|jalape|garlic bread|pakora/.test(text),
    is_vegan: false,
    is_halal: !/cheeseburger|fanta|coke|pepsi|sprite|7up|tango|rio|fruit shoot/.test(text),
    is_spicy: /spicy|chilli|peri peri|jalape/.test(text),
    is_popular: /margherita|donner|chicken shawarma|family deal|meal deal/.test(
      `${item.name}`.toLowerCase()
    ),
  };
}

function fail(message, detail) {
  console.error(`\n✗ ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

/** Surfaces the PostgREST error rather than silently writing nothing.
 *  Accepts either a full response or a bare error object. */
function check(label, result) {
  const error = result?.error ?? result ?? null;
  if (error) fail(`${label} failed`, `  ${error.message} (code ${error.code ?? "?"})`);
  console.log(`  ✓ ${label}`);
}

async function main() {
  console.log(`Importing into schema "${SCHEMA}" at ${URL}\n`);

  const r = restaurantSeed.restaurants[0];
  if (!r) fail("data/restaurant.json contains no restaurants");

  // --- Restaurant --------------------------------------------------------
  console.log("Restaurant");
  const restaurantRow = {
    source_id: r.sourceId,
    slug: r.slug,
    name: r.name,
    description: r.description,
    cuisines: r.cuisines,
    address_line1: r.addressLine1,
    address_line2: r.addressLine2,
    city: r.city,
    postcode: r.postcode,
    latitude: r.latitude,
    longitude: r.longitude,
    phone: r.phone,
    website: r.website,
    // Prefer the copy in our own Storage bucket over hotlinking Just Eat's CDN.
    logo_url: images.restaurant?.logo?.publicUrl ?? r.logoUrl,
    hero_image_url: images.restaurant?.photo?.publicUrl ?? r.heroImageUrl ?? null,
    rating: r.rating,
    rating_count: r.ratingCount,
    food_hygiene_rating: r.foodHygieneRating,
    price_range: r.priceRange,
    delivery_fee: r.deliveryFee,
    small_order_threshold: r.smallOrderThreshold,
    minimum_order_value: r.minimumOrderValue,
    service_fee_percent: r.serviceFeePercent,
    delivery_eta_min: r.deliveryEtaMinMinutes,
    delivery_eta_max: r.deliveryEtaMaxMinutes,
    collection_eta_min: r.collectionEtaMinutes,
    is_delivery: r.isDelivery,
    is_collection: r.isCollection,
    is_preorder: r.isPreorder,
    is_halal: r.isHalal,
    is_vegetarian: r.isVegetarianFriendly,
    accepts_cod: r.acceptsCashOnDelivery,
    contactless: r.contactlessDelivery,
    keyword_seo_title: r.keywordSeoTitle,
    keyword_seo_desc: r.keywordSeoDescription,
    provenance: r.provenance,
  };

  const { data: restaurant, error: rErr } = await supabase
    .from("restaurants")
    .upsert(restaurantRow, { onConflict: "source_id" })
    .select("id, name")
    .single();
  check("restaurant upserted", rErr);
  console.log(`    id=${restaurant.id} "${restaurant.name}"`);

  const rid = restaurant.id;

  // --- Replace the restaurant's menu wholesale ---------------------------
  // Deleting the categories is enough: menu_items cascade from category_id,
  // variations and favourites/basket_items cascade from item_id.
  // order_items.item_id is `on delete set null` and its name/price columns are
  // snapshotted, so past orders survive a re-import intact.
  console.log("\nClearing previous menu");
  check("menu cleared", (await supabase.from("menu_categories").delete().eq("restaurant_id", rid)).error);

  // --- Menu --------------------------------------------------------------
  console.log(`\nMenu (${menuSeed.categories.length} categories)`);
  let itemCount = 0;
  let variationCount = 0;

  for (const category of menuSeed.categories) {
    const { data: cat, error: cErr } = await supabase
      .from("menu_categories")
      .insert({
        restaurant_id: rid,
        source_id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description ?? null,
        image_url: images.categories?.[category.slug]?.publicUrl ?? null,
        sort_order: category.sortOrder,
      })
      .select("id")
      .single();
    check(`category "${category.name}"`, cErr);

    for (const item of category.items) {
      const prices = item.variations.map((v) => v.price);
      const t = tags(item);

      const { data: row, error: iErr } = await supabase
        .from("menu_items")
        .insert({
          category_id: cat.id,
          restaurant_id: rid,
          source_id: item.sourceId,
          name: item.name,
          slug: `${slugify(item.name)}-${item.sourceId}`,
          description: item.description || null,
          image_url: images.items?.[item.sourceId]?.publicUrl ?? null,
          base_price: Math.min(...prices),
          sort_order: 0,
          ...t,
        })
        .select("id")
        .single();
      check(`  item "${item.name}"`, iErr);
      itemCount++;

      const variationRows = item.variations.map((v, idx) => ({
        item_id: row.id,
        source_id: v.sourceId,
        name: v.name,
        display_name: v.displayName,
        price: v.price,
        calories: v.calories,
        is_default: idx === 0,
        sort_order: idx,
      }));

      const { error: vErr } = await supabase
        .from("menu_item_variations")
        .insert(variationRows);
      check(`    ${variationRows.length} variation(s)`, vErr);
      variationCount += variationRows.length;
    }
  }

  // --- Opening hours -----------------------------------------------------
  console.log("\nOpening hours");
  await supabase.from("opening_hours").delete().eq("restaurant_id", rid);
  check("opening hours", (
    await supabase.from("opening_hours").insert(
      restaurantSeed.openingHours.map((h) => ({
        restaurant_id: rid,
        day_of_week: h.dayOfWeek,
        label: h.label,
        open_time: h.openTime,
        close_time: h.closeTime,
        is_closed: false,
      }))
    )
  ).error);

  // --- Delivery zones ----------------------------------------------------
  console.log("\nDelivery zones");
  await supabase.from("delivery_zones").delete().eq("restaurant_id", rid);
  check("delivery zones", (
    await supabase.from("delivery_zones").insert(
      restaurantSeed.deliveryPostcodes.map((z) => ({
        restaurant_id: rid,
        postcode: z.postcode,
        distance_km: z.distanceKm,
        eta_minutes: z.minutes,
        is_deliverable: true,
      }))
    )
  ).error);

  // --- FAQs --------------------------------------------------------------
  console.log("\nFAQs");
  await supabase.from("faqs").delete().eq("restaurant_id", rid);
  check("faqs", (
    await supabase.from("faqs").insert(
      restaurantSeed.faqs.map((f) => ({
        restaurant_id: rid,
        question: f.question,
        answer: f.answer,
        sort_order: f.sortOrder,
      }))
    )
  ).error);

  console.log(`
✓ Import complete
    restaurant  ${restaurant.name} (${rid})
    categories  ${menuSeed.categories.length}
    items       ${itemCount}
    variations  ${variationCount}
    hours       ${restaurantSeed.openingHours.length}
    zones       ${restaurantSeed.deliveryPostcodes.length}
    faqs        ${restaurantSeed.faqs.length}

  Reviews are intentionally left empty — no customer reviews were
  fabricated for this real restaurant. Signed-in customers can add their
  own via POST /api/reviews.
`);
}

main().catch((err) => fail("Unexpected error", err?.stack ?? String(err)));
