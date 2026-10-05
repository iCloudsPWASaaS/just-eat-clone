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
import type {
  MenuCategory,
  MenuItem,
  MenuVariation,
  ModifierGroup,
  ModifierOption,
  ModifierSelection,
} from "@/lib/types";

/**
 * Names a restaurant uses to mean "this dish has no size choice" rather than to
 * name a size. Just Eat models these as a `NoVariation` with an empty label; the
 * eateasy mirror we import from names them "Standard".
 */
const PLACEHOLDER_VARIATIONS = /^standard$/i;

function isPlaceholderVariation(name: string): boolean {
  return PLACEHOLDER_VARIATIONS.test(name.trim());
}

/** Total picked in a group, excluding one option — used for the remaining cap. */
function countInWith(
  group: ModifierGroup,
  picked: Map<string, number>,
  exceptOptionId: string
): number {
  return group.options.reduce(
    (sum, o) => (o.id === exceptOptionId ? sum : sum + (picked.get(o.id) ?? 0)),
    0
  );
}

/** Short summary of the pickers on a dish, e.g. "Choose salad & sauce". */
function pickNoun(groups: ModifierGroup[]): string | null {
  const names = groups
    .map((g) => g.name.replace(/^Choose\s+(your\s+)?/i, "").trim())
    .filter(Boolean);
  if (!names.length) return null;
  if (names.length === 1) return `Choose ${names[0].toLowerCase()}`;
  return `Choose ${names.slice(0, -1).map((n) => n.toLowerCase()).join(", ")} & ${names[names.length - 1].toLowerCase()}`;
}

