import { jsonOk } from "@/lib/api";
import { getMenuData } from "@/lib/data";

export const dynamic = "force-dynamic";

/** GET /api/menu — the full menu tree, optionally filtered by `?q=`. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  const { categories } = await getMenuData();

  if (!q) return jsonOk({ categories });

  const filtered = categories
    .map((c) => ({
      ...c,
      items: c.items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q)
      ),
    }))
    .filter((c) => c.items.length > 0);

  return jsonOk({ categories: filtered, query: q });
}
