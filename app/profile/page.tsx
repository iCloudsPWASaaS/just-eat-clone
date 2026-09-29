"use client";

import AppShell from "@/components/AppShell";
import { useEffect, useState, type FormEvent } from "react";
import { getProfile, updateProfile, type AuthUser } from "@/lib/auth";

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProfile().then((u) => {
      if (!u) return;
      setUser(u);
      setFirstName(u.firstName || "");
      setLastName(u.lastName || "");
      setPhone(u.phone || "");
    });
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    const result = await updateProfile({ firstName, lastName, phone });
    setSaving(false);
    setStatus(result.ok
      ? { ok: true, message: "Profile saved." }
      : { ok: false, message: result.error || "Could not save profile." });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="mt-1 text-sm text-gray-500">Keep your personal information up to date.</p>
        </div>

        <div className="max-w-xl rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">
            Signed in as <span className="font-medium text-gray-900">{user?.email}</span>
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {status && (
              <p className={`rounded-md px-3 py-2 text-sm ${status.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {status.message}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First name</label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last name</label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
