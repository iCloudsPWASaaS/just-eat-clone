export type FulfilmentType = "delivery" | "collection";

export type Restaurant = {
  id: string;
  sourceId: string | null;
  slug: string;
  name: string;
  description: string | null;
  cuisines: string[];
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  rating: number;
  ratingCount: number;
  foodHygieneRating: number | null;
  priceRange: string | null;
  deliveryFee: number;
  smallOrderThreshold: number;
  minimumOrderValue: number;
  serviceFeePercent: number;
  deliveryEtaMin: number;
  deliveryEtaMax: number;
  collectionEtaMin: number;
  isDelivery: boolean;
  isCollection: boolean;
  isPreorder: boolean;
  isHalal: boolean;
  isVegetarian: boolean;
  acceptsCod: boolean;
  contactless: boolean;
  keywordSeoTitle: string | null;
  keywordSeoDesc: string | null;
};

export type OpeningHour = {
  dayOfWeek: number;
  label: string;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
};

export type MenuVariation = {
  id: string;
  name: string;
  displayName: string | null;
  price: number;
  calories: number | null;
  isDefault: boolean;
  /** "Choose your sauce", "Choose extra toppings" — empty when none apply. */
  modifierGroups: ModifierGroup[];
};

/**
 * One of the "choose your ..." pickers on an item.
 *
 * `minSelect` decides optional vs required (0 = "Optional", otherwise
 * "N required") and `maxSelect` decides the control: 1 renders radio buttons,
 * higher values render checkboxes with a quantity stepper and a "Show N more"
 * expander.
 */
export type ModifierGroup = {
  id: string;
  name: string;
  description: string | null;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  options: ModifierOption[];
};

export type ModifierOption = {
  id: string;
  name: string;
  description: string | null;
  /** Added to the variation price for each unit of this option. */
  priceDelta: number;
  isAvailable: boolean;
  sortOrder: number;
};

/** A single choice made by the customer, as stored on a basket/order line. */
export type ModifierSelection = {
  groupId: string;
  optionId: string;
  groupName: string;
  optionName: string;
  quantity: number;
  priceDelta: number;
};

export type MenuItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  calories: number | null;
  basePrice: number;
  isVegetarian: boolean;
  isVegan: boolean;
  isHalal: boolean;
  isSpicy: boolean;
  isPopular: boolean;
  isAvailable: boolean;
  sortOrder: number;
  variations: MenuVariation[];
};

export type MenuCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  items: MenuItem[];
};

export type Deal = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  discountType: "percentage" | "fixed" | "free_delivery" | "bogo";
  discountValue: number;
  minOrderValue: number;
  badge: string | null;
};

export type Faq = {
  id: string;
  question: string;
  answer: string;
};

export type Review = {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  fulfilmentType: number | null;
  isVerifiedOrder: boolean;
  restaurantReply: string | null;
  createdAt: string;
  userId: string | null;
};

export type DeliveryZone = {
  postcode: string;
  distanceKm: number;
  etaMinutes: number;
  isDeliverable: boolean;
};

export type MenuData = {
  restaurant: Restaurant;
  hours: OpeningHour[];
  categories: MenuCategory[];
  deals: Deal[];
  faqs: Faq[];
  zones: DeliveryZone[];
};

/**
 * Identity of a basket line. Two kebabs with different sauces are two separate
 * lines, so the chosen options have to be part of the key — order-independently,
 * since picking the same two sauces in the opposite order is still one line.
 *
 * Pure and free of any server import, so the client basket and the server's
 * re-pricing agree on what counts as the same line.
 */
export function lineIdentity(
  itemId: string,
  variationId: string | null,
  modifiers: { optionId: string; quantity: number }[]
): string {
  const base = `${itemId}::${variationId ?? "base"}`;
  if (!modifiers.length) return base;
  const sig = modifiers
    .map((m) => `${m.optionId}x${m.quantity}`)
    .sort()
    .join("+");
  return `${base}#${sig}`;
}

export type BasketLine = {
  id: string;
  itemId: string;
  variationId: string | null;
  name: string;
  variationName: string | null;
  /** Choices made in the "choose your ..." pickers. Empty for simple items. */
  modifiers: ModifierSelection[];
  /** Variation price plus every modifier delta — never a client-supplied price. */
  unitPrice: number;
  quantity: number;
  notes: string | null;
  lineTotal: number;
};

export type Basket = {
  lines: BasketLine[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  itemCount: number;
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "collected"
  | "delivered"
  | "cancelled";

export type Order = {
  id: string;
  reference: string;
  fulfilmentType: FulfilmentType;
  status: OrderStatus;
  deliveryAddress: DeliveryAddressSnapshot | null;
  contactName: string | null;
  contactPhone: string | null;
  customerNotes: string | null;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  paymentMethod: string;
  promoCode: string | null;
  etaMinutes: number | null;
  placedAt: string;
  items: OrderItem[];
  /** Status-transition log, most recent last — powers the progress tracker. */
  history: OrderStatusEvent[];
};

export type OrderStatusEvent = {
  status: OrderStatus;
  note: string | null;
  createdAt: string;
};

export type OrderItem = {
  id: string;
  itemId: string;
  variationId: string | null;
  name: string;
  variationName: string | null;
  /** Snapshotted so a past order still reads correctly after the menu changes. */
  modifiers: ModifierSelection[];
  unitPrice: number;
  quantity: number;
  notes: string | null;
  lineTotal: number;
};

export type Address = {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postcode: string;
  phone: string | null;
  deliveryNotes: string | null;
  isDefault: boolean;
};

export type DeliveryAddressSnapshot = {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  postcode: string;
  phone?: string | null;
  deliveryNotes?: string | null;
};
