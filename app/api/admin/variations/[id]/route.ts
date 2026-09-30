import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { isUuid } from "@/lib/menu-ids";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

/** PATCH /api/admin/variations/[id] — edit a size/portion variation. */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;
  const id = params.id;
  if (!isUuid(id)) return jsonError("Invalid variation id.", 400);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim().slice(0, 100);
  }
  if (body.price !== undefined) {
    const n = Number(body.price);
    patch.price = Number.isFinite(n) && n >= 0 ? n : 0;
  }
  if (body.calories !== undefined) {
    patch.calories =
      body.calories === null || body.calories === "" ? null : Number(body.calories) || null;
  }
  if (body.isAvailable !== undefined) patch.is_available = body.isAvailable === true;
  if (body.sortOrder !== undefined) patch.sort_order = Number(body.sortOrder) || 0;

  const { data, error } = await admin
    .from("menu_item_variations")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return jsonError(error.message, 500);
  return jsonOk({ variation: data });
}

/** DELETE /api/admin/variations/[id] — remove a variation. */
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;
  const id = params.id;
  if (!isUuid(id)) return jsonError("Invalid variation id.", 400);

  const { error } = await admin
    .from("menu_item_variations")
    .delete()
    .eq("id", id);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ ok: true });
}