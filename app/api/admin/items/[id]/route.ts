import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { isUuid } from "@/lib/menu-ids";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const ITEM_FIELDS = [
  "name",
  "categoryId",
  "description",
  "basePrice",
  "calories",
  "imageUrl",
  "isVegetarian",
  "isVegan",
  "isHalal",
  "isSpicy",
  "isPopular",
  "isAvailable",
  "sortOrder",
] as const;

/** PATCH /api/admin/items/[id] — edit an item and (optionally) its variations. */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;
  const id = params.id;
  if (!isUuid(id)) return jsonError("Invalid item id.", 400);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  for (const f of ITEM_FIELDS) {
    if (!(f in body)) continue;
    switch (f) {
      case "name":
        if (typeof body[f] === "string" && body[f].trim()) patch.name = body[f].trim().slice(0, 100);
        break;
      case "categoryId":
        if (typeof body[f] === "string" && isUuid(body[f])) patch.category_id = body[f];
        break;
      case "description":
        patch.description =
          typeof body[f] === "string" ? body[f].trim().slice(0, 500) : null;
        break;
      case "basePrice": {
        const n = Number(body[f]);
        patch.base_price = Number.isFinite(n) && n >= 0 ? n : 0;
        break;
      }
      case "calories":
        patch.calories =
          body[f] === null || body[f] === undefined || body[f] === "" ? null : Number(body[f]) || null;
        break;
      case "imageUrl":
        patch.image_url = typeof body[f] === "string" ? body[f].trim().slice(0, 500) : null;
        break;
      default:
        patch[f === "isVegetarian" ? "is_vegetarian" : f === "isVegan" ? "is_vegan" : f === "isHalal" ? "is_halal" : f === "isSpicy" ? "is_spicy" : f === "isPopular" ? "is_popular" : f === "isAvailable" ? "is_available" : "sort_order"] =
          f === "sortOrder"
            ? Number(body[f]) || 0
            : body[f] === true;
    }
  }

  const { error } = await admin.from("menu_items").update(patch).eq("id", id);
  if (error) return jsonError(error.message, 500);

  // Variations are upserted by uuid: rows that carry an existing id are
  // updated, new ones are inserted. Nothing is auto-deleted here so a live
  // basket or order never references a vanished variation.
  if (Array.isArray(body.variations)) {
    for (const v of body.variations as Record<string, unknown>[]) {
      const vname = String(v.name ?? "").trim().slice(0, 100);
      if (!vname) continue;
      const vprice = Number(v.price);
      const vpayload = {
        name: vname,
        price: Number.isFinite(vprice) && vprice >= 0 ? vprice : 0,
        is_available: v.isAvailable !== false,
        sort_order: Number(v.sortOrder) || 0,
        calories: v.calories === null || v.calories === undefined || v.calories === "" ? null : Number(v.calories) || null,
      };
      if (isUuid(String(v.id))) {
        const { error: upErr } = await admin
          .from("menu_item_variations")
          .update(vpayload)
          .eq("id", String(v.id));
        if (upErr) return jsonError(upErr.message, 500);
      } else {
        const { error: inErr } = await admin
          .from("menu_item_variations")
          .insert({ item_id: id, ...vpayload });
        if (inErr) return jsonError(inErr.message, 500);
      }
    }
  }

  return jsonOk({ ok: true });
}

/** DELETE /api/admin/items/[id] — remove an item (variations cascade). */
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;
  const id = params.id;
  if (!isUuid(id)) return jsonError("Invalid item id.", 400);

  const { error } = await admin.from("menu_items").delete().eq("id", id);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ ok: true });
}