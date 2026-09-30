import type { BasketLine, FulfilmentType, Restaurant } from "@/lib/types";

/**
 * Pure basket arithmetic, deliberately kept free of any Supabase or
 * `next/headers` import so that client components can share exactly the same
 * pricing code the server uses. Keeping one implementation means the total the
 * customer sees can never drift from the total the server re-computes.
 */

/**
 * Platform service fee. When the restaurant sets `service_fee_percent` that
 * percentage wins; otherwise this flat fallback is charged.
 */
export const SERVICE_FEE = 2.5;

export type PriceBreakdown = {
  lines: BasketLine[];
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  belowMinimumOrder: boolean;
  minimumOrderValue: number;
};

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function priceBasket(
  lines: BasketLine[],
  restaurant: Restaurant,
  fulfilment: FulfilmentType,
  discount = 0
): PriceBreakdown {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const deliveryFee = fulfilment === "delivery" ? round2(restaurant.deliveryFee) : 0;

  const percentFee = round2((subtotal * restaurant.serviceFeePercent) / 100);
  const serviceFee = percentFee > 0 ? percentFee : SERVICE_FEE;

  const appliedDiscount = Math.min(Math.max(discount, 0), subtotal + deliveryFee);
  const total = round2(subtotal + deliveryFee + serviceFee - appliedDiscount);

  return {
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal,
    deliveryFee,
    serviceFee: round2(serviceFee),
    discount: round2(appliedDiscount),
    total,
    belowMinimumOrder:
      fulfilment === "delivery" && subtotal < restaurant.minimumOrderValue,
    minimumOrderValue: restaurant.minimumOrderValue,
  };
}
