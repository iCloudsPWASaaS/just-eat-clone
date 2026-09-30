import { jsonError, jsonOk, requireString } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const slugFor = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "item";

/** POST /api/admin/items — create a menu item. */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const categoryId = String(body.categoryId ?? "");
  const name = requireString(body, "name", { maxLength: 100 });
  if (!categoryId) return jsonError("`categoryId` is required.");
  if ("error" in name) return jsonError(name.error);

  const { data: cat, error: catErr } = await admin
    .from("menu_categories")
    .select("restaurant_id")
    .eq("id", categoryId)
    .maybeSingle();
  if (catErr) return jsonError(catErr.message, 500);
  if (!cat) return jsonError("Category not found.", 404);
  const restaurantId = cat.restaurant_id;

  const price = Number(body.basePrice);

  const { data, error } = await admin
    .from("menu_items")
    .insert({
      restaurant_id: restaurantId,
      category_id: categoryId,
      name: name.value,
      slug: slugFor(name.value),
      description: typeof body.description === "string" ? body.description.trim().slice(0, 500) : null,
      base_price: Number.isFinite(price) && price >= 0 ? price : 0,
      calories: body.calories === null || body.calories === undefined ? null : Number(body.calories) || null,
      is_vegetarian: body.isVegetarian === true,
      is_vegan: body.isVegan === true,
      is_halal: body.isHalal !== false,
      is_spicy: body.isSpicy === true,
      is_popular: body.isPopular === true,
      is_available: body.isAvailable !== false,
      sort_order: Number(body.sortOrder) || 0,
      image_url: typeof body.imageUrl === "string" ? body.imageUrl.trim().slice(0, 500) : null,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk({ item: data }, 201);
}