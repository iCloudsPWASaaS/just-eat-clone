import { jsonError, jsonOk, requireUser } from "@/lib/api";
import { getOrderByReference } from "@/lib/data";

export const dynamic = "force-dynamic";

/** GET /api/orders/[reference] — a single order belonging to the caller. */
export async function GET(
  _req: Request,
  { params }: { params: { reference: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const order = await getOrderByReference(auth.userId, params.reference);
  if (!order) return jsonError("Order not found.", 404);

  return jsonOk({ order });
}
