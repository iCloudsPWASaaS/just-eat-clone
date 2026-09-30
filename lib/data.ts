import { createClient } from "@/lib/server";
import { priceBasket, round2, SERVICE_FEE, type PriceBreakdown } from "@/lib/pricing";
import type {
  Address,
  Basket,
  BasketLine,
  Deal,
  DeliveryZone,
  Faq,
  FulfilmentType,
  MenuCategory,
  MenuData,
  MenuItem,
  MenuVariation,
  OpeningHour,
  Order,
  OrderItem,
  OrderStatus,
  Restaurant,
  Review,
} from "@/lib/types";
import menuSeed from "@/data/menu.json";
import restaurantSeed from "@/data/restaurant.json";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Written by scripts/upload-images.mjs, so it only exists once images have
 * actually been uploaded. Read defensively — the site has to work without it.
 */
const imageManifest: {
  items?: Record<string, { publicUrl?: string }>;
  categories?: Record<string, { publicUrl?: string }>;
  restaurant?: Record<string, { publicUrl?: string }>;
} = (() => {
  try {
    const path = join(process.cwd(), "data", "images.json");
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  } catch {
    return {};
  }
})();

/* -------------------------------------------------------------------------- */
/* Row -> model mapping                                                       */
/* -------------------------------------------------------------------------- */

type Row = Record<string, any>;

const num = (v: unknown, fallback = 0): number =>
  v === null || v === undefined || v === "" ? fallback : Number(v);

const bool = (v: unknown): boolean => v === true || v === "true";

const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

function mapRestaurant(r: Row): Restaurant {
  return {
    id: r.id,
    sourceId: str(r.source_id),
    slug: r.slug,
    name: r.name,
    description: str(r.description),
    cuisines: Array.isArray(r.cuisines) ? r.cuisines : [],
    addressLine1: r.address_line1,
    addressLine2: str(r.address_line2),
    city: r.city,
    postcode: r.postcode,
    latitude: r.latitude === null ? null : num(r.latitude),
    longitude: r.longitude === null ? null : num(r.longitude),
    phone: str(r.phone),
    website: str(r.website),
    logoUrl: str(r.logo_url),
    heroImageUrl: str(r.hero_image_url),
    rating: num(r.rating),
    ratingCount: num(r.rating_count),
    foodHygieneRating: r.food_hygiene_rating === null ? null : num(r.food_hygiene_rating),
    priceRange: str(r.price_range),
    deliveryFee: num(r.delivery_fee),
    smallOrderThreshold: num(r.small_order_threshold),
    minimumOrderValue: num(r.minimum_order_value),
    serviceFeePercent: num(r.service_fee_percent),
    deliveryEtaMin: num(r.delivery_eta_min, 30),
    deliveryEtaMax: num(r.delivery_eta_max, 45),
    collectionEtaMin: num(r.collection_eta_min, 20),
    isDelivery: bool(r.is_delivery),
    isCollection: bool(r.is_collection),
    isPreorder: bool(r.is_preorder),
    isHalal: bool(r.is_halal),
    isVegetarian: bool(r.is_vegetarian),
    acceptsCod: bool(r.accepts_cod),
    contactless: bool(r.contactless),
    keywordSeoTitle: str(r.keyword_seo_title),
    keywordSeoDesc: str(r.keyword_seo_desc),
  };
}

function mapVariation(r: Row): MenuVariation {
  return {
    id: r.id,
    name: r.name,
    displayName: str(r.display_name),
    price: num(r.price),
    calories: r.calories === null ? null : num(r.calories),
    isDefault: bool(r.is_default),
  };
}

function mapItem(r: Row): MenuItem {
  const variations: MenuVariation[] = Array.isArray(r.menu_item_variations)
    ? r.menu_item_variations.map(mapVariation)
    : [];
  variations.sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: str(r.description),
    imageUrl: str(r.image_url),
    calories: r.calories === null ? null : num(r.calories),
    basePrice: variations.length ? Math.min(...variations.map((v) => v.price)) : num(r.base_price),
    isVegetarian: bool(r.is_vegetarian),
    isVegan: bool(r.is_vegan),
    isHalal: bool(r.is_halal),
    isSpicy: bool(r.is_spicy),
    isPopular: bool(r.is_popular),
    isAvailable: r.is_available !== false,
    sortOrder: num(r.sort_order),
    variations,
  };
}

