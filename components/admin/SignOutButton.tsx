"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { logout } from "@/lib/auth";

/**
 * Signs the user out of the Supabase session shared with the shop front end, so
 * the admin console and `/account` both stop being authenticated.
 */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      // Replace rather than push: the admin pages are guarded server-side, so
      // going "back" would otherwise land on a redirect.
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="je-btn-secondary !py-2 text-xs disabled:opacity-50"
    >
      {busy ? "Signing out\u2026" : "Sign out"}
    </button>
  );
}
