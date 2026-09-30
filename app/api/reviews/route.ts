import { jsonError, jsonOk, requireUser } from "@/lib/api";
import { getMenuData } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * POST /api/reviews — post a rating for the restaurant.
 *
 * RLS pins `user_id` to the caller, so the client cannot post a review
 * impersonating somebody else.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { supabase, userId } = auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return jsonError("Choose a rating between 1 and 5 stars.");
  }

  const authorName =
    typeof body.authorName === "string" && body.authorName.trim()
      ? body.authorName.trim().slice(0, 60)
      : "Just Eat customer";

  const comment =
    typeof body.comment === "string" && body.comment.trim()
      ? body.comment.trim().slice(0, 2000)
      : null;
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 120)
      : null;

  if (!comment && !title) {
    return jsonError("Add a comment or a title to your review.");
  }

  const fulfilmentType =
    body.fulfilmentType === 1 || body.fulfilmentType === 2 ? Number(body.fulfilmentType) : null;

  const { restaurant } = await getMenuData();
  if (restaurant.id === "seed") {
    return jsonError("Reviews are unavailable until the database has been imported.", 503);
  }

  // Verified only if this customer actually has a delivered/collected order.
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["delivered", "collected"])
    .limit(1);

  const { error } = await supabase.from("reviews").insert({
    restaurant_id: restaurant.id,
    user_id: userId,
    author_name: authorName,
    rating,
    title,
    comment,
    fulfilment_type: fulfilmentType,
    is_verified_order: (orders?.length ?? 0) > 0,
  });

  if (error) return jsonError(error.message, 500);

  return jsonOk({ ok: true }, 201);
}
