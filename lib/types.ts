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

export type BasketLine = {
  id: string;
  itemId: string;
  variationId: string | null;
  name: string;
  variationName: string | null;
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
