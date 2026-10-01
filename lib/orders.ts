import { createClient } from "@/lib/server";
import { round2, SERVICE_FEE } from "@/lib/pricing";
import { isUuid } from "@/lib/menu-ids";
import { lineIdentity, type BasketLine, type ModifierSelection, type Restaurant } from "@/lib/types";

export type RequestedLine = {
  itemId: string;
  variationId: string | null;
  quantity: number;
  notes?: string | null;
  /** Option ids the customer picked, with how many of each. Prices ignored. */
  modifiers?: { optionId: string; quantity: number }[];
};

type Resolved = {
  lines: BasketLine[];
  /** Item ids that no longer exist in the menu. */
  unknown: string[];
};

/**
 * Re-prices a set of requested basket lines against the database.
 *
 * The client sends item ids, quantities and modifier *option ids* only — never
 * prices. Anything the browser claims to have paid is ignored here, so a
 * tampered payload cannot change what an order costs. That includes the
 * modifier deltas: `price_delta` always comes from the database row.
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
    .select(
      "id, source_id, name, base_price, is_available, menu_item_variations(id, source_id, name, price, is_available, modifier_group_variations(group_id, sort_order, modifier_groups(id, name, min_select, max_select, modifier_options(id, name, price_delta, is_available, sort_order))))"
    )
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

    const variations = (item.menu_item_variations ?? []) as VariationRow[];

    const variation = req.variationId
      ? variations.find((v) => v.id === req.variationId || v.source_id === req.variationId)
      : undefined;

    // A variation that has since been removed or disabled falls back to the
    // item's own base price rather than dropping the line.
    const useVariation = variation && variation.is_available !== false;
    const basePrice = useVariation
      ? Number(variation!.price)
      : Number(item.base_price ?? 0);
    const quantity = Math.max(1, Math.min(50, Math.floor(req.quantity) || 1));

    // Resolved against the database, so an option id the customer was never
    // offered cannot sneak in.
    const modifiers = useVariation
      ? resolveModifiers(variation!, req.modifiers ?? [])
      : [];

    const delta = modifiers.reduce((sum, m) => sum + m.priceDelta * m.quantity, 0);
    const unitPrice = round2(basePrice + delta);

    lines.push({
      id: lineIdentity(req.itemId, req.variationId ?? null, modifiers),
      // Always the database uuid, because this is what order_items.item_id
      // expects — the caller may have sent a source id.
      itemId: item.id as string,
      variationId: useVariation ? (variation!.id as string) : null,
      name: item.name as string,
      variationName: useVariation ? (variation!.name as string) : null,
      modifiers,
      unitPrice,
      quantity,
      notes: req.notes ? req.notes.slice(0, 500) : null,
      lineTotal: round2(unitPrice * quantity),
    });
  }

  return { lines, unknown };
}

type GroupRow = {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  modifier_options?: OptionRow[];
};

type OptionRow = {
  id: string;
  name: string;
  price_delta: number;
  is_available: boolean;
};

type VariationRow = {
  id: string;
  source_id: string | null;
  name: string;
  price: number;
  is_available: boolean;
  modifier_group_variations?: ({ group_id: string; sort_order: number; modifier_groups: GroupRow | null })[];
};

/**
 * Turns requested option ids into priced selections, dropping anything that
 * does not belong to this variation.
 *
 * The per-group min/max is re-applied here rather than trusted from the client,
 * so a payload asking for six sauces when one is allowed is quietly trimmed to
 * one. Under-shooting a minimum is not fatal — a required group left blank is
 * better handled by the UI, and the order still needs to be placeable.
 */
function resolveModifiers(
  variation: VariationRow,
  requested: { optionId: string; quantity: number }[]
): ModifierSelection[] {
  const links = variation.modifier_group_variations ?? [];
  if (!links.length || !requested.length) return [];

  // Group the requests by the option id, so repeated entries for one option
  // collapse into a single quantity.
  const wanted = new Map<string, number>();
  for (const r of requested) {
    if (!r || typeof r.optionId !== "string") continue;
    const qty = Math.max(0, Math.floor(Number(r.quantity)) || 0);
    if (qty === 0) continue;
    wanted.set(r.optionId, (wanted.get(r.optionId) ?? 0) + qty);
  }
  if (!wanted.size) return [];

  const selections: ModifierSelection[] = [];

  const ordered = [...links].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  for (const link of ordered) {
    const group = link.modifier_groups;
    if (!group || !Array.isArray(group.modifier_options)) continue;

    const max = Math.max(0, Number(group.max_select ?? 0));
    if (max === 0) continue;

    // Map option id -> the linked group, so we can enforce each group's own cap.
    const options = group.modifier_options.filter((o) => o.is_available !== false);
    const groupSelected: ModifierSelection[] = [];
    let remaining = max;

    for (const option of options) {
      const qty = wanted.get(option.id);
      if (!qty) continue;
      const take = Math.min(qty, remaining);
      if (take <= 0) break;
      groupSelected.push({
        groupId: group.id,
        optionId: option.id,
        groupName: group.name,
        optionName: option.name,
        quantity: take,
        priceDelta: Number(option.price_delta ?? 0) || 0,
      });
      remaining -= take;
    }

    // Required groups (min_select >= 1) that the customer left empty get filled
    // with their first available option, so the order matches what the kitchen
    // would otherwise have to guess.
    const min = Math.max(0, Number(group.min_select ?? 0));
    if (groupSelected.length < min && options.length) {
      const filler = options[0];
      if (!groupSelected.some((s) => s.optionId === filler.id)) {
        groupSelected.push({
          groupId: group.id,
          optionId: filler.id,
          groupName: group.name,
          optionName: filler.name,
          quantity: 1,
          priceDelta: Number(filler.price_delta ?? 0) || 0,
        });
      }
    }

    selections.push(...groupSelected);
  }

  return selections;
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