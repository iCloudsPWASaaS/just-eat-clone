"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useBasket } from "@/components/BasketProvider";
import { DishImage } from "@/components/DishImage";
import {
  IconChevronLeft,
  IconChevronRight,
  IconHeart,
  IconMinus,
  IconPlus,
  IconStarOutline,
} from "@/components/Icons";
import { money } from "@/lib/money";
import type { MenuCategory, MenuItem } from "@/lib/types";

export function MenuItemCard({ item, suggested }: { item: MenuItem; suggested?: MenuItem[] }) {
  const { add, quantityOf, setQuantity, isFavourite, toggleFavourite, user } = useBasket();
  const [pickerFor, setPickerFor] = useState<MenuItem | null>(null);
  const [favBusy, setFavBusy] = useState(false);

  const hasVariations = item.variations.length > 1;
  const defaultVariation = item.variations.find((v) => v.isDefault) ?? item.variations[0] ?? null;

  // The stepper acts on whichever variation is actually in the basket, so a
  // customer who picked the 14" can decrement it even though the card shows
  // the default 10" as the headline price.
  const activeVariationId =
    item.variations.find((v) => quantityOf(item.id, v.id) > 0)?.id ??
    defaultVariation?.id ??
    null;
  const inQuantity = quantityOf(item.id, activeVariationId);
  const totalQuantity = item.variations.reduce((n, v) => n + quantityOf(item.id, v.id), 0);
  const favourite = isFavourite(item.id);

  const lineId = (variationId: string | null) =>
    `${item.id}::${variationId ?? "base"}`;

  const onAdd = () => {
    if (hasVariations) {
      setPickerFor(item);
      return;
    }
    add(item, defaultVariation, 1);
  };

  const onDecrement = () => {
    if (!activeVariationId) return;
    setQuantity(lineId(activeVariationId), inQuantity - 1);
  };

  const onToggleFav = async () => {
    if (favBusy) return;
    setFavBusy(true);
    await toggleFavourite(item.id);
    setFavBusy(false);
  };

  const priceLabel = useMemo(() => {
    if (hasVariations) {
      const prices = item.variations.map((v) => v.price);
      return `from ${money(Math.min(...prices))}`;
    }
    return money(defaultVariation?.price ?? item.basePrice);
  }, [hasVariations, item.variations, defaultVariation, item.basePrice]);

  return (
    <>
      <li className="je-card p-4 transition-shadow hover:shadow-raised">
        <div className="flex gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h4 className="text-base font-bold text-grey-darkest">{item.name}</h4>
              {item.isPopular && (
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-jet-offWhite px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-aa">
                  <IconStarOutline className="h-3 w-3" />
                  Popular
                </span>
              )}
            </div>

            {item.description && (
              <p className="mt-1 text-sm leading-relaxed text-grey-dark">
                {item.description}
              </p>
            )}

            {hasVariations && (
              <p className="mt-1 text-xs font-medium text-grey-midDark">
                {item.variations.length} sizes available
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {item.isHalal && <span className="je-chip">Halal</span>}
              {item.isVegetarian && <span className="je-chip">Vegetarian</span>}
              {item.isVegan && <span className="je-chip">Vegan</span>}
              {item.isSpicy && <span className="je-chip">Spicy</span>}
              {item.calories !== null && (
                <span className="je-chip">{item.calories} kcal</span>
              )}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <span className="text-base font-bold text-grey-darkest">{priceLabel}</span>

              {totalQuantity > 0 ? (
                <div className="flex items-center gap-1 rounded-button border border-grey-midDark px-1">
                  <button
                    type="button"
                    onClick={onDecrement}
                    className="flex h-8 w-8 items-center justify-center text-grey-darkest hover:text-orange"
                    aria-label={
                      inQuantity <= 1
                        ? `Remove ${item.name} from basket`
                        : `Decrease quantity of ${item.name}`
                    }
                  >
                    <IconMinus className="h-4 w-4" />
                  </button>
                  <span className="w-5 text-center text-sm font-bold text-grey-darkest">
                    {totalQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={onAdd}
                    className="flex h-8 w-8 items-center justify-center text-grey-darkest hover:text-orange"
                    aria-label={`Increase ${item.name}`}
                  >
                    <IconPlus className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={onAdd} className="je-btn-primary">
                  Add
                </button>
              )}

              <button
                type="button"
                onClick={onToggleFav}
                disabled={favBusy}
                className={`ml-auto flex h-9 w-9 items-center justify-center rounded-full border transition ${
                  favourite
                    ? "border-red bg-red-offWhite text-red"
                    : "border-grey-light text-grey-midDark hover:border-grey-midDark hover:text-grey-darkest"
                }`}
                aria-label={
                  favourite
                    ? `Remove ${item.name} from favourites`
                    : `Save ${item.name} to favourites`
                }
                title={user ? "Save to favourites" : "Sign in to save favourites"}
              >
                <IconHeart className="h-4 w-4" filled={favourite} />
              </button>
            </div>
          </div>

          <DishImage item={item} />
        </div>
      </li>

      {pickerFor?.id === item.id && (
        <VariationPicker
          item={pickerFor}
          suggested={suggested}
          onClose={() => setPickerFor(null)}
        />
      )}
    </>
  );
}

export function VariationPicker({
  item,
  suggested = [],
  onClose,
}: {
  item: MenuItem;
  suggested?: MenuItem[];
  onClose: () => void;
}) {
  const { add } = useBasket();
  const [selectedId, setSelectedId] = useState(
    item.variations.find((v) => v.isDefault)?.id ?? item.variations[0]?.id ?? null
  );
  const selected = item.variations.find((v) => v.id === selectedId) ?? item.variations[0];
  const [extras, setExtras] = useState<Map<string, number>>(new Map());

  /** Suggested dishes, minus the one being composed. */
  const others = useMemo(
    () => suggested.filter((s) => s.id !== item.id),
    [suggested, item.id]
  );

  const carouselRef = useRef<HTMLUListElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const update = () => {
      setCanLeft(el.scrollLeft > 2);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollCarousel = (dir: 1 | -1) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: "smooth" });
  };

  /** Price used when a suggestion is added (falls back to the default size). */
  const priceOf = (s: MenuItem) =>
    (s.variations.find((v) => v.isDefault) ?? s.variations[0])?.price ?? s.basePrice;

  const countOf = (id: string) => extras.get(id) ?? 0;

  const bump = (id: string, delta: number) =>
    setExtras((m) => {
      const next = new Map(m);
      const n = (next.get(id) ?? 0) + delta;
      if (n <= 0) next.delete(id);
      else next.set(id, n);
      return next;
    });

  const extrasTotal = others.reduce((sum, s) => sum + priceOf(s) * countOf(s.id), 0);
  const total = (selected?.price ?? 0) + extrasTotal;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const confirm = () => {
    if (!selected) return;
    add(item, selected, 1);
    for (const s of others) {
      const n = countOf(s.id);
      if (n > 0) add(s, s.variations[0] ?? null, n);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-grey-darkest/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Add ${item.name}`}
        className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-t-card bg-white shadow-raised sm:rounded-card"
      >
        <div className="je-no-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
          {/* Dish image first, then the name — Just Eat's item-card layout */}
          <div className="flex items-center gap-4">
            <DishImage item={item} className="h-20 w-20" />
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-grey-darkest">{item.name}</h3>
              {item.description && (
                <p className="mt-1 text-sm leading-relaxed text-grey-dark">
                  {item.description}
                </p>
              )}
            </div>
          </div>

          {/* 1 Required — the dish itself */}
          <fieldset className="mt-4">
            <legend className="je-label">
              <span className="font-bold text-grey-darkest">{item.name}</span>
              <span className="ml-1 font-medium text-grey-midDark">1 required</span>
            </legend>
            <div className="space-y-2">
              {item.variations.map((v) => {
                const active = v.id === selected?.id;
                return (
                  <label
                    key={v.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-button border px-3 py-2.5 transition ${
                      active
                        ? "border-orange bg-orange-offWhite"
                        : "border-grey-light hover:border-grey-midDark"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`variation-${item.id}`}
                      className="h-4 w-4 accent-[#f36d00]"
                      checked={active}
                      onChange={() => setSelectedId(v.id)}
                    />
                    <span className="flex-1 text-sm font-semibold text-grey-darkest">
                      {v.name}
                    </span>
                    <span className="text-sm font-bold text-grey-darkest">{money(v.price)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Have you seen — side dishes whose price lands in the total below */}
          {others.length > 0 && (
            <section className="mt-5 border-t border-grey-light pt-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h4 className="text-lg font-extrabold text-grey-darkest">
                    Have you seen&hellip;?
                  </h4>
                  <p className="mt-0.5 text-sm text-grey-dark">
                    Favourites the regulars keep coming back for.
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => scrollCarousel(-1)}
                    disabled={!canLeft}
                    className="flex h-9 w-9 items-center justify-center rounded-button border border-grey-light text-grey-darkest hover:border-grey-midDark disabled:opacity-35"
                    aria-label="Scroll left"
                  >
                    <IconChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCarousel(1)}
                    disabled={!canRight}
                    className="flex h-9 w-9 items-center justify-center rounded-button border border-grey-light text-grey-darkest hover:border-grey-midDark disabled:opacity-35"
                    aria-label="Scroll right"
                  >
                    <IconChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <ul
                ref={carouselRef}
                className="je-no-scrollbar -mx-5 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1"
              >
                {others.slice(0, 8).map((s) => {
                  const multi = s.variations.length > 1;
                  const n = countOf(s.id);
                  return (
                    <li key={s.id} className="w-36 shrink-0 snap-start">
                      <div className="flex flex-col items-center gap-2 rounded-button border border-grey-light p-2 text-center">
                        <DishImage item={s} className="h-20 w-20" />
                        <div className="w-full min-w-0">
                          <p className="truncate text-sm font-bold text-grey-darkest">{s.name}</p>
                          <p className="text-xs font-medium text-grey-midDark">
                            {multi ? `from ${money(priceOf(s))}` : money(priceOf(s))}
                          </p>
                        </div>
                        {n > 0 ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => bump(s.id, -1)}
                              className="flex h-8 w-8 items-center justify-center rounded-button border border-grey-light text-grey-darkest hover:border-grey-midDark"
                              aria-label={`Remove one ${s.name}`}
                            >
                              <IconMinus className="h-4 w-4" />
                            </button>
                            <span className="w-4 text-center text-sm font-bold text-grey-darkest">
                              {n}
                            </span>
                            <button
                              type="button"
                              onClick={() => bump(s.id, 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-button border border-grey-light text-grey-darkest hover:border-orange hover:text-orange"
                              aria-label={`Add ${s.name}`}
                            >
                              <IconPlus className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => bump(s.id, 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-button border border-grey-light text-orange hover:border-orange hover:bg-orange-offWhite"
                            aria-label={`Add ${s.name}`}
                          >
                            <IconPlus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        {/* Footer — total = item + picked "Have you seen" side dishes */}
        <div className="flex items-center gap-3 border-t border-grey-light p-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-grey-midDark">Total</p>
            <p className="text-lg font-extrabold text-orange-aa">{money(total)}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="je-btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={confirm} className="je-btn-primary">
              Add &middot; {money(total)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Renders the whole menu: search + sticky category nav + item lists. */
export function MenuBrowser({ categories }: { categories: MenuCategory[] }) {
  const [query, setQuery] = useState("");

  /** Popular dishes across the whole menu, deduped, for the picker's "Have you seen…?" */
  const popular = useMemo(
    () =>
      Array.from(
        new Map(
          categories
            .flatMap((c) => c.items)
            .filter((i) => i.isPopular)
            .map((i) => [i.id, i])
        ).values()
      ),
    [categories]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((c) => ({
        ...c,
        items: c.items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.description ?? "").toLowerCase().includes(q)
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, query]);

  return (
    <div>
      <div className="mb-4">
        <label htmlFor="menu-search" className="sr-only">
          Search the menu
        </label>
        <input
          id="menu-search"
          type="search"
          className="je-input"
          placeholder="Search the menu, e.g. doner, margherita, family deal"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Sticky category nav — the Just Eat pattern for long menus */}
      <nav
        aria-label="Menu categories"
        className="sticky top-16 z-20 -mx-4 mb-6 border-y border-grey-light bg-white/95 px-4 backdrop-blur"
      >
        <ul className="je-no-scrollbar flex gap-1 overflow-x-auto py-2">
          {visible.map((c) => (
            <li key={c.id}>
              <a
                href={`#${c.slug}`}
                onClick={(e) => {
                  // Keep the clicked tab centred in the strip so the tabs
                  // after it scroll into view (e.g. the last visible one).
                  const strip = e.currentTarget.closest<HTMLElement>(".je-no-scrollbar");
                  if (!strip) return;
                  const stripRect = strip.getBoundingClientRect();
                  const tabRect = e.currentTarget.getBoundingClientRect();
                  const target =
                    strip.scrollLeft +
                    (tabRect.left - stripRect.left) -
                    (stripRect.width / 2 - tabRect.width / 2);
                  strip.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
                }}
                className="block whitespace-nowrap rounded-button px-3 py-1.5 text-sm font-semibold text-grey-darkest hover:bg-grey-lighter"
              >
                {c.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {visible.length === 0 ? (
        <p className="je-card p-8 text-center text-sm text-grey-dark">
          No menu items match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="space-y-10">
          {visible.map((c) => (
            <section key={c.id} id={c.slug} className="scroll-mt-36">
              <h2 className="mb-3 text-xl font-extrabold text-grey-darkest">{c.name}</h2>
              <ul className="space-y-3">
                {c.items.map((i) => (
                  <MenuItemCard key={i.id} item={i} suggested={popular} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
