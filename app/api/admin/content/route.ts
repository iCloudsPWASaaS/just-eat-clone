import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * CRUD for the ancillary content the site surfaces: deals, FAQs and opening
 * hours. The entity is selected with `type=deals|faqs|hours`.
 *
 * `hours` is the name the admin UI uses; the table it addresses is
 * `opening_hours`. Keeping the mapping here means the UI and the API can agree
 * on one public name without either knowing the table's name.
 */
const TABLES: Record<string, string> = {
  deals: "deals",
  faqs: "faqs",
  hours: "opening_hours",
  opening_hours: "opening_hours",
};

function tableFor(body: Record<string, unknown>, reqUrl?: string) {
  const t = body.type ?? (reqUrl ? new URL(reqUrl).searchParams.get("type") : null);
  if (typeof t !== "string") return null;
  return TABLES[t] ?? null;
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const table = tableFor({}, req.url);
  if (!table) return jsonError("`type` must be deals, faqs or hours.", 400);

  const col = table === "deals" ? "sort_order" : table === "faqs" ? "sort_order" : "day_of_week";
  const { data, error } = await admin.from(table).select("*").order(col);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ [table]: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const table = tableFor(body);
  if (!table) return jsonError("`type` must be deals, faqs or hours.", 400);

  const restId = await firstRestaurantId(admin);
  if (!restId) return jsonError("No restaurant configured.", 500);

  let payload: Record<string, unknown> = { restaurant_id: restId };
  if (table === "deals") {
    const title = String(body.title ?? "").trim();
    if (!title) return jsonError("`title` is required.");
    payload = {
      ...payload,
      title,
      subtitle: typeof body.subtitle === "string" ? body.subtitle.trim().slice(0, 200) : null,
      description: typeof body.description === "string" ? body.description.trim().slice(0, 500) : null,
      discount_type:
        typeof body.discountType === "string" && ["percentage", "fixed", "free_delivery", "bogo"].includes(body.discountType)
          ? body.discountType
          : "percentage",
      discount_value: Number(body.discountValue) || 0,
      min_order_value: Number(body.minOrderValue) || 0,
      badge: typeof body.badge === "string" ? body.badge.trim().slice(0, 40) : null,
      is_active: body.isActive !== false,
      sort_order: Number(body.sortOrder) || 0,
      starts_at: body.startsAt ? String(body.startsAt) : null,
      ends_at: body.endsAt ? String(body.endsAt) : null,
    };
  } else if (table === "faqs") {
    const question = String(body.question ?? "").trim();
    const answer = String(body.answer ?? "").trim();
    if (!question || !answer) return jsonError("`question` and `answer` are required.");
    payload = { ...payload, question: question.slice(0, 300), answer: answer.slice(0, 1000), sort_order: Number(body.sortOrder) || 0 };
  } else {
    payload = {
      ...payload,
      day_of_week: Math.min(6, Math.max(0, Number(body.dayOfWeek) || 0)),
      label: String(body.label ?? "").trim().slice(0, 30) || `Day ${body.dayOfWeek}`,
      open_time: typeof body.openTime === "string" && body.openTime ? body.openTime : null,
      close_time: typeof body.closeTime === "string" && body.closeTime ? body.closeTime : null,
      is_closed: body.isClosed === true,
    };
  }

  const { data, error } = await admin.from(table).insert(payload).select().single();
  if (error) return jsonError(error.message, 500);
  return jsonOk({ ok: true, row: data }, 201);
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const table = tableFor(body);
  if (!table) return jsonError("`type` must be deals, faqs or hours.", 400);
  const id = String(body.id ?? "");
  if (!id) return jsonError("`id` is required.");

  let patch: Record<string, unknown> = {};
  if (table === "deals") {
    if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 200);
    if (body.subtitle !== undefined) patch.subtitle = typeof body.subtitle === "string" ? body.subtitle.trim().slice(0, 200) : null;
    if (body.description !== undefined) patch.description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : null;
    if (typeof body.discountType === "string" && ["percentage", "fixed", "free_delivery", "bogo"].includes(body.discountType)) patch.discount_type = body.discountType;
    if (body.discountValue !== undefined) patch.discount_value = Number(body.discountValue) || 0;
    if (body.minOrderValue !== undefined) patch.min_order_value = Number(body.minOrderValue) || 0;
    if (body.badge !== undefined) patch.badge = typeof body.badge === "string" ? body.badge.trim().slice(0, 40) : null;
    if (body.isActive !== undefined) patch.is_active = body.isActive === true;
    if (body.sortOrder !== undefined) patch.sort_order = Number(body.sortOrder) || 0;
    if (body.startsAt !== undefined) patch.starts_at = body.startsAt ? String(body.startsAt) : null;
    if (body.endsAt !== undefined) patch.ends_at = body.endsAt ? String(body.endsAt) : null;
  } else if (table === "faqs") {
    if (typeof body.question === "string" && body.question.trim()) patch.question = body.question.trim().slice(0, 300);
    if (typeof body.answer === "string" && body.answer.trim()) patch.answer = body.answer.trim().slice(0, 1000);
    if (body.sortOrder !== undefined) patch.sort_order = Number(body.sortOrder) || 0;
  } else {
    if (body.dayOfWeek !== undefined) patch.day_of_week = Math.min(6, Math.max(0, Number(body.dayOfWeek) || 0));
    if (typeof body.label === "string" && body.label.trim()) patch.label = body.label.trim().slice(0, 30);
    if (body.openTime !== undefined) patch.open_time = typeof body.openTime === "string" && body.openTime ? body.openTime : null;
    if (body.closeTime !== undefined) patch.close_time = typeof body.closeTime === "string" && body.closeTime ? body.closeTime : null;
    if (body.isClosed !== undefined) patch.is_closed = body.isClosed === true;
  }

  const { error } = await admin.from(table).update(patch).eq("id", id);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const table = tableFor(body);
  if (!table) return jsonError("`type` must be deals, faqs or hours.", 400);
  const id = String(body.id ?? "");
  if (!id) return jsonError("`id` is required.");

  const { error } = await admin.from(table).delete().eq("id", id);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ ok: true });
}

async function firstRestaurantId(
  admin: ReturnType<typeof import("@/lib/admin").createAdminClient>
): Promise<string | null> {
  const { data } = await admin.from("restaurants").select("id").limit(1).maybeSingle();
  return data?.id ?? null;
}