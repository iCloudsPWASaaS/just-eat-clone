"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import Logo from "@/components/Logo";

/** Card shell shared by sign-in, register and password pages. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="je-container flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="je-card p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold text-grey-darkest">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-grey-dark">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-grey-dark">{footer}</div>}
      </div>
    </div>
  );
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p className="mt-1 text-xs font-medium text-red" role="alert">
      {children}
    </p>
  );
}

/** Inline form-level error banner. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="je-alert-error mb-4" role="alert">
      {message}
    </div>
  );
}

export function useRedirectAfterAuth() {
  const router = useRouter();
  const params = useSearchParams();
  return () => {
    // Only allow same-origin relative paths so `?next=` cannot be used as an
    // open redirect.
    const next = params.get("next");
    const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
    router.push(safe);
    router.refresh();
  };
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete = "current-password",
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  autoComplete?: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="je-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={`${error ? "je-error" : "je-input"} pr-16`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-button px-2 py-1 text-xs font-semibold text-blue hover:underline"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint && !error && <p className="mt-1 text-xs text-grey-dark">{hint}</p>}
      <FieldError>{error}</FieldError>
    </div>
  );
}

export { Link };
