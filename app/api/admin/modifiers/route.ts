import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { isUuid } from "@/lib/menu-ids";

export const dynamic = "force-dynamic";

/**
 * Modifier groups ("Choose Your Sauce") are shared across many variations, so
 * editing one is a catalogue-wide change rather than a per-dish change. The
 * PATCH handler below therefore distinguishes `detachedVariationIds` (narrow
 * intent: stop this one dish offering the group) from a group rename or an
 * option price, which apply everywhere the group is linked.
 */

/** Reads the min/max pair, clamped to a range the picker can actually render. */
function readLimits(body: Record<string, unknown>) {
  const min = Math.max(0, Math.floor(Number(body.minSelect) || 0));
  const max = Math.min(99, Math.max(1, Math.floor(Number(body.maxSelect) || 1)));
  return { minSelect: Math.min(min, max), maxSelect: max };
}

/** POST /api/admin/modifiers — attach an existing group, or create one new. */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const variationId = String(body.variationId ?? "");
  if (!isUuid(variationId)) return jsonError("Invalid variationId.", 400);

  // Attaching an existing group by id — the common case, since the 13 imported
  // groups are already linked to most of the menu.
  if (body.groupId) {
    const groupId = String(body.groupId);
    if (!isUuid(groupId)) return jsonError("Invalid groupId.", 400);
    const { data: link, error: linkErr } = await admin
      .from("modifier_group_variations")
      .insert({ group_id: groupId, variation_id: variationId, sort_order: Number(body.sortOrder) || 0 })
      .select()
      .maybeSingle();
    if (linkErr) {
      // The primary key is (group_id, variation_id), so a double attach means
      // the picker is already offered here. That is the state the caller wanted.
      if (linkErr.code === "23505") return jsonOk({ ok: true, linked: true, alreadyLinked: true });
      return jsonError(linkErr.message, 500);
    }
    if (!link) return jsonError("Could not attach that group to this dish.", 400);
    return jsonOk({ ok: true, linked: true });
  }

  // Creating a brand new group for this dish.
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (!name) return jsonError("`name` is required.", 400);

  const { data: variation } = await admin
    .from("menu_item_variations")
    .select("item_id")
    .eq("id", variationId)
    .maybeSingle();
  if (!variation) return jsonError("That size no longer exists.", 404);

  const { data: item } = await admin
    .from("menu_items")
    .select("restaurant_id")
    .eq("id", variation.item_id)
    .maybeSingle();
  if (!item) return jsonError("That dish no longer exists.", 404);

  const { minSelect, maxSelect } = readLimits(body);

  const { data: group, error } = await admin
    .from("modifier_groups")
    .insert({
      restaurant_id: item.restaurant_id,
      // A group created here has no counterpart in the source payload, so
      // source_id stays null. A re-import will not overwrite or duplicate it.
      source_id: null,
      name,
      description: typeof body.description === "string" ? body.description.trim().slice(0, 300) : null,
      min_select: minSelect,
      max_select: maxSelect,
      sort_order: Number(body.sortOrder) || 0,
    })
    .select()
    .single();
  if (error) return jsonError(error.message, 500);

  const { error: linkErr } = await admin
    .from("modifier_group_variations")
    .insert({ group_id: group.id, variation_id: variationId, sort_order: Number(body.sortOrder) || 0 });
  if (linkErr) return jsonError(linkErr.message, 500);

  return jsonOk({ ok: true, groupId: group.id });
}

/**
 * PATCH /api/admin/modifiers — rename a group, retune its limits, or edit its
 * options. `options` is upserted by id and options missing from the array are
 * detached rather than deleted, so a basket or past order that referenced one
 * keeps a resolvable row.
 */
