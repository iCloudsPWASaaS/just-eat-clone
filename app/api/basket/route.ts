import { jsonError, jsonOk, requireUser } from "@/lib/api";
import { resolveItemIds, resolveVariationIds } from "@/lib/menu-ids";

export const dynamic = "force-dynamic";

/**
 * Server-side mirror of the client basket.
 *
 * The live basket lives in localStorage so it works for signed-out visitors
 * (Just Eat only asks for an account at checkout). Once a customer signs in we
 * keep a copy here so the basket survives a device change.
 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const [{ data: basket }, { data: favourites }] = await Promise.all([
    supabase
      .from("basket_items")
      .select("*, menu_items(*, menu_item_variations(*))")
      .eq("user_id", auth.userId),
    supabase.from("favourites").select("item_id").eq("user_id", auth.userId),
  ]);

  return jsonOk({
    lines: basket ?? [],
    favouriteItemIds: (favourites ?? []).map((f) => f.item_id as string),
  });
}

/**
 * PUT /api/basket — replace the stored basket with the supplied lines.
 *
 * This is a full replace rather than an upsert-per-line so the client and the
 * server cannot drift when a line is removed locally.
 */
export async function PUT(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { supabase, userId } = auth;

  let body: { lines?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Expected a JSON body.");
  }

  const lines = Array.isArray(body.lines) ? body.lines.slice(0, 60) : [];

  const parsed = lines
    .map((l) => {
      const r = (l ?? {}) as Record<string, unknown>;
      const itemId = typeof r.itemId === "string" ? r.itemId : null;
      const quantity = Number(r.quantity);
      if (!itemId || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) return null;

      // Option ids and quantities only. Prices are never accepted here — the
      // stored basket is re-priced from the database at checkout.
      const modifiers = Array.isArray(r.modifiers)
        ? r.modifiers
            .map((m) => {
              const o = (m ?? {}) as Record<string, unknown>;
              const optionId = typeof o.optionId === "string" ? o.optionId : null;
              const qty = Number(o.quantity);
              if (!optionId || !Number.isInteger(qty) || qty < 1 || qty > 20) return null;
              return { optionId, quantity: qty };
            })
            .filter((m): m is { optionId: string; quantity: number } => m !== null)
            .slice(0, 40)
        : [];

      return {
        itemId,
        variationId: typeof r.variationId === "string" && r.variationId ? r.variationId : null,
        quantity,
        modifiers,
        notes: typeof r.notes === "string" && r.notes ? r.notes.slice(0, 500) : null,
        fulfilmentType: r.fulfilmentType === "collection" ? "collection" : "delivery",
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // The client may be holding source ids from the JSON seed data, so translate
  // them to uuids before they reach the item_id/variation_id columns.
  const [itemIds, variationIds] = await Promise.all([
    resolveItemIds(parsed.map((l) => l.itemId)),
    resolveVariationIds(parsed.map((l) => l.variationId ?? "")),
  ]);

  const { error: delErr } = await supabase.from("basket_items").delete().eq("user_id", userId);
  if (delErr) return jsonError(delErr.message, 500);

  const rows = parsed
    .map((l) => {
      const itemId = itemIds.get(l.itemId);
      // An id we could not resolve means the item is no longer on the menu, so
      // drop the line rather than letting the insert fail on the foreign key.
      if (!itemId) return null;
      return {
        user_id: userId,
        item_id: itemId,
        variation_id: l.variationId ? variationIds.get(l.variationId) ?? null : null,
        quantity: l.quantity,
        modifiers: l.modifiers,
        notes: l.notes,
        fulfilment_type: l.fulfilmentType,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length) {
    const { error } = await supabase.from("basket_items").insert(rows);
    if (error) return jsonError(error.message, 500);
  }

  return jsonOk({ ok: true, count: rows.length });
}
