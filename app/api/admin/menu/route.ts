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
      "*, menu_items(*, menu_item_variations(*, modifier_group_variations(*, modifier_groups(*, modifier_options(*)))))"
    )
    .order("sort_order")
    .order("sort_order", { referencedTable: "menu_items" })
    .order("sort_order", { referencedTable: "menu_items.menu_item_variations" })
    .order("sort_order", { referencedTable: "menu_items.menu_item_variations.modifier_group_variations" })
    .order("sort_order", { referencedTable: "menu_items.menu_item_variations.modifier_group_variations.modifier_groups.modifier_options" });

  if (error) return jsonOk({ categories: [], error: error.message });

  // A group is normally shared by many variations ("Choose Your Salad" is
  // linked to 41 of them), so editing one changes every item that uses it.
  // The editor needs the counts to warn before that happens.
  const { data: allLinks } = await admin.from("modifier_group_variations").select("group_id");
  const linkCounts: Record<string, number> = {};
  for (const l of allLinks ?? []) {
    linkCounts[l.group_id] = (linkCounts[l.group_id] ?? 0) + 1;
  }

  type RawOption = {
    id: string; group_id: string; name: string; description: string | null;
    price_delta: number; is_available: boolean; sort_order: number;
  };
  type RawGroup = {
    id: string; restaurant_id: string; source_id: string | null; name: string;
    description: string | null; min_select: number; max_select: number; sort_order: number;
    modifier_options: RawOption[] | null;
  };
  type RawLink = { group_id: string; variation_id: string; sort_order: number; modifier_groups: RawGroup | null };
  type RawVariation = {
    id: string; source_id: string | null; name: string; display_name: string | null;
    price: number; calories: number | null; is_available: boolean; sort_order: number;
    modifier_group_variations: RawLink[] | null;
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
        modifierGroups: (v.modifier_group_variations ?? []).map((l) => {
          const g = l.modifier_groups;
          return {
            id: g?.id ?? l.group_id,
            name: g?.name ?? "",
            description: g?.description ?? null,
            minSelect: Number(g?.min_select ?? 0),
            maxSelect: Number(g?.max_select ?? 1),
            sortOrder: Number(g?.sort_order ?? l.sort_order ?? 0),
            variationCount: linkCounts[g?.id ?? l.group_id] ?? 1,
            options: (g?.modifier_options ?? []).map((o) => ({
              id: o.id,
              name: o.name,
              description: o.description ?? null,
              priceDelta: Number(o.price_delta ?? 0),
              isAvailable: o.is_available,
              sortOrder: o.sort_order,
            })),
          };
        }),
      })),
    })),
  }));

  return jsonOk({ categories });
}