function mapCategory(r: Row): MenuCategory {
  const items: MenuItem[] = Array.isArray(r.menu_items) ? r.menu_items.map(mapItem) : [];
  items.sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: str(r.description),
    sortOrder: num(r.sort_order),
    items: items.filter((i) => i.isAvailable),
  };
}

function mapDeal(r: Row): Deal {
  return {
    id: r.id,
    title: r.title,
    subtitle: str(r.subtitle),
    description: str(r.description),
    discountType: r.discount_type,
    discountValue: num(r.discount_value),
    minOrderValue: num(r.min_order_value),
    badge: str(r.badge),
  };
}

function mapFaq(r: Row): Faq {
  return { id: r.id, question: r.question, answer: r.answer };
}

function mapZone(r: Row): DeliveryZone {
  return {
    postcode: r.postcode,
    distanceKm: num(r.distance_km),
    etaMinutes: num(r.eta_minutes),
    isDeliverable: bool(r.is_deliverable),
  };
}

function mapHours(r: Row): OpeningHour {
  const t = (v: unknown) => (v ? String(v).slice(0, 5) : null);
  return {
    dayOfWeek: num(r.day_of_week),
    label: r.label,
    openTime: t(r.open_time),
    closeTime: t(r.close_time),
    isClosed: bool(r.is_closed),
  };
}

function mapReview(r: Row): Review {
  return {
    id: r.id,
    authorName: r.author_name,
    rating: num(r.rating),
    title: str(r.title),
    comment: str(r.comment),
    fulfilmentType: r.fulfilment_type === null ? null : num(r.fulfilment_type),
    isVerifiedOrder: bool(r.is_verified_order),
    restaurantReply: str(r.restaurant_reply),
    createdAt: r.created_at,
    userId: str(r.user_id),
  };
}

function mapAddress(r: Row): Address {
  return {
    id: r.id,
    label: r.label,
    firstName: r.first_name,
    lastName: r.last_name,
    addressLine1: r.address_line1,
    addressLine2: str(r.address_line2),
    city: r.city,
    postcode: r.postcode,
    phone: str(r.phone),
    deliveryNotes: str(r.delivery_notes),
    isDefault: bool(r.is_default),
  };
}

