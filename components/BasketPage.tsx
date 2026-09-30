"use client";

import Link from "next/link";
import { useBasket } from "@/components/BasketProvider";
import { IconChevronLeft, IconMinus, IconPlus, IconTrash } from "@/components/Icons";
import { money } from "@/lib/money";
import type { Restaurant } from "@/lib/types";

/** Full-page basket — the `?redirected=1` copy is shown after coming from checkout. */
export default function BasketPage({
  restaurant,
  redirected,
}: {
  restaurant: Restaurant;
  redirected: boolean;
}) {
  const { lines, breakdown, fulfilment, setFulfilment, setQuantity, remove, clear, hydrated, itemCount } =
    useBasket();

  if (!hydrated) {
    return <div className="je-container py-16 text-sm text-grey-midDark">Loading your basket…</div>;
  }

  if (lines.length === 0) {
    return (
      <div className="je-container py-16">
        <div className="je-card mx-auto max-w-lg p-10 text-center">
          <h1 className="text-2xl font-extrabold text-grey-darkest">Your basket is empty</h1>
          <p className="mt-2 text-sm text-grey-dark">
            Browse the full menu and add a pizza, a doner kebab or a family deal.
          </p>
          <Link href="/#menu" className="je-btn-primary je-btn-lg mt-6">
            Browse the menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="je-container py-8">
      <Link
        href="/#menu"
        className="inline-flex items-center gap-1 text-sm font-semibold text-grey-dark hover:text-blue"
      >
        <IconChevronLeft className="h-4 w-4" />
        Continue shopping
      </Link>

      <h1 className="mt-3 text-3xl font-extrabold text-grey-darkest">Your basket</h1>

      {redirected && (
        <div className="je-alert-info mt-4">
          Sign in to save this basket and check out faster next time.
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="grid grid-cols-2 gap-1 rounded-button bg-grey-lighter p-1">
            {(["delivery", "collection"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFulfilment(f)}
                className={`rounded-[2px] px-3 py-2.5 text-sm font-semibold transition ${
                  fulfilment === f
                    ? "bg-white text-grey-darkest shadow-card"
                    : "text-grey-dark hover:text-grey-darkest"
                }`}
              >
                {f === "delivery" ? "Delivery" : "Collection"}
              </button>
            ))}
          </div>

          <ul className="mt-4 space-y-3">
            {lines.map((line) => (
              <li key={line.id} className="je-card p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-grey-darkest">{line.name}</p>
                    {line.variationName && line.variationName !== "Standard" && (
                      <p className="text-sm text-grey-dark">{line.variationName}</p>
                    )}
                    <p className="mt-1 text-sm text-grey-dark">
                      {money(line.unitPrice)} each
                    </p>
                  </div>

                  <div className="flex items-center gap-1 rounded-button border border-grey-midDark px-1">
                    <button
                      type="button"
                      onClick={() =>
                        line.quantity === 1 ? remove(line.id) : setQuantity(line.id, line.quantity - 1)
                      }
                      className="flex h-8 w-8 items-center justify-center text-grey-darkest hover:text-orange"
                      aria-label={line.quantity === 1 ? `Remove ${line.name}` : `Decrease ${line.name}`}
                    >
                      {line.quantity === 1 ? (
                        <IconTrash className="h-4 w-4" />
                      ) : (
                        <IconMinus className="h-4 w-4" />
                      )}
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-grey-darkest">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(line.id, line.quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center text-grey-darkest hover:text-orange"
                      aria-label={`Increase ${line.name}`}
                    >
                      <IconPlus className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="w-20 text-right text-base font-bold text-grey-darkest">
                    {money(line.lineTotal)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={clear}
            className="mt-4 text-sm font-semibold text-grey-midDark hover:text-red hover:underline"
          >
            Empty basket
          </button>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="je-card p-5">
            <h2 className="text-lg font-extrabold text-grey-darkest">Order summary</h2>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-grey-dark">
                  Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
                </dt>
                <dd className="font-semibold text-grey-darkest">{money(breakdown.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-grey-dark">
                  {fulfilment === "delivery" ? "Delivery fee" : "Collection"}
                </dt>
                <dd className="font-semibold text-grey-darkest">
                  {breakdown.deliveryFee === 0 ? "Free" : money(breakdown.deliveryFee)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-grey-dark">Service fee</dt>
                <dd className="font-semibold text-grey-darkest">{money(breakdown.serviceFee)}</dd>
              </div>
              <div className="flex justify-between border-t border-grey-light pt-2 text-base">
                <dt className="font-bold text-grey-darkest">Total</dt>
                <dd className="font-bold text-grey-darkest">{money(breakdown.total)}</dd>
              </div>
            </dl>

            {breakdown.belowMinimumOrder ? (
              <>
                <button
                  type="button"
                  disabled
                  className="je-btn-primary je-btn-lg je-btn-block mt-5"
                >
                  {money(breakdown.minimumOrderValue - breakdown.subtotal)} more to order
                </button>
                <p className="mt-2 text-center text-xs text-grey-dark">
                  Minimum order value is {money(breakdown.minimumOrderValue)}
                </p>
              </>
            ) : (
              <Link
                href={fulfilment === "delivery" ? "/checkout" : "/checkout?fulfilment=collection"}
                className="je-btn-primary je-btn-lg je-btn-block mt-5"
              >
                Checkout &middot; {money(breakdown.total)}
              </Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
