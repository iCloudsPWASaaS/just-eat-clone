"use client";

import { useState } from "react";
import { useBasket } from "@/components/BasketProvider";
import { IconCheck, IconRotate, IconX } from "@/components/Icons";
import { COLLECTION_STEPS, DELIVERY_STEPS, STATUS_LABELS } from "@/lib/order-status";
import type { FulfilmentType, OrderItem, OrderStatus } from "@/lib/types";
import type { MenuItem, MenuVariation } from "@/lib/types";

type HistoryEvent = { status: OrderStatus; note: string | null };

/**
 * Just Eat–style progress tracker + one-tap "order again".
 *
 * The tracker walks the happy path for the order's fulfilment mode and shows a
 * distinct cancelled state instead of pretending the order moved forward.
 */
export function OrderActions({
  status,
  fulfilmentType,
  history,
  items,
}: {
  status: OrderStatus;
  fulfilmentType: FulfilmentType;
  history: HistoryEvent[];
  items: OrderItem[];
}) {
  const { add, setFulfilment, setOpen } = useBasket();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const steps = fulfilmentType === "delivery" ? DELIVERY_STEPS : COLLECTION_STEPS;
  const cancelled = status === "cancelled";

  // Walk the log once so an order that was cancelled half-way lands at the
  // furthest point it actually reached.
  let progress = -1;
  for (const ev of history) {
    const idx = steps.indexOf(ev.status);
    if (idx >= 0) progress = Math.max(progress, idx);
  }
  const currentIdx = steps.indexOf(status);
  if (progress < 0) progress = currentIdx;

  const reorder = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/menu", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load the menu.");
      const { categories } = (await res.json()) as {
        categories: Array<{ items: MenuItem[] }>;
      };

      const byId = new Map<string, MenuItem>();
      for (const c of categories) for (const i of c.items) byId.set(i.id, i);

      let added = 0;
      let skipped = 0;
      setFulfilment(fulfilmentType);
      for (const line of items) {
        const item = byId.get(line.itemId);
        if (!item) {
          skipped += 1;
          continue;
        }
        let variation: MenuVariation | null = null;
        if (line.variationId) {
          variation = item.variations.find((v) => v.id === line.variationId) ?? null;
          if (!variation) {
            skipped += 1;
            continue;
          }
        }
        add(item, variation, line.quantity);
        added += 1;
      }
      setResult({ added, skipped });
      setOpen(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {/* Tracker */}
      <ol className="flex items-start" aria-label="Order progress">
        {steps.map((s, i) => {
          const done = cancelled ? i < progress : i <= currentIdx;
          const reached = cancelled ? i <= progress : i <= currentIdx;
          const isLast = i === steps.length - 1;
          return (
            <li key={s} className={`flex items-start ${isLast ? "" : "flex-1"}`}>
              <div className="flex w-16 shrink-0 flex-col items-center">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                    reached && !cancelled
                      ? "border-orange bg-orange text-white"
                      : reached && cancelled && i <= progress
                        ? "border-grey-dark bg-grey-dark text-white"
                        : "border-grey-light bg-white text-grey-midDark"
                  }`}
                >
                  {done ? <IconCheck className="h-4 w-4" /> : i + 1}
                </span>
                <span
                  className={`mt-1.5 text-center text-[10px] font-semibold leading-tight ${
                    reached ? "text-grey-darkest" : "text-grey-midDark"
                  }`}
                >
                  {STATUS_LABELS[s] ?? s}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`mt-4 h-0.5 flex-1 ${
                    (cancelled ? i < progress - 1 : i < currentIdx) ? "bg-orange" : "bg-grey-light"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>

      {cancelled && (
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-red-offWhite px-3 py-1 text-xs font-bold text-red">
          <IconX className="h-3.5 w-3.5" />
          This order was cancelled.
        </p>
      )}

      {/* Reorder */}
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-grey-light pt-5">
        <button
          type="button"
          onClick={reorder}
          disabled={busy}
          className="je-btn-primary"
        >
          <IconRotate className="h-4 w-4" />
          {busy ? "Adding&hellip;" : "Order again"}
        </button>
        {result && (
          <p className="text-sm text-grey-dark">
            {result.added > 0
              ? `Added ${result.added} ${result.added === 1 ? "item" : "items"} to your basket.`
              : "Nothing could be re-added."}
            {result.skipped > 0 && (
              <>
                {" "}
                <span className="font-semibold">({result.skipped} no longer on the menu)</span>
              </>
            )}
          </p>
        )}
        {error && <span className="text-sm font-semibold text-red">{error}</span>}
      </div>
    </div>
  );
}