"use client";

import { useState } from "react";
import { IconCheck, IconInfo } from "@/components/Icons";
import type { DeliveryZone, OpeningHour, Restaurant } from "@/lib/types";

/** Day-of-week index used throughout the app: 0 = Monday. */
function todayIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

export function OpeningHours({ hours }: { hours: OpeningHour[] }) {
  const today = todayIndex();

  return (
    <section id="opening-hours" className="scroll-mt-24">
      <h2 className="text-2xl font-extrabold text-grey-darkest">Opening hours</h2>
      <div className="je-card mt-4 overflow-hidden">
        <ul className="divide-y divide-grey-light">
          {hours.map((h) => {
            const isToday = h.dayOfWeek === today;
            return (
              <li
                key={h.dayOfWeek}
                className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                  isToday ? "bg-orange-offWhite font-bold text-grey-darkest" : "text-grey-dark"
                }`}
              >
                <span className="flex items-center gap-2">
                  {h.label}
                  {isToday && (
                    <span className="rounded-full bg-orange px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                      Today
                    </span>
                  )}
                </span>
                <span className="tabular-nums">
                  {h.isClosed || !h.openTime
                    ? "Closed"
                    : `${h.openTime} \u2013 ${h.closeTime ?? ""}`}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function DeliveryCheck({
  restaurant,
  zones,
}: {
  restaurant: Restaurant;
  zones: DeliveryZone[];
}) {
  const [postcode, setPostcode] = useState("");
  const [result, setResult] = useState<{
    deliverable: boolean;
    etaMinutes: number | null;
    distanceKm: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const onCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const pc = postcode.trim();
    if (!pc) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery-check?postcode=${encodeURIComponent(pc)}`);
      const data = await res.json();
      setResult({
        deliverable: data.deliverable,
        etaMinutes: data.etaMinutes,
        distanceKm: data.distanceKm ?? null,
      });
    } catch {
      setResult({ deliverable: false, etaMinutes: null, distanceKm: null });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2 className="text-2xl font-extrabold text-grey-darkest">Check delivery to you</h2>
      <p className="mt-1.5 text-sm text-grey-dark">
        We deliver to Marston, Headington, Cutteslowe, Cowley and the wider Oxford area.
      </p>

      <form onSubmit={onCheck} className="je-card mt-4 p-4">
        <label htmlFor="delivery-postcode" className="je-label">
          Your postcode
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="delivery-postcode"
            className="je-input flex-1"
            placeholder="e.g. OX3 8RA"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            autoComplete="postal-code"
          />
          <button type="submit" disabled={loading} className="je-btn-primary sm:w-36">
            {loading ? "Checking\u2026" : "Check"}
          </button>
        </div>

        {result && (
          <div
            className={`mt-3 flex items-start gap-2 text-sm ${
              result.deliverable ? "je-alert-success" : "je-alert-error"
            }`}
          >
            {result.deliverable ? (
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <IconInfo className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>
              {result.deliverable ? (
                <>
                  We deliver to {postcode.toUpperCase()} in around{" "}
                  <strong>{result.etaMinutes} minutes</strong>
                  {result.distanceKm !== null && result.distanceKm > 0 && (
                    <> ({result.distanceKm} km away)</>
                  )}
                  . Free delivery on orders over {formatMoney(restaurant.minimumOrderValue)}.
                </>
              ) : (
                <>
                  Sorry, we don&rsquo;t deliver to {postcode.toUpperCase()} yet. Try
                  collection from {restaurant.addressLine1}.
                </>
              )}
            </span>
          </div>
        )}
      </form>
    </section>
  );
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}