function mapOrder(r: Row): Order {
  const items: Row[] = Array.isArray(r.order_items) ? r.order_items : [];
  items.sort((a, b) => (String(a.id) > String(b.id) ? 1 : -1));
  const history =
    Array.isArray(r.order_status_history)
      ? [...r.order_status_history]
          .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
          .map((h) => ({
            status: h.status as OrderStatus,
            note: h.note ?? null,
            createdAt: h.created_at,
          }))
      : [];
  return {
    id: r.id,
    reference: r.reference,
    fulfilmentType: r.fulfilment_type,
    status: r.status as OrderStatus,
    deliveryAddress: r.delivery_address ?? null,
    contactName: str(r.contact_name),
    contactPhone: str(r.contact_phone),
    customerNotes: str(r.customer_notes),
    subtotal: num(r.subtotal),
    deliveryFee: num(r.delivery_fee),
    serviceFee: num(r.service_fee),
    discount: num(r.discount),
    total: num(r.total),
    paymentMethod: r.payment_method,
    promoCode: str(r.promo_code),
    etaMinutes: r.eta_minutes === null ? null : num(r.eta_minutes),
    placedAt: r.placed_at,
    history,
    items: items.map((i) => ({
      id: i.id,
      itemId: String(i.item_id ?? ""),
      variationId: i.variation_id ? String(i.variation_id) : null,
      name: i.name,
      variationName: str(i.variation_name),
      unitPrice: num(i.unit_price),
      quantity: num(i.quantity),
      notes: str(i.notes),
      lineTotal: num(i.line_total),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Local seed fallback                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The app is usable before `npm run import` has been run: if Supabase has no
 * catalogue rows yet we fall back to the JSON in /data. This keeps `npm run dev`
 * meaningful on a fresh checkout and makes it obvious (via the dataSource
 * flag) when the UI is reading from the database.
 */
function buildSeedData(): MenuData | null {
  const r = restaurantSeed.restaurants[0];
  if (!r) return null;

  const restaurant: Restaurant = {
    id: "seed",
    sourceId: r.sourceId,
    slug: r.slug,
    name: r.name,
    description: r.description,
    cuisines: r.cuisines,
    addressLine1: r.addressLine1,
    addressLine2: r.addressLine2,
    city: r.city,
    postcode: r.postcode,
    latitude: r.latitude,
    longitude: r.longitude,
    phone: r.phone,
    website: r.website,
    logoUrl: imageManifest.restaurant?.logo?.publicUrl ?? r.logoUrl,
    heroImageUrl: null,
    rating: r.rating,
    ratingCount: r.ratingCount,
    foodHygieneRating: r.foodHygieneRating,
    priceRange: r.priceRange,
    deliveryFee: r.deliveryFee,
    smallOrderThreshold: r.smallOrderThreshold,
    minimumOrderValue: r.minimumOrderValue,
    serviceFeePercent: r.serviceFeePercent,
    deliveryEtaMin: r.deliveryEtaMinMinutes,
    deliveryEtaMax: r.deliveryEtaMaxMinutes,
    collectionEtaMin: r.collectionEtaMinutes,
    isDelivery: r.isDelivery,
    isCollection: r.isCollection,
    isPreorder: r.isPreorder,
    isHalal: r.isHalal,
    isVegetarian: r.isVegetarianFriendly,
    acceptsCod: r.acceptsCashOnDelivery,
    contactless: r.contactlessDelivery,
    keywordSeoTitle: r.keywordSeoTitle,
    keywordSeoDesc: r.keywordSeoDescription,
  };

  const categories: MenuCategory[] = menuSeed.categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: null,
    imageUrl: imageManifest.categories?.[c.slug]?.publicUrl ?? null,
    sortOrder: c.sortOrder,
    items: c.items.map((i) => ({
      id: i.sourceId,
      name: i.name,
      slug: i.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      description: i.description || null,
      imageUrl: imageManifest.items?.[i.sourceId]?.publicUrl ?? null,
      calories: null,
      basePrice: Math.min(...i.variations.map((v) => v.price)),
      isVegetarian: /veggie|vegetable|falafel|halloumi|mushroom|jalape/i.test(i.name),
      isVegan: false,
      isHalal: true,
      isSpicy: /spicy|chilli|peri peri|jalape/i.test(i.name),
      isPopular: /margherita|donner|chicken shawarma|family|meal deal/i.test(i.name),
      isAvailable: true,
      sortOrder: 0,
      variations: i.variations.map((v, idx) => ({
        id: v.sourceId,
        name: v.name,
        displayName: v.displayName,
        price: v.price,
        calories: null,
        isDefault: idx === 0,
      })),
    })),
  }));

  return {
    restaurant,
    hours: restaurantSeed.openingHours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      label: h.label,
      openTime: h.openTime,
      closeTime: h.closeTime,
      isClosed: false,
    })),
    categories,
    deals: [],
    faqs: restaurantSeed.faqs.map((f) => ({ id: `faq-${f.sortOrder}`, ...f })),
    zones: restaurantSeed.deliveryPostcodes.map((z) => ({
      postcode: z.postcode,
      distanceKm: z.distanceKm,
      etaMinutes: z.minutes,
      isDeliverable: true,
    })),
  };
}

let seedCache: MenuData | null = null;
function seedData(): MenuData {
  if (!seedCache) {
    const built = buildSeedData();
    if (!built) throw new Error("Seed data in /data is empty");
    seedCache = built;
  }
  return seedCache;
}

/* -------------------------------------------------------------------------- */
/* Public catalogue                                                           */
/* -------------------------------------------------------------------------- */

export async function getMenuData(): Promise<MenuData> {
  try {
    const supabase = createClient();

    const { data: restaurantRows, error: rErr } = await supabase
      .from("restaurants")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1);

    if (rErr) throw rErr;
    const restaurantRow = restaurantRows?.[0];
    if (!restaurantRow) return seedData();

    const id = restaurantRow.id;

    const [hours, categories, deals, faqs, zones] = await Promise.all([
      supabase.from("opening_hours").select("*").eq("restaurant_id", id).order("day_of_week"),
      supabase
        .from("menu_categories")
        .select("*, menu_items(*, menu_item_variations(*))")
        .eq("restaurant_id", id)
        .order("sort_order"),
      supabase.from("deals").select("*").eq("restaurant_id", id).eq("is_active", true).order("sort_order"),
      supabase.from("faqs").select("*").eq("restaurant_id", id).order("sort_order"),
      supabase.from("delivery_zones").select("*").eq("restaurant_id", id).order("eta_minutes"),
    ]);

    const firstError = [hours, categories, deals, faqs, zones].find((r) => r.error)?.error;
    if (firstError) throw firstError;

    return {
      restaurant: mapRestaurant(restaurantRow),
      hours: (hours.data ?? []).map(mapHours),
      categories: (categories.data ?? []).map(mapCategory),
      deals: (deals.data ?? []).map(mapDeal),
      faqs: (faqs.data ?? []).map(mapFaq),
      zones: (zones.data ?? []).map(mapZone),
    };
  } catch (err) {
    console.error("[data] Supabase read failed, falling back to /data seed:", err);
    return seedData();
  }
}

