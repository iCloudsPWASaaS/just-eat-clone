import { jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orders — all orders for the staff view.
 *
 * Query params:
 *   status  filter by status (optional)
 *   q       free-text search over reference / contact / postcode (optional)
 *   limit   page size (default 50)
 */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  let query = admin
    .from("orders")
    .select("*, order_items(*), order_status_history(*)")
    .order("placed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status === "delivery" || status === "collection") {
    query = query.eq("fulfilment_type", status);
  } else if (
    status &&
    ["pending", "confirmed", "preparing", "out_for_delivery", "collected", "delivered", "cancelled"].includes(status)
  ) {
    query = query.eq("status", status as OrderStatus);
  }

  const { data, error } = q
    ? await query.or(
        `reference.ilike.%${q}%,contact_name.ilike.%${q}%,delivery_address->>postcode.ilike.%${q}%`
      )
    : await query;

  if (error) return jsonOk({ orders: [], error: error.message });

  const orders = (data ?? []).map((o) => ({
    id: o.id,
    reference: o.reference,
    status: o.status,
    fulfilmentType: o.fulfilment_type,
    contactName: o.contact_name,
    contactPhone: o.contact_phone,
    customerNotes: o.customer_notes,
    deliveryAddress: o.delivery_address,
    subtotal: Number(o.subtotal),
    deliveryFee: Number(o.delivery_fee),
    serviceFee: Number(o.service_fee),
    discount: Number(o.discount),
    total: Number(o.total),
    paymentMethod: o.payment_method,
    etaMinutes: o.eta_minutes,
    placedAt: o.placed_at,
    items: o.order_items,
    history: o.order_status_history,
  }));

  return jsonOk({ orders });
}