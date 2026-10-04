"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard, FormError, PasswordField, useRedirectAfterAuth } from "@/components/AuthForm";
import { login, requestPasswordReset } from "@/lib/auth";

export default function LoginPage() {
  const redirect = useRedirectAfterAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errs: { email?: string; password?: string } = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Enter your password.";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    setBusy(true);
    const res = await login(email.trim(), password);
    setBusy(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    redirect();
  };

  const onForgot = async () => {
    // Supabase enforces a project-wide hourly send cap, so a double-click here
    // can burn the whole quota. Refuse repeats once one is in flight or sent.
    if (resetBusy || resetSent) return;

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFieldErrors({ email: "Enter your email address first, then choose Forgot password." });
      return;
    }

    setResetBusy(true);
    setError(null);
    const res = await requestPasswordReset(email.trim());
    setResetBusy(false);

    if (res.ok) setResetSent(true);
    else setError(res.error);
  };

  return (
    <AuthCard
      title="Sign in"
      subtitle="Access your orders, addresses and saved favourites."
      footer={
        <>
          New to Just Eat?{" "}
          <Link href="/register" className="je-link font-semibold">
            Create an account
          </Link>
        </>
      }
    >
      {resetSent ? (
        <div className="je-alert-success">
          <p className="font-semibold">Check your inbox</p>
          <p className="mt-1">
            If an account exists for <strong>{email}</strong>, we&rsquo;ve sent a link to
            reset your password.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <FormError message={error} />

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="je-label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                className={fieldErrors.email ? "je-error" : "je-input"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs font-medium text-red" role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <PasswordField
              id="password"
              label="Password"
              value={password}
              onChange={setPassword}
              error={fieldErrors.password}
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-grey-dark">
                <input type="checkbox" className="h-4 w-4 rounded accent-[#f36d00]" />
                Keep me signed in
              </label>
              <button
                type="button"
                onClick={onForgot}
                disabled={resetBusy || resetSent}
                className="text-sm font-semibold text-blue hover:underline disabled:cursor-not-allowed disabled:text-grey-midDark disabled:no-underline"
              >
                {resetBusy ? "Sending\u2026" : resetSent ? "Link sent" : "Forgot password?"}
              </button>
            </div>

            <button type="submit" disabled={busy} className="je-btn-primary je-btn-lg je-btn-block">
              {busy ? "Signing in\u2026" : "Sign in"}
            </button>
          </div>
        </form>
      )}
    </AuthCard>
  );
}
