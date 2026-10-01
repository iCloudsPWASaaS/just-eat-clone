"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getCurrentUser, type AuthUser } from "@/lib/auth";
import { priceBasket, round2, SERVICE_FEE, type PriceBreakdown } from "@/lib/pricing";
import {
  lineIdentity,
  type BasketLine,
  type FulfilmentType,
  type MenuItem,
  type MenuVariation,
  type ModifierSelection,
  type Restaurant,
} from "@/lib/types";

const STORAGE_KEY = "justeat.basket.v1";
const FULFILMENT_KEY = "justeat.fulfilment.v1";
const POSTCODE_KEY = "justeat.postcode.v1";

type BasketContextValue = {
  lines: BasketLine[];
  itemCount: number;
  fulfilment: FulfilmentType;
  postcode: string;
  discount: number;
  breakdown: PriceBreakdown;
  isOpen: boolean;
  hydrated: boolean;
  user: AuthUser | null;
  setFulfilment: (f: FulfilmentType) => void;
  setPostcode: (p: string) => void;
  setDiscount: (d: number) => void;
  setOpen: (open: boolean) => void;
  add: (
    item: MenuItem,
    variation: MenuVariation | null,
    quantity?: number,
    modifiers?: ModifierSelection[]
  ) => void;
  remove: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  clear: () => void;
  quantityOf: (itemId: string, variationId: string | null) => number;
  /** Every line for an item, so a card can show which customisations are in. */
  linesForItem: (itemId: string) => BasketLine[];
  toggleFavourite: (itemId: string) => Promise<boolean>;
  isFavourite: (itemId: string) => boolean;
};

const BasketContext = createContext<BasketContextValue | null>(null);

/** Modifiers are part of the key so different choices stay separate lines. */
function lineKey(itemId: string, variationId: string | null, modifiers: { optionId: string; quantity: number }[] = []) {
  return lineIdentity(itemId, variationId, modifiers);
}

/**
 * Fills in fields that a line saved by an older version of the app may be
 * missing. Baskets live in localStorage indefinitely, so a basket written
 * before modifier support was added has no `modifiers` key at all, and reading
 * it as-is would crash every component that renders a line.
 */
function normaliseLines(raw: unknown): BasketLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l): l is Record<string, unknown> => Boolean(l) && typeof l === "object")
    .map((l) => {
      const modifiers = Array.isArray(l.modifiers) ? l.modifiers : [];
      return {
        ...l,
        modifiers: modifiers.filter(
          (m): m is ModifierSelection =>
            Boolean(m) && typeof m === "object" && typeof m.optionId === "string"
        ),
      } as unknown as BasketLine;
    });
}