export function MenuItemCard({ item, suggested }: { item: MenuItem; suggested?: MenuItem[] }) {
  const { add, setQuantity, linesForItem, isFavourite, toggleFavourite, user } = useBasket();
  const [pickerFor, setPickerFor] = useState<MenuItem | null>(null);
  const [favBusy, setFavBusy] = useState(false);

  const defaultVariation = item.variations.find((v) => v.isDefault) ?? item.variations[0] ?? null;

  // An item needs the picker when it has a choice to make: several real sizes,
  // or any "choose your ..." group. A lone "Standard" variation is not a choice.
  const hasGroups = item.variations.some((v) => v.modifierGroups.length > 0);
  const hasVariations =
    item.variations.filter((v) => !isPlaceholderVariation(v.name)).length > 1;
  const needsPicker = hasVariations || hasGroups;

  // Customisations make every line distinct, so the stepper works off the lines
  // themselves rather than a single item/variation pair.
  const lines = linesForItem(item.id);
  const totalQuantity = lines.reduce((n, l) => n + l.quantity, 0);
  const favourite = isFavourite(item.id);

  /** Distinct customisations already in the basket, e.g. "Garlic Mayo". */
  const chosenLabels = useMemo(
    () => Array.from(new Set(lines.flatMap((l) => l.modifiers.map((m) => m.optionName)))),
    [lines]
  );

  // Step the first line that exists, or the most recently added one.
  const activeLineId = lines[0]?.id ?? null;

  const onAdd = () => {
    if (needsPicker) {
      setPickerFor(item);
      return;
    }
    add(item, defaultVariation, 1);
  };

  const onDecrement = () => {
    if (!activeLineId) return;
    setQuantity(activeLineId, (lines[0]?.quantity ?? 1) - 1);
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

            {/* A hint rather than the pickers themselves — those live in the
                modal, matching how Just Eat keeps long option lists out of the
                scrolling menu. */}
            {hasGroups && (
              <p className="mt-1 text-xs font-medium text-grey-midDark">
                {pickNoun(defaultVariation?.modifierGroups ?? [])}
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

              {chosenLabels.length > 0 && (
                <span className="truncate text-xs text-grey-midDark">
                  {chosenLabels.join(", ")}
                </span>
              )}

              {totalQuantity > 0 ? (
                <div className="flex items-center gap-1 rounded-button border border-grey-midDark px-1">
                  <button
                    type="button"
                    onClick={onDecrement}
                    className="flex h-8 w-8 items-center justify-center text-grey-darkest hover:text-orange"
                    aria-label={`Remove ${item.name} from basket`}
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

  /**
   * Pickers are keyed by option id and hold a quantity, so a group can allow
   * "up to 5" of one option as easily as one of two. Reset whenever the chosen
   * size changes, because each variation carries its own groups.
   */
  const [picked, setPicked] = useState<Map<string, number>>(new Map());

  /** Suggested dishes, minus the one being composed. */
  const others = useMemo(
    () => suggested.filter((s) => s.id !== item.id),
    [suggested, item.id]
  );

  /**
   * Variations that represent a real choice of size or style. A lone
   * placeholder like "Standard" is the dish itself at a single price, so it is
   * not shown as an option — it is still kept as the selected variation, since
   * the modifier groups hang off it.
   */
  const sizes = useMemo(
    () => item.variations.filter((v) => !isPlaceholderVariation(v.name)),
    [item.variations]
  );

  const groups = useMemo(() => selected?.modifierGroups ?? [], [selected]);

  // Switching size swaps the whole picker set, so stale choices must go.
  useEffect(() => {
    setPicked(new Map());
  }, [selectedId]);

  const countIn = (group: ModifierGroup) =>
    group.options.reduce((sum, o) => sum + (picked.get(o.id) ?? 0), 0);

  /**
   * Applies a delta to one option, respecting the group's remaining allowance.
   * Single-choice groups (maxSelect 1) simply overwrite, which is what makes the
   * radio behave like a radio.
   */
  const bumpOption = (group: ModifierGroup, option: ModifierOption, delta: number) => {
    setPicked((prev) => {
      const next = new Map(prev);
      if (group.maxSelect <= 1) {
        // Clearing the group first makes "pick one" and "pick none" both work.
        for (const o of group.options) next.delete(o.id);
        if (delta > 0) next.set(option.id, 1);
        return next;
      }
      const current = prev.get(option.id) ?? 0;
      const wanted = Math.max(0, current + delta);
      const others = countInWith(group, prev, option.id);
      const capped = Math.min(wanted, group.maxSelect - others);
      if (capped === 0) next.delete(option.id);
      else next.set(option.id, capped);
      return next;
    });
  };

  const selections = useMemo<ModifierSelection[]>(() => {
    const out: ModifierSelection[] = [];
    for (const group of groups) {
      for (const option of group.options) {
        const quantity = picked.get(option.id) ?? 0;
        if (quantity > 0) {
          out.push({
            groupId: group.id,
            optionId: option.id,
            groupName: group.name,
            optionName: option.name,
            quantity,
            priceDelta: option.priceDelta,
          });
        }
      }
    }
    return out;
  }, [groups, picked]);

  const modifiersDelta = selections.reduce((sum, s) => sum + s.priceDelta * s.quantity, 0);

  /** Groups still short of their minimum — blocks Add until resolved. */
  const incomplete = groups.filter((g) => countIn(g) < g.minSelect);

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
  const total = (selected?.price ?? 0) + modifiersDelta + extrasTotal;

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
    if (!selected || incomplete.length > 0) return;
    add(item, selected, 1, selections);
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
          {/* Dish image first, then the name and price — Just Eat's item-card
              layout. The price lives here rather than in the size list because
              a one-price item has no size list to hang it off. */}
          <div className="flex items-start gap-4">
            <DishImage item={item} className="h-20 w-20" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="min-w-0 text-lg font-bold text-grey-darkest">
                  {item.name}
                </h3>
                <span className="shrink-0 text-lg font-extrabold text-grey-darkest">
                  {money((selected?.price ?? item.basePrice) + modifiersDelta)}
                </span>
              </div>
              {item.description && (
                <p className="mt-1 text-sm leading-relaxed text-grey-dark">
                  {item.description}
                </p>
              )}
            </div>
          </div>

          {/* Size picker. Only worth showing when there is a choice to make —
              a single "Standard" variation is the dish at its one price, not a
              decision, and Just Eat omits the group entirely in that case. */}
          {sizes.length > 1 && (
            <fieldset className="mt-4">
              <legend className="je-label">
                <span className="font-bold text-grey-darkest">{item.name}</span>
                <span className="ml-1 font-medium text-grey-midDark">1 required</span>
              </legend>
              <div className="space-y-2">
                {sizes.map((v) => {
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
          )}

          {/* The "choose your ..." pickers, in the order the restaurant set them */}
          {groups.map((group) => (
            <ModifierPicker
              key={group.id}
              group={group}
              picked={picked}
              onBump={bumpOption}
              otherPicked={(id) => picked.get(id) ?? 0}
            />
          ))}

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
            <button
              type="button"
              onClick={confirm}
              className="je-btn-primary disabled:cursor-not-allowed disabled:opacity-45"
              disabled={incomplete.length > 0}
            >
              {incomplete.length > 0
                ? `Choose ${incomplete.length} more`
                : `Add · ${money(total)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One "choose your ..." group.
 *
 * The control follows the source data: `maxSelect` of 1 renders radios, higher
 * values render checkboxes with a quantity stepper, and `minSelect` decides
 * whether the header says "Optional" or "N Required". Long option lists
 * collapse behind "Show N more", which is what Just Eat does for its 20-option
 * topping list.
 */
function ModifierPicker({
  group,
  picked,
  onBump,
  otherPicked,
}: {
  group: ModifierGroup;
  picked: Map<string, number>;
  onBump: (group: ModifierGroup, option: ModifierOption, delta: number) => void;
  otherPicked: (optionId: string) => number;
}) {
  const single = group.maxSelect <= 1;
  /**
   * An optional one-of-N group ("Choose Rice or Chips"). Radio buttons cannot be
   * unticked once set, so these render as checkboxes that still allow only one
   * choice at a time.
   */
  const toggleable = single && group.minSelect === 0 && group.options.length > 1;
  const [expanded, setExpanded] = useState(false);
  const VISIBLE = 4;

  const chosen = group.options.reduce((n, o) => n + (picked.get(o.id) ?? 0), 0);
  const hidden = single ? 0 : group.maxSelect - chosen;

  // Anything already chosen stays visible, so a selection further down the list
  // does not vanish behind the expander.
  const shown = expanded
    ? group.options
    : group.options
        .slice(0, VISIBLE)
        .concat(group.options.slice(VISIBLE).filter((o) => (picked.get(o.id) ?? 0) > 0));
  const hiddenCount = group.options.length - shown.length;

  const requirement =
    group.minSelect > 0
      ? `${group.minSelect} Required`
      : "Optional";

  return (
    <fieldset className="mt-5 border-t border-grey-light pt-4">
      <legend className="je-label w-full px-0">
        <span className="font-bold text-grey-darkest">{group.name}</span>
        <span className="ml-1 font-medium text-grey-midDark">{requirement}</span>
        {!single && group.maxSelect > 1 && group.maxSelect < 20 && (
          <span className="ml-1 font-medium text-grey-midDark">
            &middot; up to {group.maxSelect}
          </span>
        )}
      </legend>

      <div className="space-y-2">
        {shown.map((o) => {
          const qty = picked.get(o.id) ?? 0;
          const active = qty > 0;
          const atCap = !single && chosen >= group.maxSelect && !active;

const row = (
            <>
              <input
                type={single && !toggleable ? "radio" : "checkbox"}
                name={`modifier-${group.id}`}
                className="h-4 w-4 accent-[#f36d00]"
                checked={active}
                disabled={atCap}
                onChange={() => {
                  if (toggleable) {
                    // Clear the rest of the group first, so ticking one box
                    // unticks whichever was set.
                    for (const other of group.options) onBump(group, other, -otherPicked(other.id));
                    if (!active) onBump(group, o, 1);
                    return;
                  }
                  onBump(group, o, active ? -qty : 1);
                }}
              />
              <span className="flex-1 text-sm font-semibold text-grey-darkest">
                {o.name}
                {active && !single && qty > 1 && (
                  <span className="ml-1.5 font-bold text-orange-aa">&times;{qty}</span>
                )}
              </span>
              {o.priceDelta !== 0 && (
                <span className="text-sm font-bold text-grey-darkest">
                  {o.priceDelta > 0 ? "+" : ""}
                  {money(o.priceDelta)}
                </span>
              )}
            </>
          );

          return single ? (
            <label
              key={o.id}
              className={`flex cursor-pointer items-center gap-3 rounded-button border px-3 py-2.5 transition ${
                active
                  ? "border-orange bg-orange-offWhite"
                  : "border-grey-light hover:border-grey-midDark"
              }`}
            >
              {row}
            </label>
          ) : (
            <div
              key={o.id}
              className={`flex items-center gap-2 rounded-button border px-3 py-2 transition ${
                active
                  ? "border-orange bg-orange-offWhite"
                  : atCap
                    ? "border-grey-light opacity-50"
                    : "border-grey-light hover:border-grey-midDark"
              }`}
            >
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                {row}
              </label>
              {/* Repeats only make sense once an option is picked. */}
              {active && group.maxSelect > 1 && (
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onBump(group, o, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-grey-light text-grey-darkest hover:border-grey-midDark"
                    aria-label={`Remove one ${o.name}`}
                  >
                    <IconMinus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-4 text-center text-sm font-bold text-grey-darkest">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => onBump(group, o, 1)}
                    disabled={hidden <= 0}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-grey-light text-grey-darkest hover:border-orange hover:text-orange disabled:opacity-35"
                    aria-label={`Add one ${o.name}`}
                  >
                    <IconPlus className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 text-sm font-bold text-orange-aa hover:underline"
        >
          Show {hiddenCount} more
        </button>
      )}
      {expanded && group.options.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-2 text-sm font-bold text-grey-midDark hover:underline"
        >
          Show fewer
        </button>
      )}
    </fieldset>
  );
}

/** Sticky category nav with scroll arrows. */
function CategoryNav({ categories }: { categories: MenuCategory[] }) {
  const stripRef = useRef<HTMLUListElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = stripRef.current;
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

  const scrollStrip = (dir: 1 | -1) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <nav aria-label="Menu categories" className="sticky top-16 z-20 -mx-4 mb-6 border-y border-grey-light bg-white/95 px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => scrollStrip(-1)}
          disabled={!canLeft}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button border border-grey-light text-grey-darkest hover:bg-grey-lighter disabled:opacity-35"
          aria-label="Scroll categories left"
        >
          <IconChevronLeft className="h-5 w-5" />
        </button>
        <ul ref={stripRef} className="je-no-scrollbar flex-1 flex gap-1 overflow-x-auto py-2">
          {categories.map((c) => (
            <li key={c.id}>
              <a
                href={`#${c.slug}`}
                onClick={(e) => {
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
        <button
          type="button"
          onClick={() => scrollStrip(1)}
          disabled={!canRight}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button border border-grey-light text-grey-darkest hover:bg-grey-lighter disabled:opacity-35"
          aria-label="Scroll categories right"
        >
          <IconChevronRight className="h-5 w-5" />
        </button>
      </div>
    </nav>
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
      <CategoryNav categories={visible} />

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
