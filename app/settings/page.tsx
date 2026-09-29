"use client";

import AppShell from "@/components/AppShell";
import { useState } from "react";

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    weeklyDigest: true,
  });

  const toggle = (key: keyof typeof notifications) =>
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your workspace preferences.</p>
        </div>

        <div className="max-w-xl rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Notifications</h2>
          </div>
          <ul className="divide-y divide-gray-200">
            {(["email", "push", "weeklyDigest"] as const).map((key) => (
              <li key={key} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 capitalize">{key.replace(/([A-Z])/g, " $1")}</p>
                  <p className="text-xs text-gray-500">Receive {key} notifications.</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-pressed={notifications[key]}
                  className={`relative h-6 w-11 rounded-full transition-colors ${notifications[key] ? "bg-blue-600" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${notifications[key] ? "left-5" : "left-0.5"}`} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="max-w-xl rounded-lg border border-red-200 bg-white px-5 py-4">
          <h2 className="font-semibold text-red-900">Danger zone</h2>
          <p className="text-sm text-red-600">Log out of your account on this device using the button in the header.</p>
        </div>
      </div>
    </AppShell>
  );
}
