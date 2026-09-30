"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/components/admin/api";
import { Card, ErrorNote, PageTitle, StatusBadge } from "@/components/admin/ui";
import { money } from "@/lib/money";

type OverviewPayload = {
  orders: {
    total: number;
    today: number;
    byStatus: Record<string, number>;
    revenue: number;
  };
  menu: { categories: number; items: number; activeItems: number };
  recent: Array<{
    reference: string;
    status: string;
    total: number;
    fulfilmentType: string;
    contactName: string;
    placedAt: string;
  }>;
};

const STATUS_ORDER = ["pending", "confirmed", "preparing", "out_for_delivery", "collected", "delivered", "cancelled"];

export function Overview() {
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<OverviewPayload>("/api/admin/overview")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorNote message={error} />;
  if (!data) {
    return (
      <Card className="p-8">
        <p className="text-sm text-grey-dark">Loading overview&hellip;</p>
      </Card>
    );
  }

  const created = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const stats: Array<{ label: string; value: string; to?: string }> = [
    { label: "Orders", value: String(data.orders.total), to: "/admin/orders" },
    { label: "Today", value: String(data.orders.today), to: "/admin/orders" },
    { label: "Revenue", value: money(data.orders.revenue) },
    {
      label: "Open items",
      value: `${data.menu.activeItems}/${data.menu.items}`,
      to: "/admin/menu",
    },
  ];

  return (
    <>
      <PageTitle sub="Orders, revenue and menu health at a glance.">Overview</PageTitle>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => {
          const inner = (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-grey-midDark">{s.label}</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums text-grey-darkest">{s.value}</p>
            </>
          );
          return s.to ? (
            <Link key={s.label} href={s.to} className="je-card block p-5 transition-colors hover:border-orange">
              {inner}
            </Link>
          ) : (
            <Card key={s.label} className="p-5">
              {inner}
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <div className="flex items-center justify-between border-b border-grey-light px-5 py-4">
            <h2 className="text-base font-extrabold text-grey-darkest">Recent orders</h2>
            <Link href="/admin/orders" className="text-sm font-semibold text-blue hover:underline">
              All orders
            </Link>
          </div>
          {data.recent.length === 0 ? (
            <p className="p-6 text-sm text-grey-dark">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-grey-light">
              {data.recent.map((o) => (
                <li key={o.reference} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/orders?q=${encodeURIComponent(o.reference)}`}
                      className="font-mono text-sm font-bold text-grey-darkest hover:text-blue"
                    >
                      {o.reference}
                    </Link>
                    <p className="truncate text-xs text-grey-dark">
                      {created(o.placedAt)} &middot; {o.fulfilmentType === "delivery" ? "Delivery" : "Collection"} &middot; {o.contactName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={o.status as never} />
                    <span className="text-sm font-extrabold tabular-nums text-grey-darkest">{money(o.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-extrabold text-grey-darkest">By status</h2>
            <dl className="mt-3 space-y-2">
              {STATUS_ORDER.map((s) => (
                <div key={s} className="flex items-center justify-between">
                  <dt className="text-sm capitalize text-grey-dark">{s.replaceAll("_", " ")}</dt>
                  <dd className="text-sm font-bold tabular-nums text-grey-darkest">
                    {data.orders.byStatus[s] ?? 0}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-extrabold text-grey-darkest">Menu</h2>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <dd className="text-xl font-extrabold text-grey-darkest">{data.menu.categories}</dd>
                <dt className="text-xs font-semibold uppercase tracking-wide text-grey-midDark">Categories</dt>
              </div>
              <div>
                <dd className="text-xl font-extrabold text-grey-darkest">{data.menu.items}</dd>
                <dt className="text-xs font-semibold uppercase tracking-wide text-grey-midDark">Items</dt>
              </div>
              <div>
                <dd className="text-xl font-extrabold text-orange-aa">{data.menu.activeItems}</dd>
                <dt className="text-xs font-semibold uppercase tracking-wide text-grey-midDark">On sale</dt>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}