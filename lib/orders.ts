import { round2, SERVICE_FEE } from "@/lib/pricing";
import { isUuid } from "@/lib/menu-ids";
import type { BasketLine, Restaurant } from "@/lib/types";
import { createClient } from "@/lib/server";

export type RequestedLine = {
  itemId: string;
  variationId: string | null;
  quantity: number;
  notes?: string | null;
};

type Resolved = {
  lines: BasketLine[];
  /** Item ids that no longer exist in the menu. */
  unknown: string[];
};

/**
 * Re-prices a set of requested basket lines against the database.
 *
 * The client sends item ids and quantities only — never prices. Anything the
 * browser claims to have paid is ignored here, so a tampered payload cannot
 * change what an order costs.
 */
export async function priceLinesFromIds(requested: RequestedLine[]): Promise<Resolved> {
  if (requested.length === 0) return { lines: [], unknown: [] };

  const supabase = createClient();
  const itemIds = Array.from(new Set(requested.map((l) => l.itemId)));

  // Menu ids may be database uuids (seeded site) or the source ids used by the
  // JSON seed data (not-yet-imported site), so match on either column.
  const { uuids, sources } = itemIds.reduce(
    (acc, id) => {
      (isUuid(id) ? acc.uuids : acc.sources).push(id);
      return acc;
    },
    { uuids: [] as string[], sources: [] as string[] }
  );

  const { data, error } = await supabase
    .from("menu_items")
    .select("id, source_id, name, base_price, is_available, menu_item_variations(id, source_id, name, price, is_available)")
    .or(
      [
        uuids.length ? `id.in.(${uuids.map((v) => `"${v}"`).join(",")})` : null,
        sources.length ? `source_id.in.(${sources.map((v) => `"${v}"`).join(",")})` : null,
      ]
        .filter(Boolean)
        .join(",")
    );

  if (error) throw new Error(`menu_items lookup failed: ${error.message}`);

  // Key by every identifier a client might legitimately have sent, so the
  // lookup below works whether the caller used a uuid or a source id.
  const byId = new Map<string, Record<string, unknown>>();
  for (const item of (data ?? []) as Record<string, unknown>[]) {
    byId.set(item.id as string, item);
    if (item.source_id) byId.set(item.source_id as string, item);
  }

  const lines: BasketLine[] = [];
  const unknown: string[] = [];

  for (const req of requested) {
    const item = byId.get(req.itemId);
    if (!item) {
      unknown.push(req.itemId);
      continue;
    }
    if (item.is_available === false) continue;

    const variations = (item.menu_item_variations ?? []) as {
      id: string;
      source_id: string | null;
      name: string;
      price: number;
      is_available: boolean;
    }[];

    const variation = req.variationId
      ? variations.find((v) => v.id === req.variationId || v.source_id === req.variationId)
      : undefined;

    // A variation that has since been removed or disabled falls back to the
    // item's own base price rather than dropping the line.
    const useVariation = variation && variation.is_available !== false;
    const unitPrice = useVariation
      ? Number(variation.price)
      : Number(item.base_price ?? 0);
    const quantity = Math.max(1, Math.min(50, Math.floor(req.quantity) || 1));

    lines.push({
      id: `${req.itemId}::${req.variationId ?? "base"}`,
      // Always the database uuid, because this is what order_items.item_id
      // expects — the caller may have sent a source id.
      itemId: item.id as string,
      variationId: useVariation ? (variation!.id as string) : null,
      name: item.name as string,
      variationName: useVariation ? (variation!.name as string) : null,
      unitPrice,
      quantity,
      notes: req.notes ? req.notes.slice(0, 500) : null,
      lineTotal: round2(unitPrice * quantity),
    });
  }

  return { lines, unknown };
}

export type OrderTotals = {
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  etaMinutes: number | null;
};

export function computeTotals(
  lines: BasketLine[],
  restaurant: Restaurant,
  fulfilment: "delivery" | "collection",
  zoneEta: number | null
): OrderTotals {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const deliveryFee = fulfilment === "delivery" ? round2(restaurant.deliveryFee) : 0;
  const percentFee = round2((subtotal * restaurant.serviceFeePercent) / 100);
  const serviceFee = percentFee > 0 ? percentFee : SERVICE_FEE;
  const total = round2(subtotal + deliveryFee + serviceFee);

  return {
    subtotal,
    deliveryFee,
    serviceFee,
    discount: 0,
    total,
    etaMinutes:
      fulfilment === "delivery"
        ? (zoneEta ?? restaurant.deliveryEtaMax)
        : restaurant.collectionEtaMin,
  };
}

/** Human-friendly order reference, e.g. "WDK-7F3A92". */
export function buildOrderReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `WDK-${out}`;
}
