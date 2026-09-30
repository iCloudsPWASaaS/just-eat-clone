import { jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/menu — the full catalogue tree (categories → items →
 * variations) in one request, for the menu editor.
 */
export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const { data, error } = await admin
    .from("menu_categories")
    .select(
      "*, menu_items(*, menu_item_variations(*))"
    )
    .order("sort_order")
    .order("sort_order", { referencedTable: "menu_items" })
    .order("sort_order", { referencedTable: "menu_items.menu_item_variations" });

  if (error) return jsonOk({ categories: [], error: error.message });

  type RawVariation = {
    id: string; source_id: string | null; name: string; display_name: string | null;
    price: number; calories: number | null; is_available: boolean; sort_order: number;
  };
  type RawItem = {
    id: string; source_id: string | null; category_id: string; name: string; slug: string;
    description: string | null; image_url: string | null; calories: number | null;
    base_price: number; is_vegetarian: boolean; is_vegan: boolean; is_halal: boolean;
    is_spicy: boolean; is_popular: boolean; is_available: boolean; sort_order: number;
    menu_item_variations: RawVariation[];
  };
  type RawCategory = {
    id: string; source_id: string | null; name: string; slug: string; description: string | null;
    image_url: string | null; sort_order: number; is_featured: boolean; menu_items: RawItem[];
  };

  const categories = ((data ?? []) as RawCategory[]).map((c) => ({
    id: c.id,
    sourceId: c.source_id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.image_url,
    sortOrder: c.sort_order,
    isFeatured: c.is_featured,
    items: (c.menu_items ?? []).map((i) => ({
      id: i.id,
      sourceId: i.source_id,
      categoryId: i.category_id,
      name: i.name,
      slug: i.slug,
      description: i.description,
      imageUrl: i.image_url,
      calories: i.calories,
      basePrice: Number(i.base_price),
      isVegetarian: i.is_vegetarian,
      isVegan: i.is_vegan,
      isHalal: i.is_halal,
      isSpicy: i.is_spicy,
      isPopular: i.is_popular,
      isAvailable: i.is_available,
      sortOrder: i.sort_order,
      variations: (i.menu_item_variations ?? []).map((v) => ({
        id: v.id,
        sourceId: v.source_id,
        name: v.name,
        displayName: v.display_name,
        price: Number(v.price),
        calories: v.calories,
        isAvailable: v.is_available,
        sortOrder: v.sort_order,
      })),
    })),
  }));

  return jsonOk({ categories });
}