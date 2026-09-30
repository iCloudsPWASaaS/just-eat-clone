import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Returns the signed-in user's id, or a 401 response to send back.
 *
 * Route handlers are public endpoints, so every handler that touches
 * customer-owned data must call this first rather than trusting anything in
 * the request body.
 */
export async function requireUser(): Promise<
  { userId: string; supabase: ReturnType<typeof createClient> } | { response: NextResponse }
> {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { response: jsonError("You need to be signed in to do that.", 401) };
  }
  return { userId: user.id, supabase };
}

/** Reads a required string field from a JSON body. */
export function requireString(
  body: Record<string, unknown>,
  field: string,
  { maxLength = 500 }: { maxLength?: number } = {}
): { value: string } | { error: string } {
  const raw = body[field];
  if (typeof raw !== "string" || raw.trim() === "") {
    return { error: `\`${field}\` is required.` };
  }
  const value = raw.trim();
  if (value.length > maxLength) {
    return { error: `\`${field}\` must be ${maxLength} characters or fewer.` };
  }
  return { value };
}
