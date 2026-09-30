import { NextResponse } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { NEXT_ORDER_STATUS } from "@/lib/order-status";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: { reference: string } };

/** GET /api/admin/orders/[reference] — one order with lines and history. */
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const { data, error } = await admin
    .from("orders")
    .select("*, order_items(*), order_status_history(*, created_at)")
    .eq("reference", params.reference)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Order not found.", 404);
  return jsonOk({ order: data });
}

/**
 * PATCH /api/admin/orders/[reference] — move an order to the given status.
 *
 * Only transitions allowed by NEXT_ORDER_STATUS are accepted, and each
 * transition is logged in order_status_history for the customer's tracker.
 */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const next = body.status as OrderStatus;
  if (!next || !NEXT_ORDER_STATUS[next as OrderStatus]) {
    return jsonError("Invalid status.", 400);
  }

  const { data: order, error } = await admin
    .from("orders")
    .select("id, status, fulfilment_type")
    .eq("reference", params.reference)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!order) return jsonError("Order not found.", 404);

  const current = order.status as OrderStatus;
  if (!NEXT_ORDER_STATUS[current]?.includes(next)) {
    return jsonError(
      `Cannot move an order from \`${current}\` to \`${next}\`.`,
      409
    );
  }

  const label = String(body.note ?? "").trim().slice(0, 300) || null;
  const { error: updErr } = await admin.from("orders").update({ status: next }).eq("id", order.id);
  if (updErr) return jsonError(updErr.message, 500);

  const { error: histErr } = await admin.from("order_status_history").insert({
    order_id: order.id,
    status: next,
    note: label,
  });
  if (histErr) return jsonError(histErr.message, 500);

  return jsonOk({ ok: true, status: next });
}

/** DELETE is intentionally unsupported — orders are immutable history. */
export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({ error: "Orders are immutable." }, { status: 405 });
}