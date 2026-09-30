"use client";

import { useState } from "react";
import Stars from "@/components/Stars";
import type { Review } from "@/lib/types";

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ReviewsSection({
  reviews,
  rating,
  ratingCount,
}: {
  reviews: Review[];
  rating: number;
  ratingCount: number;
}) {
  const [filter, setFilter] = useState<number | null>(null);

  const shown = filter ? reviews.filter((r) => r.rating === filter) : reviews;

  // Distribution across whatever reviews we hold, so the bars stay honest when
  // the table only contains a subset of the restaurant's lifetime ratings.
  const counts = [1, 2, 3, 4, 5].map((n) => reviews.filter((r) => r.rating === n).length);
  const total = counts.reduce((a, b) => a + b, 0);

  return (
    <section id="reviews" className="scroll-mt-24">
      <h2 className="text-2xl font-extrabold text-grey-darkest">Ratings &amp; reviews</h2>

      <div className="mt-4 je-card p-5">
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:gap-10">
          <div className="text-center sm:text-left">
            <p className="text-5xl font-extrabold leading-none text-grey-darkest">
              {rating.toFixed(1)}
            </p>
            <div className="mt-2 flex justify-center sm:justify-start">
              <Stars value={rating} size={20} />
            </div>
            <p className="mt-1.5 text-sm text-grey-dark">{ratingCount} ratings</p>
          </div>

          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const n = counts[star - 1];
              const pct = total ? Math.round((n / total) * 100) : 0;
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFilter(filter === star ? null : star)}
                  className={`flex w-full items-center gap-2.5 rounded-button px-1.5 py-1 text-left text-sm transition ${
                    filter === star ? "bg-orange-offWhite" : "hover:bg-grey-lighter"
                  }`}
                  aria-pressed={filter === star}
                >
                  <span className="w-14 shrink-0 font-semibold text-grey-darkest">
                    {star} star
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-grey-light">
                    <span
                      className="block h-full rounded-full bg-jet"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="w-9 shrink-0 text-right text-xs text-grey-dark">
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {filter !== null && (
        <p className="mt-3 flex items-center justify-between text-sm text-grey-dark">
          <span>
            Showing {shown.length} {filter}-star{" "}
            {shown.length === 1 ? "review" : "reviews"}
          </span>
          <button
            type="button"
            onClick={() => setFilter(null)}
            className="font-semibold text-blue hover:underline"
          >
            Clear filter
          </button>
        </p>
      )}

      {shown.length === 0 ? (
        <p className="mt-4 je-card p-8 text-center text-sm text-grey-dark">
          No written reviews yet. Be the first to review this restaurant.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((r) => (
            <li key={r.id} className="je-card p-4">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-grey-lighter text-sm font-bold text-grey-dark"
                >
                  {initials(r.authorName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-bold text-grey-darkest">{r.authorName}</p>
                    {r.isVerifiedOrder && (
                      <span className="inline-flex items-center rounded-full bg-green-offWhite px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green">
                        Verified order
                      </span>
                    )}
                    <span className="text-xs text-grey-midDark">{formatDate(r.createdAt)}</span>
                  </div>

                  <div className="mt-1 flex items-center gap-2">
                    <Stars value={r.rating} size={14} />
                    {r.title && (
                      <p className="text-sm font-semibold text-grey-darkest">{r.title}</p>
                    )}
                  </div>

                  {r.comment && (
                    <p className="mt-1.5 text-sm leading-relaxed text-grey-dark">
                      {r.comment}
                    </p>
                  )}

                  {r.fulfilmentType === 1 && (
                    <p className="mt-2 text-xs font-medium text-grey-midDark">
                      Ordered via delivery
                    </p>
                  )}
                  {r.fulfilmentType === 2 && (
                    <p className="mt-2 text-xs font-medium text-grey-midDark">
                      Ordered via collection
                    </p>
                  )}

                  {r.restaurantReply && (
                    <div className="mt-3 rounded-button bg-grey-lighter p-3">
                      <p className="text-xs font-bold text-grey-darkest">
                        Reply from the restaurant
                      </p>
                      <p className="mt-1 text-sm text-grey-dark">{r.restaurantReply}</p>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