export async function getRestaurant(): Promise<Restaurant> {
  return (await getMenuData()).restaurant;
}

export async function getReviews(limit = 50): Promise<Review[]> {
  const { restaurant } = await getMenuData();
  // The seed fallback has no database id, so there is nothing to query against.
  if (restaurant.id === "seed") return [];
  try {
    const supabase = createClient();
    const { data: rows, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (rows ?? []).map(mapReview);
  } catch (err) {
    console.error("[data] reviews read failed:", err);
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Delivery                                                                   */
/* -------------------------------------------------------------------------- */

export function checkDeliveryTo(
  zones: DeliveryZone[],
  postcode: string
): { deliverable: boolean; etaMinutes: number | null; matched: DeliveryZone | null } {
  const normalised = normalisePostcode(postcode);
  if (!normalised) return { deliverable: false, etaMinutes: null, matched: null };

  const exact = zones.find((z) => normalisePostcode(z.postcode) === normalised);
  if (exact) {
    return { deliverable: exact.isDeliverable, etaMinutes: exact.etaMinutes, matched: exact };
  }

  // Fall back to the outward district so we still give a useful answer for
  // streets inside a covered district.
  const district = normalised.slice(0, normalised.length - 3).trim();
  const near = zones.find((z) => normalisePostcode(z.postcode).startsWith(district));
  if (near) {
    return { deliverable: near.isDeliverable, etaMinutes: near.etaMinutes, matched: near };
  }

  return { deliverable: false, etaMinutes: null, matched: null };
}

export function normalisePostcode(p: string): string {
  return p
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

/* -------------------------------------------------------------------------- */
/* Basket maths (shared by the client panel and the checkout API)             */
/* -------------------------------------------------------------------------- */

export { priceBasket, round2, SERVICE_FEE, type PriceBreakdown };

export async function getBasketFor(
  userId: string,
  restaurant: Restaurant,
  fulfilment: FulfilmentType,
  discount = 0
): Promise<PriceBreakdown> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("basket_items")
    .select("*, menu_items(*, menu_item_variations(*))")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw error;

  const lines: BasketLine[] = (data ?? []).map((r) => {
    const item = r.menu_items;
    const variation = item?.menu_item_variations?.find(
      (v: Row) => v.id === r.variation_id
    );
    const unitPrice = variation ? num(variation.price) : num(item?.base_price);
    const quantity = num(r.quantity, 1);
    return {
      id: r.id,
      itemId: r.item_id,
      variationId: r.variation_id,
      name: item?.name ?? "Item",
      variationName: variation?.name ?? null,
      unitPrice,
      quantity,
      notes: str(r.notes),
      lineTotal: round2(unitPrice * quantity),
    };
  });

  return priceBasket(lines, restaurant, fulfilment, discount);
}

/* -------------------------------------------------------------------------- */
/* Account-scoped reads                                                       */
/* -------------------------------------------------------------------------- */

export async function getAddresses(userId: string): Promise<Address[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map(mapAddress);
}

export async function getOrders(userId: string, limit = 25): Promise<Order[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*), order_status_history(*)")
    .eq("user_id", userId)
    .order("placed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapOrder);
}

export async function getOrderByReference(userId: string, reference: string): Promise<Order | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*), order_status_history(*)")
    .eq("user_id", userId)
    .eq("reference", reference)
    .maybeSingle();
  if (error) throw error;
  return data ? mapOrder(data) : null;
}

export async function getFavourites(userId: string): Promise<MenuItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("favourites")
    .select("menu_items(*, menu_item_variations(*))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((r) => r.menu_items)
    .filter(Boolean)
    .map(mapItem);
}

export async function getFavouriteIds(userId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("favourites").select("item_id").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.item_id as string);
}
