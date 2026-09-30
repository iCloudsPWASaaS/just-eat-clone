import type { OrderStatus } from "@/lib/types";

/** Presentational labels/colours for order statuses — used by the account
 * area and the admin console. Client-safe (no server-only imports). */

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Order received",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for delivery",
  collected: "Collected",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-yellow-offWhite text-grey-darkest",
  confirmed: "bg-blue-offWhite text-blue-darkest",
  preparing: "bg-orange-offWhite text-orange-aa",
  out_for_delivery: "bg-blue-offWhite text-blue-darkest",
  collected: "bg-green-offWhite text-green",
  delivered: "bg-green-offWhite text-green",
  cancelled: "bg-red-offWhite text-red",
};

/**
 * Allowed order-status transitions — both the admin API (to reject nonsense
 * jumps) and the admin UI (which buttons to offer). Collection orders end at
 * "collected"; delivery orders pass through "out_for_delivery" to "delivered".
 */
export const NEXT_ORDER_STATUS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["out_for_delivery", "collected", "cancelled"],
  out_for_delivery: ["delivered"],
  collected: [],
  delivered: [],
  cancelled: [],
};

/** The happy-path steps for the customer's progress tracker. */
export const DELIVERY_STEPS: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
];
export const COLLECTION_STEPS: OrderStatus[] = ["pending", "confirmed", "preparing", "collected"];