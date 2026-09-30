/** Thin fetch wrapper for the admin APIs — throws on non-2xx with the
 * server's `error` message when present. */
export async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((json.error as string) ?? `Request failed (${res.status})`);
  }
  return json as T;
}