import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_SCHEMA, SUPABASE_URL } from "@/lib/env";

// createBrowserClient (from @supabase/ssr) persists the session to cookies so
// middleware.ts's createServerClient can see it — plain createClient would keep
// it in localStorage only, and the middleware would 307-redirect every
// authenticated route back to /login.
export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: SUPABASE_SCHEMA },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
