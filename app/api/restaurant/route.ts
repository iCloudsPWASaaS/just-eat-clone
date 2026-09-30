import { jsonOk } from "@/lib/api";
import { getMenuData } from "@/lib/data";

export const dynamic = "force-dynamic";

/** GET /api/restaurant — public restaurant profile, hours, zones and FAQs. */
export async function GET() {
  const data = await getMenuData();
  return jsonOk({
    restaurant: data.restaurant,
    hours: data.hours,
    zones: data.zones,
    faqs: data.faqs,
    deals: data.deals,
  });
}
