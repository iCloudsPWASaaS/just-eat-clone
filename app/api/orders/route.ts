import { jsonError, jsonOk, requireUser } from "@/lib/api";
import { checkDeliveryTo, getMenuData, getOrders, getBasketFor } from "@/lib/data";
import {
  buildOrderReference,
  computeTotals,
  priceLinesFromIds,
  type RequestedLine,
} from "@/lib/orders";
import type { DeliveryAddressSnapshot, FulfilmentType } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/orders — the signed-in customer's order history. */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return jsonOk({ orders: await getOrders(auth.userId) });
}

const ALLOWED_PAYMENT = new Set(["card", "cash", "paypal"]);

/**
 * POST /api/orders — place an order.
 *
 * Totals are recomputed here from the database rather than trusted from the
 * request, and the order plus its line items are written in one round trip
 * with the basket cleared on success.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { supabase, userId } = auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const fulfilment: FulfilmentType = body.fulfilmentType === "collection" ? "collection" : "delivery";
  const paymentMethod = ALLOWED_PAYMENT.has(String(body.paymentMethod))
    ? String(body.paymentMethod)
    : "card";

  const rawLines = Array.isArray(body.lines) ? (body.lines as RequestedLine[]).slice(0, 60) : [];
  if (rawLines.length === 0) return jsonError("Your basket is empty.");

  const { restaurant, zones } = await getMenuData();

  // --- Delivery address -------------------------------------------------
  let address: DeliveryAddressSnapshot | null = null;
  if (fulfilment === "delivery") {
    const src = (body.address ?? {}) as Record<string, unknown>;
    const required = ["firstName", "lastName", "addressLine1", "city", "postcode"] as const;
    for (const f of required) {
      if (typeof src[f] !== "string" || !(src[f] as string).trim()) {
        return jsonError(`Address is missing \`${f}\`.`);
      }
    }
    address = {
      firstName: (src.firstName as string).trim().slice(0, 80),
      lastName: (src.lastName as string).trim().slice(0, 80),
      addressLine1: (src.addressLine1 as string).trim().slice(0, 160),
      addressLine2: typeof src.addressLine2 === "string" ? src.addressLine2.trim().slice(0, 160) : null,
      city: (src.city as string).trim().slice(0, 80),
      postcode: (src.postcode as string).trim().toUpperCase().slice(0, 10),
      phone: typeof src.phone === "string" ? src.phone.trim().slice(0, 40) : null,
      deliveryNotes:
        typeof src.deliveryNotes === "string" ? src.deliveryNotes.trim().slice(0, 500) : null,
    };

    const zone = checkDeliveryTo(zones, address.postcode);
    if (!zone.deliverable) {
      return jsonError(`Sorry, we don't deliver to ${address.postcode}. Try collection instead.`);
    }
  }

  // --- Re-price from the database --------------------------------------
  let priced;
  try {
    priced = await priceLinesFromIds(rawLines);
  } catch (err) {
    console.error("[orders] pricing failed:", err);
    return jsonError("We couldn't price your basket. Please try again.", 500);
  }

  if (priced.lines.length === 0) {
    return jsonError("None of the items in your basket are available any more.");
  }

  if (fulfilment === "delivery" && !restaurant.isDelivery) {
    return jsonError("This restaurant is not currently delivering.");
  }
  if (fulfilment === "collection" && !restaurant.isCollection) {
    return jsonError("This restaurant is not currently offering collection.");
  }

  const zoneEta =
    fulfilment === "delivery" && address
      ? checkDeliveryTo(zones, address.postcode).etaMinutes
      : null;

  const totals = computeTotals(priced.lines, restaurant, fulfilment, zoneEta);

  if (fulfilment === "delivery" && totals.subtotal < restaurant.minimumOrderValue) {
    return jsonError(
      `The minimum order value is £${restaurant.minimumOrderValue.toFixed(2)}.`
    );
  }

  // --- Persist -----------------------------------------------------------
  const reference = buildOrderReference();
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      reference,
      user_id: userId,
      restaurant_id: restaurant.id,
      address_id: typeof body.addressId === "string" ? body.addressId : null,
      fulfilment_type: fulfilment,
      status: "pending",
      delivery_address: address,
      contact_name: address ? `${address.firstName} ${address.lastName}`.trim() : null,
      contact_phone: address?.phone ?? null,
      customer_notes:
        typeof body.customerNotes === "string" ? body.customerNotes.trim().slice(0, 500) : null,
      subtotal: totals.subtotal,
      delivery_fee: totals.deliveryFee,
      service_fee: totals.serviceFee,
      discount: totals.discount,
      total: totals.total,
      payment_method: paymentMethod,
      eta_minutes: totals.etaMinutes,
    })
    .select("id, reference")
    .single();

  if (orderErr || !order) {
    console.error("[orders] insert failed:", orderErr);
    return jsonError("We couldn't place your order. Please try again.", 500);
  }

  const { error: itemsErr } = await supabase.from("order_items").insert(
    priced.lines.map((l) => ({
      order_id: order.id,
      item_id: l.itemId,
      variation_id: l.variationId,
      name: l.name,
      variation_name: l.variationName,
      unit_price: l.unitPrice,
      quantity: l.quantity,
      notes: l.notes,
      line_total: l.lineTotal,
    }))
  );

  if (itemsErr) {
    console.error("[orders] line items failed:", itemsErr);
    // The order header exists but has no lines — cancel it so the customer is
    // not billed for an empty order.
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    return jsonError("We couldn't save your order items. No charge was made.", 500);
  }

  await supabase.from("order_status_history").insert({
    order_id: order.id,
    status: "pending",
    note: "Order received",
  });

  await supabase.from("basket_items").delete().eq("user_id", userId);

  // Hand the client back the authoritative post-order basket so it can reset
  // its local state without a second round trip.
  const basket = await getBasketFor(userId, restaurant, fulfilment);

  return jsonOk(
    {
      order: {
        id: order.id,
        reference: order.reference,
        fulfilmentType: fulfilment,
        status: "pending",
        ...totals,
        etaMinutes: totals.etaMinutes,
      },
      basket,
      // Surfaced so the UI can explain a removed line instead of silently
      // dropping it from the total.
      removedItemIds: priced.unknown,
    },
    201
  );
}
