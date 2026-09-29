"use client";

import AppShell from "@/components/AppShell";
import { useEffect, useState } from "react";
import { getCurrentUser, type AuthUser } from "@/lib/auth";

const stats = [
  { label: "Total Users", value: "1,248" },
  { label: "Active Projects", value: "36" },
  { label: "Monthly Revenue", value: "$8,420" },
  { label: "Conversion Rate", value: "3.4%" },
];

const recentActivity = [
  { action: "Signed in", detail: "Login from Chrome on Windows", time: "2 min ago" },
  { action: "Updated profile", detail: "Changed first name", time: "1 hour ago" },
  { action: "Created project", detail: "New sample project created", time: "3 hours ago" },
];

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.firstName || "there"}!
          </h1>
          <p className="mt-1 text-sm text-gray-500">Here is what is happening in your workspace today.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Recent activity</h2>
          </div>
          <ul className="divide-y divide-gray-200">
            {recentActivity.map((item, i) => (
              <li key={i} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.action}</p>
                  <p className="text-sm text-gray-500">{item.detail}</p>
                </div>
                <span className="text-xs text-gray-400">{item.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
