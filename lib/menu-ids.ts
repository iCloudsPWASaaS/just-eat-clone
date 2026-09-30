import { createClient } from "@/lib/server";

/**
 * The site can render straight from the JSON in /data before Supabase has been
 * seeded, and in that mode menu ids are the upstream `sourceId` strings
 * (e.g. "251448461", "251448461-0") rather than database UUIDs. Any code that
 * writes those ids into a uuid column has to translate them first.
 *
 * These helpers do that lookup once, keyed by whatever the caller used.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Splits ids into the ones that are already uuids and the ones needing lookup. */
function partition(ids: string[]): { uuids: string[]; sources: string[] } {
  const uuids: string[] = [];
  const sources: string[] = [];
  for (const id of ids) {
    if (!id) continue;
    (isUuid(id) ? uuids : sources).push(id);
  }
  return { uuids, sources };
}

/**
 * Maps every supplied item id to its database uuid. Ids that are already uuids
 * pass through unchanged, so this is safe to call unconditionally.
 */
export async function resolveItemIds(ids: string[]): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  for (const id of ids) if (id) resolved.set(id, id);

  const { uuids, sources } = partition(ids);
  if (!sources.length) return resolved;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, source_id")
    .in("source_id", sources);
  if (error) throw new Error(`menu_items source lookup failed: ${error.message}`);

  for (const row of data ?? []) {
    if (row.source_id) resolved.set(row.source_id as string, row.id as string);
  }
  return resolved;
}

/** Same as {@link resolveItemIds} for variation ids. */
export async function resolveVariationIds(ids: string[]): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  for (const id of ids) if (id) resolved.set(id, id);

  const { sources } = partition(ids);
  if (!sources.length) return resolved;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("menu_item_variations")
    .select("id, source_id")
    .in("source_id", sources);
  if (error) throw new Error(`menu_item_variations source lookup failed: ${error.message}`);

  for (const row of data ?? []) {
    if (row.source_id) resolved.set(row.source_id as string, row.id as string);
  }
  return resolved;
}
