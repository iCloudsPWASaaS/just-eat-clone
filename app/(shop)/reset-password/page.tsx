"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthCard, FormError, PasswordField } from "@/components/AuthForm";
import { updatePassword } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Phase = "checking" | "ready" | "invalid" | "saved";

/** Supabase error codes that arrive on the recovery redirect. */
const LINK_ERRORS: Record<string, string> = {
  otp_expired:
    "This reset link has expired or has already been used. A reset link can only be opened once.",
  access_denied:
    "This reset link is no longer valid. A reset link can only be opened once.",
  otp_disabled:
    "Password recovery is not available on this site. Please contact us and we will help.",
  verification_required: "Please verify your email address first, then reset your password.",
};

const GENERIC_LINK_ERROR = "This reset link is invalid or has expired.";

/**
 * Supabase puts the outcome in the query string when it bounces the user back,
 * and the browser client then mirrors it into the hash. Read both.
 */
function readLinkParams() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const pick = (key: string) => search.get(key) ?? hash.get(key);

  return {
    code: search.get("code") ?? hash.get("code"),
    errorCode: pick("error_code") ?? pick("error"),
  };
}

export default function ResetPasswordPage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fail = (code: string | null, detail?: string) => {
      if (cancelled) return;
      setLinkError((code && LINK_ERRORS[code]) || (detail && LINK_ERRORS[detail]) || GENERIC_LINK_ERROR);
      setPhase("invalid");
    };

    async function establishRecoverySession() {
      const { code, errorCode } = readLinkParams();

      if (errorCode) {
        fail(errorCode);
        return;
      }

      // PKCE links carry `?code=`; implicit links put tokens in the hash, which
      // the browser client consumes on its own.
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          fail(exchangeError.name, exchangeError.message);
          return;
        }
      }

      for (let attempt = 0; attempt < 20; attempt++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (!cancelled) setPhase("ready");
          return;
        }
        if (cancelled) return;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      fail(null);
    }

    establishRecoverySession();

    // The token is single-use, so drop it from the address bar to keep a refresh
    // from replaying an already-redeemed link.
    window.history.replaceState(null, "", window.location.pathname);

    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const errs: { password?: string; confirm?: string } = {};
    if (password.length < 6) errs.password = "Use at least 6 characters.";
    if (confirm !== password) errs.confirm = "Both passwords need to match.";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    setBusy(true);
    const res = await updatePassword(password);
    setBusy(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPassword("");
    setConfirm("");
    setPhase("saved");
  };

  if (phase === "checking") {
    return (
      <AuthCard title="Reset your password" subtitle="Checking your reset link\u2026">
        <p className="text-sm text-grey-dark">This will only take a moment.</p>
      </AuthCard>
    );
  }

  if (phase === "invalid") {
    return (
      <AuthCard
        title="That link no longer works"
        footer={
          <>
            Need another link?{" "}
            <Link href="/login" className="je-link font-semibold">
              Request a new one
            </Link>
          </>
        }
      >
        <div className="je-alert-error" role="alert">
          <p>{linkError}</p>
        </div>
        <p className="mt-4 text-sm text-grey-dark">
          Reset links expire after a short time and can only be opened once, so opening an
          old email or reloading the page will not work. Request a fresh link and open it in
          the same browser.
        </p>
      </AuthCard>
    );
  }

  if (phase === "saved") {
    return (
      <AuthCard
        title="Password updated"
        footer={
          <Link href="/account" className="je-link font-semibold">
            Go to your account
          </Link>
        }
      >
        <div className="je-alert-success">
          <p className="font-semibold">You&rsquo;re all set</p>
          <p className="mt-1">
            Your new password is active and you&rsquo;re still signed in on this device.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle="Pick something you haven&rsquo;t used before.">
      <form onSubmit={onSubmit} noValidate>
        <FormError message={error} />

        <div className="space-y-4">
          <PasswordField
            id="password"
            label="New password"
            value={password}
            onChange={setPassword}
            error={fieldErrors.password}
            autoComplete="new-password"
            hint="At least 6 characters."
          />
          <PasswordField
            id="confirm"
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            error={fieldErrors.confirm}
            autoComplete="new-password"
          />

          <button type="submit" disabled={busy} className="je-btn-primary je-btn-lg je-btn-block">
            {busy ? "Saving\u2026" : "Update password"}
          </button>
        </div>
      </form>
    </AuthCard>
  );
}
