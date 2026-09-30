/**
 * End-to-end smoke test for the admin console + customer order flows.
 *
 * Creates a throwaway admin user, signs in, exercises the admin APIs
 * (overview, menu, categories, content, orders + status transitions), places
 * a real order through the customer API and checks the status log, then
 * removes every row it created.
 *
 * Run with:  node --env-file=.env scripts/admin-smoke.mjs
 * Env:       ADMIN_SMOKE_URL  base URL of a running app (default http://localhost:3100)
 */
import { createClient } from "@supabase/supabase-js";

/** The cloud project ref — used for the auth-token cookie name. */
const REF =
  process.env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1] ??
  "idartbhlcbsefuhuvovs";
const COOKIE_NAME = `sb-${REF}-auth-token`;

const HOSTS = [
  process.env.ADMIN_SMOKE_URL,
  "http://localhost:3000",
  "http://localhost:3100",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3100",
].filter(Boolean);

/** Pick the first reachable server, so `npm run dev` on :3000 just works. */
async function findBaseUrl() {
  for (const base of HOSTS) {
    try {
      const res = await fetch(`${base}/`, { method: "HEAD", cache: "no-store" });
      if (res.status >= 200 && res.status < 500) {
        return base;
      }
    } catch {
      /* not this one */
    }
  }
  return null;
}

const EMAIL = `smoke-${Date.now()}@woodfarm.test`;
const PASSWORD = "Sm0ke!Test-pass-77";

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA }, auth: { persistSession: false } }
);

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { db: { schema: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA }, auth: { persistSession: false } }
);

let passed = 0;
let failed = 0;
function check(name, ok, extra = "") {
  if (ok) { passed++; console.log(`  \u2713 ${name}`); }
  else { failed++; console.log(`  \u2717 ${name}${extra ? ` \u2014 ${stringify(extra)}` : ""}`); }
}
function stringify(v) { return typeof v === "string" ? v : JSON.stringify(v); }

let APP_BASE = "";

