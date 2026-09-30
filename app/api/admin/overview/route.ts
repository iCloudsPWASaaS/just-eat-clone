import { jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/overview — headline numbers for the admin dashboard:
 * order counts by status, revenue, and menu size.
 */
export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const [{ data: orders }, { data: cats }, { data: items }, { data: recent }] =
    await Promise.all([
      admin.from("orders").select("status, total, placed_at"),
      admin.from("menu_categories").select("id"),
      admin.from("menu_items").select("id, is_available"),
      admin
        .from("orders")
        .select(
          "reference, status, fulfilment_type, total, placed_at, delivery_address"
        )
        .order("placed_at", { ascending: false })
        .limit(5),
    ]);

  const statusCounts = {} as Record<OrderStatus, number>;
  let revenue = 0;
  let today = 0;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  for (const o of orders ?? []) {
    const s = o.status as OrderStatus;
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    const paid: Record<string, boolean> = {
      confirmed: true,
      preparing: true,
      out_for_delivery: true,
      collected: true,
      delivered: true,
    };
    if (paid[s]) revenue += Number(o.total ?? 0);
    if (new Date(o.placed_at) >= startOfDay) today++;
  }

  return jsonOk({
    orders: {
      total: orders?.length ?? 0,
      today,
      byStatus: statusCounts,
      revenue: Math.round(revenue * 100) / 100,
    },
    menu: {
      categories: cats?.length ?? 0,
      items: items?.length ?? 0,
      activeItems: (items ?? []).filter((i) => i.is_available).length,
    },
    recent: recent ?? [],
  });
}