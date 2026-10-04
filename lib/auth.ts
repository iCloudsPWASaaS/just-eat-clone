import { supabase } from "@/lib/supabase";
import { siteUrl } from "@/lib/env";

export type AuthUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  role?: string;
  avatar?: string | null;
};

export type AuthResult = { ok: true } | { ok: false; error: string };

function describe(err: { message: string } | null): string {
  if (!err) return "Something went wrong. Please try again.";
  // Supabase's raw messages are terse and occasionally leak internals.
  const map: Record<string, string> = {
    "Invalid login credentials": "Incorrect email or password.",
    "User already registered": "An account with that email already exists.",
    "Email not confirmed": "Please confirm your email address before signing in.",
    "Password should be at least 6 characters.":
      "Your password needs to be at least 6 characters.",
  };
  return map[err.message] ?? err.message;
}

/**
 * Where an email link should send the recipient.
 *
 * `NEXT_PUBLIC_SITE_URL` wins so links always point at the deployed site even
 * when the request was made from localhost. Supabase only honours a
 * `redirectTo` that matches the project's allow-list, so when neither the env
 * var nor a browser is available we send `undefined` and let Supabase fall back
 * to the configured Site URL.
 */
function redirectBase(): string | undefined {
  return siteUrl() ?? (typeof window !== "undefined" ? window.location.origin : undefined);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const u = data.user;
  return {
    id: u.id,
    email: u.email || "",
    firstName: u.user_metadata?.firstName || null,
    lastName: u.user_metadata?.lastName || null,
    phone: u.user_metadata?.phone || null,
    role: u.user_metadata?.role || "customer",
    avatar: u.user_metadata?.avatar || null,
  };
}

export async function signup(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  marketingOptIn?: boolean;
}): Promise<AuthResult> {
  const base = redirectBase();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        marketingOptIn: input.marketingOptIn ?? false,
        role: "customer",
      },
      // Keep the user signed in straight after registering so they can go
      // straight to checkout without a second form.
      emailRedirectTo: base ? `${base}/account` : undefined,
    },
  });

  if (error) return { ok: false, error: describe(error) };

  // The `on_auth_user_created` trigger mirrors the row into justeat.profiles,
  // but do it here too so it works on projects where the trigger was skipped.
  if (data.user) {
    const { error: pErr } = await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        email: input.email,
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone ?? null,
        marketing_opt_in: input.marketingOptIn ?? false,
      },
      { onConflict: "id" }
    );
    if (pErr) console.error("[auth] profile upsert failed:", pErr.message);
  }

  return { ok: true };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: describe(error) };
  return { ok: true };
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const base = redirectBase();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: base ? `${base}/reset-password` : undefined,
  });
  if (error) return { ok: false, error: describe(error) };
  return { ok: true };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: describe(error) };
  return { ok: true };
}

export async function getProfile(): Promise<AuthUser | null> {
  return getCurrentUser();
}

export async function updateProfile(data: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  marketingOptIn?: boolean;
  pushOptIn?: boolean;
  smsOptIn?: boolean;
}): Promise<AuthResult> {
  const {
    data: { user },
    error,
  } = await supabase.auth.updateUser({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
    },
  });
  if (error) return { ok: false, error: describe(error) };
  if (!user) return { ok: true };

  // Keep the shadow profile in step with the auth metadata.
  const patch: Record<string, unknown> = {};
  if (data.firstName !== undefined) patch.first_name = data.firstName;
  if (data.lastName !== undefined) patch.last_name = data.lastName;
  if (data.phone !== undefined) patch.phone = data.phone;
  if (data.marketingOptIn !== undefined) patch.marketing_opt_in = data.marketingOptIn;
  if (data.pushOptIn !== undefined) patch.push_opt_in = data.pushOptIn;
  if (data.smsOptIn !== undefined) patch.sms_opt_in = data.smsOptIn;

  if (Object.keys(patch).length) {
    const { error: pErr } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (pErr) console.error("[auth] profile update failed:", pErr.message);
  }

  return { ok: true };
}
