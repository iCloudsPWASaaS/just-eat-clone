"use client";

import { useBasket } from "@/components/BasketProvider";
import { IconBike, IconBag } from "@/components/Icons";
import { money } from "@/lib/money";
import type { Restaurant } from "@/lib/types";

/**
 * Delivery / Collection selector, mirroring the Just Eat menu page: a
 * persistent card in the desktop sidebar, and at the top of the menu on
 * mobile. Shared basket state keeps every instance and the basket/checkout
 * in sync.
 */
export function FulfilmentPicker({
  restaurant,
  className = "",
}: {
  restaurant: Restaurant;
  className?: string;
}) {
  const { fulfilment, setFulfilment } = useBasket();

  const deliveryEta =
    restaurant.deliveryEtaMax > 0
      ? `${restaurant.deliveryEtaMin}–${restaurant.deliveryEtaMax} min`
      : `${restaurant.deliveryEtaMin} min`;

  const options = [
    {
      value: "delivery" as const,
      icon: <IconBike className="h-5 w-5" />,
      title: "Delivery",
      hint: restaurant.deliveryFee === 0 ? "Free delivery" : `${money(restaurant.deliveryFee)} fee`,
    },
    {
      value: "collection" as const,
      icon: <IconBag className="h-5 w-5" />,
      title: "Collection",
      hint: "No delivery fee",
    },
  ];

  return (
    <section aria-label="Delivery or collection" className={className}>
      <h2 className="text-2xl font-extrabold text-grey-darkest">Delivery or collection</h2>
      <div className="je-card mt-3 p-4">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Order type">
          {options.map((o) => {
            const selected = fulfilment === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setFulfilment(o.value)}
                className={`flex items-center justify-center gap-2 rounded-button border px-3 py-3 text-sm font-bold transition-colors ${
                  selected
                    ? "border-orange bg-orange text-white"
                    : "border-grey-midDark bg-white text-grey-darkest hover:bg-grey-lighter"
                }`}
              >
                <span className={selected ? "" : "text-orange"}>{o.icon}</span>
                {o.title}
              </button>
            );
          })}
        </div>

        <p className="mt-3 flex flex-wrap items-center justify-between gap-1 text-sm text-grey-dark">
          <span>
            {fulfilment === "delivery" ? (
              <>
                Delivered in <strong className="text-grey-darkest">{deliveryEta}</strong>
              </>
            ) : (
              <>
                Ready in <strong className="text-grey-darkest">{restaurant.collectionEtaMin} min</strong>
              </>
            )}
          </span>
          <span className="font-semibold text-orange">
            {fulfilment === "delivery"
              ? options[0].hint
              : `Free collection, no delivery fee`}
          </span>
        </p>

        {fulfilment === "delivery" && (
          <p className="mt-2 border-t border-grey-light pt-2 text-xs text-grey-midDark">
            Minimum order {money(restaurant.minimumOrderValue)} for delivery.
          </p>
        )}
      </div>
    </section>
  );
}