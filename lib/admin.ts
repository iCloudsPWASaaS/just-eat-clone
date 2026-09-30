import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/server";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SCHEMA,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "@/lib/env";

/**
 * Service-role client. Bypasses RLS — only ever construct this in server-side
 * code or one-off scripts (scripts/import.mjs), never in a client component.
 */
export function createAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required for privileged operations"
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: SUPABASE_SCHEMA },
  });
}

/**
 * Route-handler guard for /api/admin/*. Verifies the caller is a signed-in
 * user whose `justeat.profiles.is_admin` flag is set, then hands back a
 * service-role client for privileged work.
 *
 * Mark someone as an admin with:
 *   update justeat.profiles set is_admin = true where email = 'you@example.com';
 */
export async function requireAdmin(): Promise<
  | { userId: string; email: string; admin: ReturnType<typeof createAdminClient> }
  | { response: NextResponse }
> {
  const session = createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "You need to be signed in." }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data?.is_admin) {
    return { response: NextResponse.json({ error: "Not allowed." }, { status: 403 }) };
  }

  return { userId: user.id, email: user.email ?? "", admin };
}

/** Server-component guard for the /admin pages (redirect, not a response). */
export async function adminStatus(): Promise<
  { signedIn: false } | { signedIn: true; isAdmin: boolean }
> {
  const session = createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { signedIn: false };
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  return { signedIn: true, isAdmin: data?.is_admin === true };
}

/** Used by scripts/seed-users.mjs, which runs outside Next's env loading. */
export function adminKeyFromEnv(env: NodeJS.ProcessEnv) {
  return env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || null;
}

export { SUPABASE_PUBLISHABLE_KEY, SUPABASE_SCHEMA, SUPABASE_URL };
