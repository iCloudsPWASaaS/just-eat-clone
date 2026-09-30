"use client";

import { useState } from "react";
import { logout, updateProfile, updatePassword, type AuthUser } from "@/lib/auth";

export default function ProfileClient({ user }: { user: AuthUser }) {
  const [form, setForm] = useState({
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    phone: user.phone ?? "",
    marketingOptIn: false,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const set = (k: keyof typeof form) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    const res = await updateProfile({
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      marketingOptIn: form.marketingOptIn,
    });
    setSaving(false);
    setMessage(
      res.ok
        ? { kind: "ok", text: "Your details have been saved." }
        : { kind: "err", text: res.error }
    );
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);

    if (passwords.next.length < 8) {
      setPwMessage({ kind: "err", text: "Your new password must be at least 8 characters." });
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPwMessage({ kind: "err", text: "The two new passwords don't match." });
      return;
    }

    setPwSaving(true);
    const res = await updatePassword(passwords.next);
    setPwSaving(false);

    if (res.ok) {
      setPasswords({ current: "", next: "", confirm: "" });
      setPwMessage({ kind: "ok", text: "Your password has been changed." });
    } else {
      setPwMessage({ kind: "err", text: res.error });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={onSaveProfile} noValidate className="je-card p-5">
        <h2 className="text-lg font-extrabold text-grey-darkest">Your details</h2>

        {message && (
          <div className={`mt-3 ${message.kind === "ok" ? "je-alert-success" : "je-alert-error"}`}>
            {message.text}
          </div>
        )}

        <div className="mt-4">
          <label htmlFor="email" className="je-label">
            Email address
          </label>
          <input id="email" className="je-input bg-grey-lighter" value={user.email} disabled />
          <p className="mt-1 text-xs text-grey-midDark">
            Contact support to change the email on your account.
          </p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="je-label">
              First name
            </label>
            <input
              id="firstName"
              className="je-input"
              value={form.firstName}
              onChange={(e) => set("firstName")(e.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="je-label">
              Last name
            </label>
            <input
              id="lastName"
              className="je-input"
              value={form.lastName}
              onChange={(e) => set("lastName")(e.target.value)}
              autoComplete="family-name"
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="phone" className="je-label">
            Mobile number
          </label>
          <input
            id="phone"
            type="tel"
            className="je-input"
            value={form.phone}
            onChange={(e) => set("phone")(e.target.value)}
            autoComplete="tel"
          />
        </div>

        <label className="mt-4 flex items-start gap-2 text-sm text-grey-dark">
          <input
            type="checkbox"
            checked={form.marketingOptIn}
            onChange={(e) => set("marketingOptIn")(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded accent-[#f36d00]"
          />
          <span>Email me offers and news</span>
        </label>

        <button type="submit" disabled={saving} className="je-btn-primary mt-5">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="space-y-6">
        <form onSubmit={onChangePassword} noValidate className="je-card p-5">
          <h2 className="text-lg font-extrabold text-grey-darkest">Change password</h2>

          {pwMessage && (
            <div className={`mt-3 ${pwMessage.kind === "ok" ? "je-alert-success" : "je-alert-error"}`}>
              {pwMessage.text}
            </div>
          )}

          <div className="mt-4 space-y-4">
            <PasswordRow
              id="pw-new"
              label="New password"
              value={passwords.next}
              onChange={(v) => setPasswords((p) => ({ ...p, next: v }))}
              autoComplete="new-password"
            />
            <PasswordRow
              id="pw-confirm"
              label="Confirm new password"
              value={passwords.confirm}
              onChange={(v) => setPasswords((p) => ({ ...p, confirm: v }))}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" disabled={pwSaving} className="je-btn-primary mt-5">
            {pwSaving ? "Updating…" : "Change password"}
          </button>
        </form>

        <section className="je-card p-5">
          <h2 className="text-lg font-extrabold text-grey-darkest">Account</h2>
          <p className="mt-2 text-sm text-grey-dark">
            Signing out clears this device&apos;s session but keeps your orders and
            addresses.
          </p>
          <button
            type="button"
            onClick={() => logout()}
            className="je-btn-secondary mt-4"
          >
            Sign out
          </button>
        </section>
      </div>
    </div>
  );
}

function PasswordRow({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="je-label">
        {label}
      </label>
      <input
        id={id}
        type="password"
        className="je-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
    </div>
  );
}