export function BasketProvider({
  restaurant,
  children,
}: {
  restaurant: Restaurant;
  children: ReactNode;
}) {
  const [lines, setLines] = useState<BasketLine[]>([]);
  const [fulfilment, setFulfilmentState] = useState<FulfilmentType>("delivery");
  const [postcode, setPostcodeState] = useState("");
  const [discount, setDiscount] = useState(0);
  const [isOpen, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [favourites, setFavourites] = useState<string[]>([]);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from localStorage once on the client to avoid SSR mismatch.
  useEffect(() => {
    try {
      const rawLines = window.localStorage.getItem(STORAGE_KEY);
      if (rawLines) setLines(normaliseLines(JSON.parse(rawLines)));
      const rawFulfilment = window.localStorage.getItem(FULFILMENT_KEY);
      if (rawFulfilment === "delivery" || rawFulfilment === "collection") {
        setFulfilmentState(rawFulfilment);
      }
      setPostcodeState(window.localStorage.getItem(POSTCODE_KEY) ?? "");
    } catch {
      // Corrupt or unavailable storage — start from an empty basket.
    }
    setHydrated(true);
  }, []);

  // Resolve the signed-in user so the basket can mirror server-side.
  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      if (u) {
        fetch("/api/basket")
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.favouriteItemIds) setFavourites(d.favouriteItemIds);
          })
          .catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const setFulfilment = useCallback((f: FulfilmentType) => {
    setFulfilmentState(f);
    window.localStorage.setItem(FULFILMENT_KEY, f);
    // Switching between delivery and collection changes the fee, so any
    // promo that was sized for the other mode should not silently persist.
    setDiscount(0);
  }, []);

  const setPostcode = useCallback((p: string) => {
    setPostcodeState(p);
    window.localStorage.setItem(POSTCODE_KEY, p);
  }, []);

  // Mirror the basket to Supabase while signed in so it survives a device
  // change. Debounced because quantity buttons fire rapidly.
  useEffect(() => {
    if (!hydrated || !user) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      fetch("/api/basket", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((l) => ({
            itemId: l.itemId,
            variationId: l.variationId,
            quantity: l.quantity,
            notes: l.notes,
            // Option ids and quantities only; the server re-prices from the
            // database, exactly as it does for the dish itself.
            modifiers: l.modifiers.map((m) => ({
              optionId: m.optionId,
              quantity: m.quantity,
            })),
            fulfilmentType: fulfilment,
          })),
        }),
      }).catch(() => {});
    }, 800);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [lines, user, hydrated, fulfilment]);

  const add = useCallback(
    (
      item: MenuItem,
      variation: MenuVariation | null,
      quantity = 1,
      modifiers: ModifierSelection[] = []
    ) => {
      const key = lineKey(item.id, variation?.id ?? null, modifiers);
      const basePrice = variation ? variation.price : item.basePrice;
      // Modifiers are a price delta on top of the dish, mirroring what the
      // server recomputes in lib/orders.ts.
      const delta = modifiers.reduce((sum, m) => sum + m.priceDelta * m.quantity, 0);
      const unitPrice = round2(basePrice + delta);
      setLines((prev) => {
        const existing = prev.find((l) => l.id === key);
        if (existing) {
          return prev.map((l) =>
            l.id === key
              ? {
                  ...l,
                  quantity: Math.min(l.quantity + quantity, 50),
                  lineTotal: round2(l.unitPrice * Math.min(l.quantity + quantity, 50)),
                }
              : l
          );
        }
        return [
          ...prev,
          {
            id: key,
            itemId: item.id,
            variationId: variation?.id ?? null,
            name: item.name,
            variationName: variation?.name ?? null,
            modifiers,
            unitPrice,
            quantity,
            notes: null,
            lineTotal: round2(unitPrice * quantity),
          },
        ];
      });
      setOpen(true);
    },
    []
  );

  const remove = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  }, []);

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.id !== lineId)
        : prev.map((l) =>
            l.id === lineId
              ? {
                  ...l,
                  quantity: Math.min(quantity, 50),
                  lineTotal: round2(l.unitPrice * Math.min(quantity, 50)),
                }
              : l
          )
    );
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setDiscount(0);
  }, []);

  const quantityOf = useCallback(
    (itemId: string, variationId: string | null) => {
      const key = lineKey(itemId, variationId);
      return lines.find((l) => l.id === key)?.quantity ?? 0;
    },
    [lines]
  );

  const isFavourite = useCallback((itemId: string) => favourites.includes(itemId), [favourites]);

  const linesForItem = useCallback(
    (itemId: string) => lines.filter((l) => l.itemId === itemId),
    [lines]
  );

  const toggleFavourite = useCallback(
    async (itemId: string) => {
      const active = favourites.includes(itemId);
      setFavourites((prev) =>
        active ? prev.filter((id) => id !== itemId) : [...prev, itemId]
      );
      if (!user) return !active;
      const res = await fetch("/api/favourites", {
        method: active ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) {
        // Roll the optimistic update back if the server rejected it.
        setFavourites((prev) =>
          active ? [...prev, itemId] : prev.filter((id) => id !== itemId)
        );
        return active;
      }
      return !active;
    },
    [favourites, user]
  );

  const breakdown = useMemo(
    () => priceBasket(lines, restaurant, fulfilment, discount),
    [lines, restaurant, fulfilment, discount]
  );

  const value = useMemo<BasketContextValue>(
    () => ({
      lines,
      itemCount: lines.reduce((n, l) => n + l.quantity, 0),
      fulfilment,
      postcode,
      discount,
      breakdown,
      isOpen,
      hydrated,
      user,
      setFulfilment,
      setPostcode,
      setDiscount,
      setOpen,
      add,
      remove,
      setQuantity,
      clear,
      quantityOf,
      linesForItem,
      toggleFavourite,
      isFavourite,
    }),
    [
      lines,
      fulfilment,
      postcode,
      discount,
      breakdown,
      isOpen,
      hydrated,
      user,
      setFulfilment,
      setPostcode,
      add,
      remove,
      setQuantity,
      clear,
      quantityOf,
      linesForItem,
      toggleFavourite,
      isFavourite,
    ]
  );

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket(): BasketContextValue {
  const ctx = useContext(BasketContext);
  if (!ctx) throw new Error("useBasket must be used inside <BasketProvider>");
  return ctx;
}

export { SERVICE_FEE };
