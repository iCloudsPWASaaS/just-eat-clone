import { jsonError, jsonOk, requireString } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "category";

/** POST /api/admin/categories — create a category. */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = requireString(body, "name", { maxLength: 80 });
  if ("error" in name) return jsonError(name.error);

  // Ensure a unique slug within this restaurant, e.g. "drinks-2".
  const base = slugify(name.value);
  let slug = base;
  for (let n = 2; n < 1000; n++) {
    const { data, error } = await admin
      .from("menu_categories")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error) return jsonError(error.message, 500);
    if (!data) break;
    slug = `${base}-${n}`;
  }

  const { data, error } = await admin
    .from("menu_categories")
    .insert({
      name: name.value,
      slug,
      description: typeof body.description === "string" ? body.description.trim().slice(0, 300) : null,
      image_url: typeof body.imageUrl === "string" ? body.imageUrl.trim().slice(0, 500) : null,
      sort_order: Number(body.sortOrder) || 0,
      is_featured: body.isFeatured === true,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk({ category: data }, 201);
}

/** PATCH /api/admin/categories — update a category (renaming rolls the slug). */
export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id ?? "");
  if (!id) return jsonError("`id` is required.");

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim().slice(0, 80);
    patch.slug = slugify(patch.name as string);
  }
  if (body.description !== undefined) {
    patch.description =
      typeof body.description === "string" ? body.description.trim().slice(0, 300) : null;
  }
  if (body.imageUrl !== undefined) {
    patch.image_url = typeof body.imageUrl === "string" ? body.imageUrl.trim().slice(0, 500) : null;
  }
  if (body.sortOrder !== undefined) patch.sort_order = Number(body.sortOrder) || 0;
  if (body.isFeatured !== undefined) patch.is_featured = body.isFeatured === true;

  const { data, error } = await admin
    .from("menu_categories")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return jsonError(error.message, 500);
  return jsonOk({ category: data });
}

/** DELETE /api/admin/categories — remove a category (and its items). */
export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id ?? "");
  if (!id) return jsonError("`id` is required.");

  const { error } = await admin.from("menu_categories").delete().eq("id", id);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ ok: true });
}