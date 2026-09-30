"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminFetch } from "@/components/admin/api";
import { Card, ErrorNote, PageTitle, StatusBadge } from "@/components/admin/ui";
import { money } from "@/lib/money";
import { NEXT_ORDER_STATUS, STATUS_LABELS } from "@/lib/order-status";
import type { OrderStatus } from "@/lib/types";

type AdminOrder = {
  id: string;
  reference: string;
  status: OrderStatus;
  fulfilmentType: "delivery" | "collection";
  contactName: string;
  contactPhone: string;
  customerNotes: string | null;
  deliveryAddress: Record<string, unknown> | null;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  paymentMethod: string;
  etaMinutes: number | null;
  placedAt: string;
  items: Array<{ id: string; name: string; quantity: number }>;
  history: Array<{ status: OrderStatus; note: string | null; created_at: string }>;
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "collected", label: "Collected" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
  { key: "delivery", label: "Delivery" },
  { key: "collection", label: "Collection" },
];

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function Orders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
    try {
      const res = await adminFetch<{ orders: AdminOrder[] }>(`/api/admin/orders?${params.toString()}`);
      setOrders(res.orders ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedQ]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce the search box.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 350);
    timers.current.push(t);
    return () => {
      timers.current.forEach((x) => window.clearTimeout(x));
      timers.current = [];
    };
  }, [q]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) map[o.status] = (map[o.status] ?? 0) + 1;
    return map;
  }, [orders]);

  const advance = useCallback(
    async (order: AdminOrder, next: OrderStatus) => {
      setBusy(`${order.reference}:${next}`);
      setActionError(null);
      try {
        await adminFetch(`/api/admin/orders/${order.reference}`, {
          method: "PATCH",
          body: JSON.stringify({ status: next }),
        });
        await load();
      } catch (e) {
        setActionError(`${order.reference} \u2014 ${(e as Error).message}`);
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const toggle = (ref: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });

  return (
    <>
      <PageTitle sub="Accept, progress and cancel incoming orders.">Orders</PageTitle>

      {actionError && (
        <div className="je-alert-error mb-4">
          <button type="button" onClick={() => setActionError(null)} className="float-right font-bold">
            &times;
          </button>
          {actionError}
        </div>
      )}
      {error && <div className="je-alert-error mb-4">{error}</div>}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const isActive = filter === f.key;
            return (
              <button
                key={f.key || "all"}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-orange text-white"
                    : "bg-white text-grey-dark ring-1 ring-grey-light hover:bg-grey-lighter"
                }`}
              >
                {f.label}
                {f.key && counts[f.key] != null && <span className={`ms-1 ${isActive ? "text-orange-offWhite" : "text-grey-midDark"}`}>{counts[f.key]}</span>}
              </button>
            );
          })}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reference, name or postcode&hellip;"
          className="je-input lg:w-80"
        />
      </div>

      <Card>
        {loading ? (
          <p className="p-6 text-sm text-grey-dark">Loading orders&hellip;</p>
        ) : orders.length === 0 ? (
          <p className="p-6 text-sm text-grey-dark">No orders match.</p>
        ) : (
          <ul className="divide-y divide-grey-light">
            {orders.map((o) => {
              const next = NEXT_ORDER_STATUS[o.status] ?? [];
              const open = expanded.has(o.reference);
              return (
                <li key={o.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button type="button" onClick={() => toggle(o.reference)} className="min-w-0 text-left">
                      <span className="font-mono text-sm font-bold text-grey-darkest hover:text-blue">{o.reference}</span>
                    </button>
                    <StatusBadge status={o.status} />
                    <span className="text-xs text-grey-dark">
                      {fmtDate(o.placedAt)} &middot;{" "}
                      {o.fulfilmentType === "delivery" ? "Delivery" : "Collection"}
                    </span>
                    <span className="shrink-0 text-xs text-grey-dark">{o.items.reduce((n, i) => n + i.quantity, 0)} items</span>
                    <span className="ms-auto font-extrabold tabular-nums text-grey-darkest">
                      {money(o.total)}
                      {o.paymentMethod === "cod" && <span className="ms-2 text-[10px] font-bold uppercase text-green">COD</span>}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {next.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busy !== null}
                        onClick={() => advance(o, s)}
                        className="je-btn !px-3 !py-1.5 text-xs disabled:opacity-50"
                      >
                        {s === "cancelled" ? "Cancel order" : `Mark \u2014 ${STATUS_LABELS[s]}`}
                      </button>
                    ))}
                    {open && (
                      <button type="button" onClick={() => toggle(o.reference)} className="je-btn-quiet !px-3 !py-1.5 text-xs">
                        Collapse
                      </button>
                    )}
                  </div>

                  {open && (
                    <div className="mt-4 rounded-card border border-grey-light bg-grey-offWhite p-4">
                      <div className="grid gap-4 text-sm sm:grid-cols-2">
                        <div>
                          <p className="font-bold text-grey-darkest">
                            {o.contactName} &middot; <a href={`tel:${o.contactPhone}`} className="je-link">{o.contactPhone}</a>
                          </p>
                          {o.deliveryAddress && (
                            <p className="mt-1 text-grey-dark">
                              {o.fulfilmentType === "delivery" ? "Deliver to" : "Collection address"}:{" "}
                              {[o.deliveryAddress.addressLine1, o.deliveryAddress.city, o.deliveryAddress.postcode]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          )}
                          {o.customerNotes && <p className="mt-1 text-grey-dark">Note: {o.customerNotes}</p>}
                        </div>
                        <dl className="text-grey-dark sm:text-right">
                          <div className="flex justify-between gap-4 sm:justify-end">
                            <dt>Subtotal</dt>
                            <dd className="text-grey-darkest">{money(o.subtotal)}</dd>
                          </div>
                          <div className="flex justify-between gap-4 sm:justify-end">
                            <dt>Delivery</dt>
                            <dd className="text-grey-darkest">{o.fulfilmentType === "delivery" ? money(o.deliveryFee) : "\u2014"}</dd>
                          </div>
                          <div className="flex justify-between gap-4 sm:justify-end">
                            <dt>Service</dt>
                            <dd className="text-grey-darkest">{money(o.serviceFee)}</dd>
                          </div>
                          {o.discount > 0 && (
                            <div className="flex justify-between gap-4 text-green sm:justify-end">
                              <dt>Discount</dt>
                              <dd>-{money(o.discount)}</dd>
                            </div>
                          )}
                          <div className="mt-1 flex justify-between gap-4 border-t border-grey-light pt-1 font-extrabold text-grey-darkest sm:justify-end">
                            <dt>Total</dt>
                            <dd>{money(o.total)}</dd>
                          </div>
                        </dl>
                      </div>

                      <ul className="mt-4 divide-y divide-grey-light border-t border-grey-light pt-3 text-sm text-grey-dark">
                        {o.items.map((i) => (
                          <li key={i.id} className="flex justify-between py-1">
                            <span>{i.quantity} &times; {i.name}</span>
                          </li>
                        ))}
                      </ul>

                      {o.history.length > 1 && (
                        <ol className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-grey-light pt-3 text-xs text-grey-dark">
                          {o.history.map((h, i) => (
                            <li key={i}>
                              <StatusBadge status={h.status} />
                              <span className="ms-1">{fmtDate(h.created_at)}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}