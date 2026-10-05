import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_SCHEMA, SUPABASE_URL } from "@/lib/env";

/**
 * Request-scoped Supabase client for Server Components and Route Handlers.
 *
 * Reads the auth session out of the cookie jar that @supabase/ssr's browser
 * client wrote. Always call this inside a request scope — the returned client
 * holds a reference to the per-request cookie store, so caching it in a module
 * variable leaks one visitor's session into another's request.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    db: { schema: SUPABASE_SCHEMA },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: CookieOptions;
        }[]
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Components cannot mutate cookies. Writes are refreshed by
          // the middleware, which runs with a mutable response, so swallowing
          // this is expected and safe.
        }
      },
    },
  });
}
