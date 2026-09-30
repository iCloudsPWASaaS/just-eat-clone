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
import type { BasketLine, FulfilmentType, MenuItem, MenuVariation, Restaurant } from "@/lib/types";

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
  add: (item: MenuItem, variation: MenuVariation | null, quantity?: number) => void;
  remove: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  clear: () => void;
  quantityOf: (itemId: string, variationId: string | null) => number;
  toggleFavourite: (itemId: string) => Promise<boolean>;
  isFavourite: (itemId: string) => boolean;
};

const BasketContext = createContext<BasketContextValue | null>(null);

function lineKey(itemId: string, variationId: string | null) {
  return `${itemId}::${variationId ?? "base"}`;
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
      if (rawLines) setLines(JSON.parse(rawLines));
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
    (item: MenuItem, variation: MenuVariation | null, quantity = 1) => {
      const key = lineKey(item.id, variation?.id ?? null);
      const unitPrice = variation ? variation.price : item.basePrice;
      setLines((prev) => {
        const existing = prev.find(
          (l) => lineKey(l.itemId, l.variationId) === key
        );
        if (existing) {
          return prev.map((l) =>
            lineKey(l.itemId, l.variationId) === key
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
