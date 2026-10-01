"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBasket } from "@/components/BasketProvider";
import { IconChevronLeft, IconInfo, IconMinus, IconPlus, IconTrash } from "@/components/Icons";
import { money } from "@/lib/money";
import type { Restaurant } from "@/lib/types";

export default function BasketPanel({ restaurant }: { restaurant: Restaurant }) {
  const {
    lines,
    breakdown,
    fulfilment,
    setFulfilment,
    isOpen,
    setOpen,
    setQuantity,
    remove,
    clear,
    itemCount,
    hydrated,
    postcode,
  } = useBasket();

  // Free-delivery progress nudge, mirroring Just Eat's threshold messaging.
  const remainingForFree =
    fulfilment === "delivery" && restaurant.deliveryFee === 0
      ? 0
      : Math.max(0, breakdown.minimumOrderValue - breakdown.subtotal);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  if (!hydrated) return null;

  const empty = lines.length === 0;
  const blocked = breakdown.belowMinimumOrder;

  return (
    <>
      {/* Sticky bottom bar — appears only once there is something in the basket */}
      {!isOpen && !empty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-grey-light bg-white shadow-sticky">
          <div className="je-container flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-grey-darkest">
                {itemCount} {itemCount === 1 ? "item" : "items"} &middot;{" "}
                {money(breakdown.total)}
              </p>
              {blocked ? (
                <p className="text-xs font-medium text-red">
                  Spend {money(breakdown.minimumOrderValue - breakdown.subtotal)} more to
                  reach the {money(breakdown.minimumOrderValue)} minimum
                </p>
              ) : (
                <p className="text-xs text-grey-dark">
                  {fulfilment === "delivery"
                    ? `Delivery to ${postcode || "your postcode"}`
                    : "Collection from the restaurant"}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="je-btn-primary je-btn-lg shrink-0"
            >
              View basket
            </button>
          </div>
        </div>
      )}

      {/* Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-grey-darkest/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your basket"
            className="relative flex h-full w-full max-w-md flex-col bg-grey-offWhite shadow-raised"
          >
            <header className="flex items-center justify-between border-b border-grey-light bg-white px-4 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1 rounded-button px-2 py-1.5 text-sm font-semibold text-grey-darkest hover:bg-grey-lighter"
              >
                <IconChevronLeft className="h-4 w-4" />
                Continue shopping
              </button>
              <h2 className="text-base font-bold text-grey-darkest">Your basket</h2>
              {!empty && (
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-button px-2 py-1.5 text-sm font-semibold text-grey-midDark hover:bg-grey-lighter"
                >
                  Clear
                </button>
              )}
            </header>

            {/* Fulfilment switcher */}
            <div className="border-b border-grey-light bg-white px-4 py-3">
              <div className="grid grid-cols-2 gap-1 rounded-button bg-grey-lighter p-1">
                {(["delivery", "collection"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFulfilment(f)}
                    className={`rounded-[2px] px-3 py-2 text-sm font-semibold transition ${
                      fulfilment === f
                        ? "bg-white text-grey-darkest shadow-card"
                        : "text-grey-dark hover:text-grey-darkest"
                    }`}
                  >
                    {f === "delivery" ? "Delivery" : "Collection"}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-grey-dark">
                {fulfilment === "delivery"
                  ? `${restaurant.deliveryEtaMin}–${restaurant.deliveryEtaMax} min · ${
                      restaurant.deliveryFee === 0 ? "Free delivery" : `${money(restaurant.deliveryFee)} delivery`
                    }`
                  : `Ready in around ${restaurant.collectionEtaMin} min · No delivery fee`}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {empty ? (
                <div className="je-card p-8 text-center">
                  <p className="text-sm font-semibold text-grey-darkest">
                    Your basket is empty
                  </p>
                  <p className="mt-1 text-sm text-grey-dark">
                    Add a pizza or a doner kebab to get started.
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="je-btn-primary mt-4"
                  >
                    Browse the menu
                  </button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {lines.map((line) => (
                    <li key={line.id} className="je-card p-3">
                      <div className="flex gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-grey-darkest">
                            {line.name}
                          </p>
                          {line.variationName && line.variationName !== "Standard" && (
                            <p className="truncate text-xs text-grey-dark">
                              {line.variationName}
                            </p>
                          )}
                          {line.modifiers.length > 0 && (
                            <ul className="mt-0.5 space-y-0.5">
                              {line.modifiers.map((m) => (
                                <li key={m.optionId} className="truncate text-xs text-grey-dark">
                                  {m.quantity > 1 ? `${m.quantity} × ` : ""}
                                  {m.optionName}
                                  {m.priceDelta > 0 && ` (+${money(m.priceDelta)})`}
                                </li>
                              ))}
                            </ul>
                          )}
                          <p className="mt-0.5 text-sm text-grey-dark">
                            {money(line.lineTotal)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              line.quantity === 1
                                ? remove(line.id)
                                : setQuantity(line.id, line.quantity - 1)
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-button border border-grey-midDark text-grey-darkest hover:bg-grey-lighter"
                            aria-label={line.quantity === 1 ? `Remove ${line.name}` : `Decrease ${line.name}`}
                          >
                            {line.quantity === 1 ? (
                              <IconTrash className="h-3.5 w-3.5" />
                            ) : (
                              <IconMinus className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <span className="w-6 text-center text-sm font-semibold text-grey-darkest">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQuantity(line.id, line.quantity + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-button border border-grey-midDark text-grey-darkest hover:bg-grey-lighter"
                            aria-label={`Increase ${line.name}`}
                          >
                            <IconPlus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {!empty && remainingForFree > 0 && (
                <p className="mt-3 flex items-start gap-2 text-xs text-grey-dark">
                  <IconInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Add {money(remainingForFree)} more to reach the{" "}
                    {money(breakdown.minimumOrderValue)} minimum order value.
                  </span>
                </p>
              )}
            </div>

            {!empty && (
              <footer className="border-t border-grey-light bg-white p-4">
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-grey-dark">Subtotal</dt>
                    <dd className="font-semibold text-grey-darkest">
                      {money(breakdown.subtotal)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-grey-dark">
                      Delivery{fulfilment === "collection" ? "" : " fee"}
                    </dt>
                    <dd className="font-semibold text-grey-darkest">
                      {breakdown.deliveryFee === 0 ? "Free" : money(breakdown.deliveryFee)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-grey-dark">Service fee</dt>
                    <dd className="font-semibold text-grey-darkest">
                      {money(breakdown.serviceFee)}
                    </dd>
                  </div>
                  {breakdown.discount > 0 && (
                    <div className="flex justify-between text-green">
                      <dt>Discount</dt>
                      <dd className="font-semibold">-{money(breakdown.discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-grey-light pt-2 text-base">
                    <dt className="font-bold text-grey-darkest">Total</dt>
                    <dd className="font-bold text-grey-darkest">{money(breakdown.total)}</dd>
                  </div>
                </dl>

                {blocked ? (
                  <>
                    <button type="button" disabled className="je-btn-primary je-btn-lg je-btn-block mt-4">
                      {money(breakdown.minimumOrderValue - breakdown.subtotal)} more to order
                    </button>
                    <p className="mt-2 text-center text-xs text-grey-dark">
                      Minimum order value is {money(breakdown.minimumOrderValue)}
                    </p>
                  </>
                ) : (
                  <Link
                    href={fulfilment === "delivery" ? "/checkout" : "/checkout?fulfilment=collection"}
                    onClick={() => setOpen(false)}
                    className="je-btn-primary je-btn-lg je-btn-block mt-4"
                  >
                    Go to checkout &middot; {money(breakdown.total)}
                  </Link>
                )}
              </footer>
            )}
          </div>
        </div>
      )}
    </>
  );
}
