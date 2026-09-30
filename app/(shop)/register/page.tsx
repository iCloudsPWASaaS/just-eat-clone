"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard, FormError, PasswordField, useRedirectAfterAuth } from "@/components/AuthForm";
import { signup } from "@/lib/auth";

/** Rough UK mobile check — good enough to catch typos before hitting Supabase. */
function isPlausiblePhone(v: string) {
  return /^(\+44|0)\d{9,10}$/.test(v.replace(/[\s()-]/g, ""));
}

export default function RegisterPage() {
  const redirect = useRedirectAfterAuth();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    marketingOptIn: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "Enter your first name.";
    if (!form.lastName.trim()) errs.lastName = "Enter your last name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Enter a valid email address.";
    if (form.phone && !isPlausiblePhone(form.phone)) {
      errs.phone = "Enter a valid UK phone number, e.g. 07700 900123.";
    }
    if (form.password.length < 8) {
      errs.password = "Your password must be at least 8 characters.";
    }
    if (form.password !== form.confirmPassword) {
      errs.confirmPassword = "The two passwords don't match.";
    }

    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setErrors({});
    setBusy(true);
    const res = await signup({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      password: form.password,
      phone: form.phone.trim() || undefined,
      marketingOptIn: form.marketingOptIn,
    });
    setBusy(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone(true);
    redirect();
  };

  if (done) {
    return (
      <AuthCard title="You're all set" subtitle="Taking you to your account…">
        <Link href="/account" className="je-btn-primary je-btn-lg je-btn-block">
          Go to your account
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Save your details for faster checkout and keep track of your orders."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="je-link font-semibold">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FormError message={error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="je-label">
              First name
            </label>
            <input
              id="firstName"
              className={errors.firstName ? "je-error" : "je-input"}
              value={form.firstName}
              onChange={(e) => set("firstName")(e.target.value)}
              autoComplete="given-name"
            />
            {errors.firstName && <p className="mt-1 text-xs font-medium text-red">{errors.firstName}</p>}
          </div>

          <div>
            <label htmlFor="lastName" className="je-label">
              Last name
            </label>
            <input
              id="lastName"
              className={errors.lastName ? "je-error" : "je-input"}
              value={form.lastName}
              onChange={(e) => set("lastName")(e.target.value)}
              autoComplete="family-name"
            />
            {errors.lastName && <p className="mt-1 text-xs font-medium text-red">{errors.lastName}</p>}
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="email" className="je-label">
            Email address
          </label>
          <input
            id="email"
            type="email"
            className={errors.email ? "je-error" : "je-input"}
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
            autoComplete="email"
          />
          {errors.email && <p className="mt-1 text-xs font-medium text-red">{errors.email}</p>}
        </div>

        <div className="mt-4">
          <label htmlFor="phone" className="je-label">
            Mobile number <span className="font-normal text-grey-midDark">(optional)</span>
          </label>
          <input
            id="phone"
            type="tel"
            className={errors.phone ? "je-error" : "je-input"}
            value={form.phone}
            onChange={(e) => set("phone")(e.target.value)}
            autoComplete="tel"
            placeholder="07700 900123"
          />
          {errors.phone && <p className="mt-1 text-xs font-medium text-red">{errors.phone}</p>}
        </div>

        <div className="mt-4 space-y-4">
          <PasswordField
            id="password"
            label="Create a password"
            value={form.password}
            onChange={set("password")}
            error={errors.password}
            autoComplete="new-password"
            hint="At least 8 characters."
          />
          <PasswordField
            id="confirmPassword"
            label="Confirm password"
            value={form.confirmPassword}
            onChange={set("confirmPassword")}
            error={errors.confirmPassword}
            autoComplete="new-password"
          />
        </div>

        <label className="mt-4 flex items-start gap-2 text-sm text-grey-dark">
          <input
            type="checkbox"
            checked={form.marketingOptIn}
            onChange={(e) => set("marketingOptIn")(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded accent-[#f36d00]"
          />
          <span>Email me offers and news from Woodfarm Kebab &amp; Pizza</span>
        </label>

        <button type="submit" disabled={busy} className="je-btn-primary je-btn-lg je-btn-block mt-6">
          {busy ? "Creating your account\u2026" : "Create account"}
        </button>

        <p className="mt-4 text-xs text-grey-midDark">
          By creating an account you agree to our terms of service and privacy policy.
        </p>
      </form>
    </AuthCard>
  );
}
