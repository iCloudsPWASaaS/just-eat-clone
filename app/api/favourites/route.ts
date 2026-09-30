import { jsonError, jsonOk, requireUser } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { itemId } = (await req.json().catch(() => ({}))) as { itemId?: unknown };
  if (typeof itemId !== "string" || !itemId) {
    return jsonError("`itemId` is required.");
  }

  const { error } = await auth.supabase
    .from("favourites")
    .upsert({ user_id: auth.userId, item_id: itemId }, { onConflict: "user_id,item_id" });

  if (error) return jsonError(error.message, 500);
  return jsonOk({ ok: true, itemId, favourited: true });
}

export async function DELETE(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { itemId } = (await req.json().catch(() => ({}))) as { itemId?: unknown };
  if (typeof itemId !== "string" || !itemId) {
    return jsonError("`itemId` is required.");
  }

  const { error } = await auth.supabase
    .from("favourites")
    .delete()
    .eq("user_id", auth.userId)
    .eq("item_id", itemId);

  if (error) return jsonError(error.message, 500);
  return jsonOk({ ok: true, itemId, favourited: false });
}
