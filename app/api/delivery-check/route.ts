import { jsonError, jsonOk } from "@/lib/api";
import { getMenuData, checkDeliveryTo, normalisePostcode } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * GET /api/delivery-check?postcode=OX3%208RA
 *
 * Public: the postcode checker runs before sign-in, matching Just Eat's
 * "enter your postcode first" flow.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const postcode = searchParams.get("postcode") ?? "";

  if (!normalisePostcode(postcode)) {
    return jsonError("Enter a valid UK postcode.");
  }

  const { zones } = await getMenuData();
  const result = checkDeliveryTo(zones, postcode);

  return jsonOk({
    postcode: normalisePostcode(postcode),
    deliverable: result.deliverable,
    etaMinutes: result.etaMinutes,
    distanceKm: result.matched?.distanceKm ?? null,
  });
}
