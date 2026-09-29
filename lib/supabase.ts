import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Each generated app gets its own Postgres schema (app_<appId>) seeded into
// .env as NEXT_PUBLIC_SUPABASE_SCHEMA at scaffold time. Falls back to the
// project's default schema so pre-existing apps keep working unchanged.
// createBrowserClient (from @supabase/ssr) persists the session to cookies so
// middleware.ts's createServerClient can see it — plain createClient would
// keep it in localStorage only, and the middleware would 307-redirect every
// authenticated route back to /login.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public" },
  cookieOptions: { sameSite: "none", secure: true },
});