async function api(path, init = {}) {
  const res = await fetch(`${APP_BASE}${path}`, {
    ...init,
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  APP_BASE = await findBaseUrl();
  if (!APP_BASE) {
    console.error(
      "Could not reach the app. Start it first, e.g.  npm run dev  (the script then auto-uses :3000)," +
        "\nor point it somewhere else with  ADMIN_SMOKE_URL=http://localhost:3000 npm run smoke:admin"
    );
    process.exit(2);
  }
  let userId = null;
  let orderId = null;
  let menuTotal = -1;

  try {
    console.log("BASE_URL:", APP_BASE);
    console.log("\n[1] Create admin user");
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    check("admin.createUser", !createErr && !!created?.user, createErr?.message);
    if (!created?.user) return;
    userId = created.user.id;

    // The handle_new_user trigger mirrored the row; promote it.
    const { error: promoteErr } = await service
      .from("profiles")
      .update({ is_admin: true })
      .eq("id", userId);
    check("profile promoted to admin", !promoteErr, promoteErr?.message);

    console.log("\n[2] Sign in and hit the admin APIs");
    const { data: session, error: signinErr } = await anon.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });
    check("signInWithPassword", !signinErr && !!session?.session, signinErr?.message);

    if (!session?.session) return;
    const cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(session.session))}`;
    const authHeaders = { Cookie: cookie };

    let r = await api("/api/admin/overview", { headers: authHeaders });
    check(
      "GET /api/admin/overview",
      r.status === 200 && r.body.menu?.categories >= 1 && typeof r.body.orders?.total === "number",
      r.status
    );
    menuTotal = r.body.menu?.items ?? 0;

    r = await api("/api/admin/menu", { headers: authHeaders });
    const cats = Array.isArray(r.body.categories) && r.body.categories.length
      ? r.body.categories
      : [];
    check("GET /api/admin/menu returns categories", r.status === 200 && cats.length >= 1, r.status);
    const picked = cats.find((c) => c.items?.length)?.items?.[0];
    check("menu has an item to order", !!picked, "no items");

    r = await api("/api/admin/categories", {
      method: "PATCH",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ id: cats[0].id, sortOrder: 5 }),
    });
    check("PATCH category (reorder)", r.status === 200, r.status);

    r = await api("/api/admin/content?type=deals", { headers: authHeaders });
    check("GET /api/admin/content?type=deals", r.status === 200 && Array.isArray(r.body.deals), r.status);

    r = await api("/api/admin/orders", { headers: authHeaders });
    check("GET /api/admin/orders", r.status === 200 && Array.isArray(r.body.orders), r.status);

    console.log("\n[3] Place a customer order (same user)");
    const variation = picked.variations?.[0] ?? null;
    const itemId = picked.id;
    const variationId = variation?.id ?? null;

    r = await api("/api/orders", {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: [{ itemId, variationId, quantity: 2, notes: "Smoke test" }],
        fulfilmentType: "delivery",
        address: {
          firstName: "Smoke",
          lastName: "Test",
          addressLine1: "1 Test Street",
          city: "Oxford",
          postcode: "OX3 8RA",
          deliveryNotes: "Smoke test order",
        },
        paymentMethod: "cash",
      }),
    });
    check(
      "POST /api/orders",
      (r.status === 200 || r.status === 201) && !!r.body.order?.reference,
      `${r.status} ${r.body?.error ?? ""}`
    );
    if (!r.body.order?.reference) return;
    const reference = r.body.order.reference;
    orderId = r.body.order.id;

    console.log("\n[4] Walk the status transitions");
    const transitions = ["confirmed", "preparing", "out_for_delivery", "delivered"];
    for (const next of transitions) {
      r = await api(`/api/admin/orders/${reference}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      check(`PATCH -> ${next}`, r.status === 200 && r.body.status === next, `${r.status} ${r.body?.error ?? ""}`);
    }

    r = await api(`/api/admin/orders/${reference}`, {
      method: "PATCH",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    check("PATCH rejected after delivery (409)", r.status === 409, `${r.status} ${r.body?.error ?? ""}`);

    r = await api("/api/admin/orders", { headers: authHeaders });
    const foundOrder = (r.body.orders ?? []).find((o) => o.reference === reference);
    check(
      "order listed + log recorded",
      !!foundOrder && (foundOrder.history ?? []).length >= 4,
      `${r.status} history=${foundOrder?.history?.length}`
    );

    r = await api("/api/admin/overview", { headers: authHeaders });
    check(
      "overview reflects the order",
      r.body.orders?.total >= 1 && (r.body.orders?.byStatus?.delivered ?? 0) >= 1,
      `${r.status} total=${r.body.orders?.total}`
    );

    console.log("\n[5] Customer order page renders with tracker + reorder source");
    const pageRes = await fetch(`${APP_BASE}/orders/${reference}`, { headers: authHeaders, cache: "no-store" });
    const html = await pageRes.text();
    check(
      "GET /orders/[reference]",
      pageRes.status === 200 &&
        html.includes("Order progress") &&
        html.includes(reference) &&
        html.includes("Delivered"),
      `status=${pageRes.status}`
    );

    // Ensure the un-authed world is still locked down.
    r = await api("/api/admin/overview");
    check("unauthenticated overview still 401", r.status === 401, `${r.status}`);
  } catch (e) {
    console.error("Script crashed:", e);
    failed++;
  } finally {
    console.log("\n[cleanup]");
    if (userId) {
      // Orders belong to the user; delete them before the auth user.
      const { data: rows } = await service.from("orders").select("id").eq("user_id", userId);
      const ids = (rows ?? []).map((r) => r.id);
      if (ids.length) {
        const { error } = await service.from("orders").delete().in("id", ids);
        check("deleted test orders", !error, error?.message);
      }
      const { error: delErr } = await service.auth.admin.deleteUser(userId);
      check("deleted test user", !delErr, delErr?.message);
    }
    if (menuTotal >= 0) {
      const { count } = await service
        .from("menu_items")
        .select("id", { count: "exact", head: true });
      check("menu item count unchanged", count === menuTotal, `count=${count} expected=${menuTotal}`);
    }
    console.log(`\nResult: ${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  }
}

main();