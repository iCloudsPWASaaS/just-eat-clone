import { supabase } from "@/lib/supabase";

export type AuthUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  role?: string;
  avatar?: string | null;
};

// Supabase-backed auth. The Mongo project variant (project-mongo/) is a fully
// separate template with its own lib/auth.ts calling the local API routes —
// the pages are identical, but nothing here is shared.
export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || "",
    firstName: user.user_metadata?.firstName || null,
    lastName: user.user_metadata?.lastName || null,
    phone: user.user_metadata?.phone || null,
    role: user.user_metadata?.role || "tenant",
    avatar: user.user_metadata?.avatar || null,
  };
}

export async function signup(input: { firstName: string; lastName: string; email: string; password: string }) {
  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { firstName: input.firstName, lastName: input.lastName, role: "tenant" } },
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function login(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getProfile(): Promise<AuthUser | null> {
  return getCurrentUser();
}

export async function updateProfile(data: { firstName?: string; lastName?: string; phone?: string; avatar?: string }) {
  const { error } = await supabase.auth.updateUser({ data });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
