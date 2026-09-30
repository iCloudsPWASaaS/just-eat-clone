/**
 * Shared Supabase configuration.
 *
 * The project keys itself on the newer Supabase naming
 * (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, e.g. `sb_publishable_...`) but older
 * templates in this workspace still set `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
 * Both are accepted so neither deployment style breaks.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  (() => {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  })();

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  (() => {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is not set"
    );
  })();

/** Every generated app gets its own Postgres schema, seeded into the env. */
export const SUPABASE_SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public";

/** Service-role key. Server/import scripts only — never expose to the client. */
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || null;