export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const groupId = String(body.groupId ?? "");
  if (!isUuid(groupId)) return jsonError("Invalid groupId.", 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim().slice(0, 100);
  }
  if (body.description !== undefined) {
    patch.description = typeof body.description === "string" ? body.description.trim().slice(0, 300) : null;
  }
  if (body.minSelect !== undefined || body.maxSelect !== undefined) {
    const { data: existing } = await admin
      .from("modifier_groups")
      .select("min_select, max_select")
      .eq("id", groupId)
      .maybeSingle();
    if (!existing) return jsonError("That modifier group no longer exists.", 404);
    const limits = readLimits({
      minSelect: body.minSelect ?? existing.min_select,
      maxSelect: body.maxSelect ?? existing.max_select,
    });
    patch.min_select = limits.minSelect;
    patch.max_select = limits.maxSelect;
  }
  if (body.sortOrder !== undefined) patch.sort_order = Number(body.sortOrder) || 0;

  if (Object.keys(patch).length) {
    const { error } = await admin.from("modifier_groups").update(patch).eq("id", groupId);
    if (error) return jsonError(error.message, 500);
  }

  if (Array.isArray(body.options)) {
    const options = body.options as Record<string, unknown>[];
    const keptIds = new Set<string>();

    for (const o of options) {
      const oname = typeof o.name === "string" ? o.name.trim().slice(0, 100) : "";
      if (!oname) continue;
      const delta = Number(o.priceDelta);
      const opayload = {
        name: oname,
        description: typeof o.description === "string" ? o.description.trim().slice(0, 200) : null,
        price_delta: Number.isFinite(delta) ? Math.max(0, delta) : 0,
        is_available: o.isAvailable !== false,
        sort_order: Number(o.sortOrder) || 0,
      };
      const oid = String(o.id ?? "");
      if (isUuid(oid)) {
        // Re-scope to this group in case an option was moved between pickers.
        const { error: upErr } = await admin
          .from("modifier_options")
          .update({ ...opayload, group_id: groupId })
          .eq("id", oid);
        if (upErr) {
          if (upErr.code === "23505") {
            return jsonError(`Another option in this group is already called "${oname}".`, 400);
          }
          return jsonError(upErr.message, 500);
        }
        keptIds.add(oid);
      } else {
        const { data: ins, error: inErr } = await admin
          .from("modifier_options")
          .insert({ group_id: groupId, ...opayload })
          .select("id")
          .single();
        if (inErr) {
          // unique (group_id, name): the admin typed a name that already exists.
          if (inErr.code === "23505") {
            return jsonError(`"${oname}" is already in this group.`, 400);
          }
          return jsonError(inErr.message, 500);
        }
        keptIds.add(ins.id);
      }
    }

    // Soft-remove the ones left out, so historical baskets still resolve the
    // option id but customers stop being offered it.
    if (body.removeMissingOptions === true) {
      const { data: existing } = await admin.from("modifier_options").select("id").eq("group_id", groupId);
      const stale = (existing ?? []).map((o) => o.id).filter((oid) => !keptIds.has(oid));
      if (stale.length) {
        const { error: rmErr } = await admin
          .from("modifier_options")
          .update({ is_available: false })
          .in("id", stale);
        if (rmErr) return jsonError(rmErr.message, 500);
      }
    }
  }

  // Detaching only removes this dish from the group; the group and its options
  // stay intact for the other variations that share them.
  if (Array.isArray(body.detachedVariationIds)) {
    const ids = (body.detachedVariationIds as unknown[]).filter((v): v is string => isUuid(String(v)));
    if (ids.length) {
      const { error } = await admin
        .from("modifier_group_variations")
        .delete()
        .eq("group_id", groupId)
        .in("variation_id", ids);
      if (error) return jsonError(error.message, 500);
    }
  }

  return jsonOk({ ok: true });
}

/**
 * DELETE /api/admin/modifiers — remove the group itself. Refuses while other
 * variations still link to it, since deleting it would silently strip
 * customisations from every one of those dishes.
 */
export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const groupId = String(body.groupId ?? "");
  if (!isUuid(groupId)) return jsonError("Invalid groupId.", 400);

  const { count } = await admin
    .from("modifier_group_variations")
    .select("group_id", { count: "exact", head: true })
    .eq("group_id", groupId);
  if ((count ?? 0) > 1) {
    return jsonError(
      `That group is still offered on ${count} other dishes. Detach it from them first, then delete it.`,
      400
    );
  }

  const { error } = await admin.from("modifier_groups").delete().eq("id", groupId);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ ok: true });
}