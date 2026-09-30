"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useBasket } from "@/components/BasketProvider";
import { IconCheck, IconInfo } from "@/components/Icons";
import { money } from "@/lib/money";
import type { Address, Restaurant } from "@/lib/types";

type AddressDraft = {
  id: string | null;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  phone: string;
  deliveryNotes: string;
};

const EMPTY: AddressDraft = {
  id: null,
  firstName: "",
  lastName: "",
  addressLine1: "",
  addressLine2: "",
  city: "Oxford",
  postcode: "",
  phone: "",
  deliveryNotes: "",
};

const PAYMENT_METHODS = [
  { value: "card", label: "Card payment", hint: "Pay online by debit or credit card" },
  { value: "cash", label: "Cash on delivery", hint: "Pay the driver when your order arrives" },
  { value: "paypal", label: "PayPal", hint: "Pay with your PayPal account" },
] as const;

export default function CheckoutClient({ restaurant }: { restaurant: Restaurant }) {
  const router = useRouter();
  const params = useSearchParams();
  const {
    lines,
    breakdown,
    fulfilment,
    setFulfilment,
    clear,
    hydrated,
    user,
    postcode,
  } = useBasket();

  const [address, setAddress] = useState<AddressDraft>(EMPTY);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [saveAddress, setSaveAddress] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]["value"]>("card");
  const [customerNotes, setCustomerNotes] = useState("");
  const [deliveryCheck, setDeliveryCheck] = useState<{
    state: "idle" | "checking" | "ok" | "fail";
    etaMinutes: number | null;
  }>({ state: "idle", etaMinutes: null });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Honour ?fulfilment=collection coming from the basket.
  useEffect(() => {
    if (params.get("fulfilment") === "collection") setFulfilment("collection");
  }, [params, setFulfilment]);

  // Prefill from the signed-in profile, then from the saved address book.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/addresses");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      const list: Address[] = data.addresses ?? [];
      if (cancelled) return;
      setSavedAddresses(list);
      const preferred = list.find((a) => a.isDefault) ?? list[0];
      if (preferred) {
        setAddress(toDraft(preferred));
        setSaveAddress(false);
      } else if (user.firstName || user.lastName) {
        setAddress((a) => ({
          ...a,
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          phone: user.phone ?? "",
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Debounced delivery check for the typed postcode.
  useEffect(() => {
    const pc = address.postcode.trim();
    if (fulfilment !== "delivery" || pc.length < 5) {
      setDeliveryCheck({ state: "idle", etaMinutes: null });
      return;
    }
    setDeliveryCheck((c) => ({ ...c, state: "checking" }));
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/delivery-check?postcode=${encodeURIComponent(pc)}`);
        const data = await res.json();
        setDeliveryCheck({
          state: data.deliverable ? "ok" : "fail",
          etaMinutes: data.etaMinutes ?? null,
        });
      } catch {
        setDeliveryCheck({ state: "idle", etaMinutes: null });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [address.postcode, fulfilment]);

  const set = (k: keyof AddressDraft) => (v: string) =>
    setAddress((a) => ({ ...a, [k]: v }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (fulfilment === "delivery") {
      if (!address.firstName.trim()) errs.firstName = "Enter your first name.";
      if (!address.lastName.trim()) errs.lastName = "Enter your last name.";
      if (!address.addressLine1.trim()) errs.addressLine1 = "Enter your street address.";
      if (!address.city.trim()) errs.city = "Enter your town or city.";
      if (!/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(address.postcode.trim())) {
        errs.postcode = "Enter a valid UK postcode, e.g. OX3 8RA.";
      }
      if (deliveryCheck.state === "fail") {
        errs.postcode = "We don't deliver to this postcode. Try collection instead.";
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setBusy(true);
    try {
      if (saveAddress && fulfilment === "delivery" && user && !address.id) {
        // Best-effort: a failure here must not block the order.
        await fetch("/api/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: address.firstName,
            lastName: address.lastName,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            city: address.city,
            postcode: address.postcode,
            phone: address.phone,
            deliveryNotes: address.deliveryNotes,
          }),
        }).catch(() => {});
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfilmentType: fulfilment,
          paymentMethod,
          customerNotes,
          addressId: address.id,
          address: {
            firstName: address.firstName,
            lastName: address.lastName,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            city: address.city,
            postcode: address.postcode,
            phone: address.phone,
            deliveryNotes: address.deliveryNotes,
          },
          lines: lines.map((l) => ({
            itemId: l.itemId,
            variationId: l.variationId,
            quantity: l.quantity,
            notes: l.notes,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "We couldn't place your order.");
        setBusy(false);
        return;
      }

      clear();
      router.push(`/orders/${data.order.reference}?placed=1`);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  if (!hydrated) {
    return <div className="je-container py-16 text-sm text-grey-midDark">Loading checkout…</div>;
  }

  if (lines.length === 0) {
    return (
      <div className="je-container py-16">
        <div className="je-card mx-auto max-w-lg p-10 text-center">
          <h1 className="text-2xl font-extrabold text-grey-darkest">Nothing to check out</h1>
          <p className="mt-2 text-sm text-grey-dark">Your basket is empty.</p>
          <Link href="/#menu" className="je-btn-primary je-btn-lg mt-6">
            Browse the menu
          </Link>
        </div>
      </div>
    );
  }

  const eta =
    fulfilment === "delivery"
      ? (deliveryCheck.etaMinutes ?? restaurant.deliveryEtaMax)
      : restaurant.collectionEtaMin;

  return (
    <div className="je-container py-8">
      <h1 className="text-3xl font-extrabold text-grey-darkest">Checkout</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          {/* Fulfilment */}
          <section className="je-card p-5">
            <h2 className="text-lg font-extrabold text-grey-darkest">
              How would you like your order?
            </h2>
            <div className="mt-3 grid gap-1 rounded-button bg-grey-lighter p-1 sm:grid-cols-2">
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
            <p className="mt-2 text-xs text-grey-dark">
              {fulfilment === "delivery"
                ? `About ${restaurant.deliveryEtaMin}–${restaurant.deliveryEtaMax} minutes`
                : `Ready in about ${restaurant.collectionEtaMin} minutes`}
            </p>
          </section>

          {/* Saved addresses */}
          {fulfilment === "delivery" && savedAddresses.length > 0 && (
            <section className="je-card p-5">
              <h2 className="text-lg font-extrabold text-grey-darkest">Saved addresses</h2>
              <ul className="mt-3 space-y-2">
                {savedAddresses.map((a) => {
                  const active = address.id === a.id;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setAddress(toDraft(a))}
                        className={`w-full rounded-button border p-3 text-left transition ${
                          active
                            ? "border-orange bg-orange-offWhite"
                            : "border-grey-light hover:border-grey-midDark"
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span className="text-sm font-bold text-grey-darkest">
                            {a.label}
                            {a.isDefault && (
                              <span className="ml-2 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase text-grey-dark">
                                Default
                              </span>
                            )}
                          </span>
                          {active && <IconCheck className="h-4 w-4 text-orange" />}
                        </span>
                        <span className="mt-0.5 block text-sm text-grey-dark">
                          {a.firstName} {a.lastName}, {a.addressLine1}, {a.city}, {a.postcode}
                        </span>
                      </button>
                    </li>
                  );
                })}
                <li>
                  <button
                    type="button"
                    onClick={() => setAddress(EMPTY)}
                    className="w-full rounded-button border border-dashed border-grey-midDark p-3 text-sm font-semibold text-blue hover:bg-grey-lighter"
                  >
                    Use a different address
                  </button>
                </li>
              </ul>
            </section>
          )}

          {/* Address */}
          {fulfilment === "delivery" && (
            <section className="je-card p-5">
              <h2 className="text-lg font-extrabold text-grey-darkest">Delivery address</h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field id="firstName" label="First name" value={address.firstName} onChange={set("firstName")} error={errors.firstName} autoComplete="given-name" />
                <Field id="lastName" label="Last name" value={address.lastName} onChange={set("lastName")} error={errors.lastName} autoComplete="family-name" />
              </div>

              <div className="mt-4">
                <Field id="addressLine1" label="Address line 1" value={address.addressLine1} onChange={set("addressLine1")} error={errors.addressLine1} autoComplete="address-line1" />
              </div>
              <div className="mt-4">
                <Field id="addressLine2" label="Address line 2 (optional)" value={address.addressLine2} onChange={set("addressLine2")} autoComplete="address-line2" />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field id="city" label="Town or city" value={address.city} onChange={set("city")} error={errors.city} autoComplete="address-level2" />
                <Field id="postcode" label="Postcode" value={address.postcode} onChange={set("postcode")} error={errors.postcode} autoComplete="postal-code" />
              </div>
              <div className="mt-4">
                <Field id="phone" label="Contact number (optional)" value={address.phone} onChange={set("phone")} autoComplete="tel" type="tel" />
              </div>
              <div className="mt-4">
                <label htmlFor="deliveryNotes" className="je-label">
                  Delivery notes (optional)
                </label>
                <textarea
                  id="deliveryNotes"
                  rows={2}
                  className="je-input resize-y"
                  placeholder="e.g. Ring the bell twice, leave at the door"
                  value={address.deliveryNotes}
                  onChange={(e) => set("deliveryNotes")(e.target.value)}
                />
              </div>

              {deliveryCheck.state === "ok" && (
                <p className="je-alert-success mt-4 flex items-start gap-2">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    We deliver to this postcode in around{" "}
                    <strong>{deliveryCheck.etaMinutes} minutes</strong>.
                  </span>
                </p>
              )}
              {deliveryCheck.state === "fail" && (
                <p className="je-alert-error mt-4 flex items-start gap-2">
                  <IconInfo className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    We don&rsquo;t deliver to this postcode. Switch to collection to order
                    anyway.
                  </span>
                </p>
              )}

              {user && (
                <label className="mt-4 flex items-start gap-2 text-sm text-grey-dark">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-[#f36d00]"
                  />
                  <span>Save this address to my account</span>
                </label>
              )}
            </section>
          )}

          {/* Collection note */}
          {fulfilment === "collection" && (
            <section className="je-card p-5">
              <h2 className="text-lg font-extrabold text-grey-darkest">Collection</h2>
              <p className="mt-2 text-sm text-grey-dark">
                Collect from <strong>{restaurant.addressLine1}</strong>, {restaurant.city},{" "}
                {restaurant.postcode}. We&rsquo;ll have your order ready in about{" "}
                {restaurant.collectionEtaMin} minutes. Bring your order reference.
              </p>
            </section>
          )}

          {/* Payment */}
          <section className="je-card p-5">
            <h2 className="text-lg font-extrabold text-grey-darkest">Payment</h2>
            <fieldset className="mt-3 space-y-2">
              <legend className="sr-only">Choose a payment method</legend>
              {PAYMENT_METHODS.map((m) => {
                const available =
                  m.value !== "cash" || restaurant.acceptsCod;
                return (
                  <label
                    key={m.value}
                    className={`flex items-start gap-3 rounded-button border p-3 transition ${
                      paymentMethod === m.value
                        ? "border-orange bg-orange-offWhite"
                        : "border-grey-light hover:border-grey-midDark"
                    } ${available ? "" : "opacity-50"}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      className="mt-0.5 h-4 w-4 accent-[#f36d00]"
                      checked={paymentMethod === m.value}
                      disabled={!available}
                      onChange={() => setPaymentMethod(m.value)}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-grey-darkest">
                        {m.label}
                      </span>
                      <span className="block text-xs text-grey-dark">{m.hint}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="mt-4">
              <label htmlFor="customerNotes" className="je-label">
                Order notes (optional)
              </label>
              <textarea
                id="customerNotes"
                rows={2}
                className="je-input resize-y"
                placeholder="e.g. Extra chilli, no onions"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
              />
            </div>
          </section>

          {submitError && (
            <div className="je-alert-error" role="alert">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || breakdown.belowMinimumOrder}
            className="je-btn-primary je-btn-lg je-btn-block"
          >
            {busy
              ? "Placing your order\u2026"
              : breakdown.belowMinimumOrder
                ? `${money(breakdown.minimumOrderValue - breakdown.subtotal)} more to order`
                : `Place order \u00b7 ${money(breakdown.total)}`}
          </button>
        </form>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="je-card p-5">
            <h2 className="text-lg font-extrabold text-grey-darkest">Your order</h2>

            <ul className="mt-4 divide-y divide-grey-light border-b border-grey-light">
              {lines.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-grey-darkest">
                      {l.quantity} &times; {l.name}
                    </span>
                    {l.variationName && l.variationName !== "Standard" && (
                      <span className="block text-xs text-grey-dark">{l.variationName}</span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold text-grey-darkest">
                    {money(l.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-grey-dark">Subtotal</dt>
                <dd className="font-semibold text-grey-darkest">{money(breakdown.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-grey-dark">
                  {fulfilment === "delivery" ? "Delivery" : "Collection"}
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

            <p className="mt-4 rounded-button bg-grey-lighter p-3 text-xs text-grey-dark">
              {fulfilment === "delivery" ? "Delivery" : "Collection"} to{" "}
              <strong className="text-grey-darkest">
                {fulfilment === "delivery"
                  ? address.postcode || postcode || "your address"
                  : restaurant.postcode}
              </strong>{" "}
              in approximately <strong className="text-grey-darkest">{eta} minutes</strong>.
            </p>

            <Link href="/basket" className="mt-3 block text-center text-sm font-semibold text-blue hover:underline">
              Edit basket
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function toDraft(a: Address): AddressDraft {
  return {
    id: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    addressLine1: a.addressLine1,
    addressLine2: a.addressLine2 ?? "",
    city: a.city,
    postcode: a.postcode,
    phone: a.phone ?? "",
    deliveryNotes: a.deliveryNotes ?? "",
  };
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete?: string;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="je-label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        className={error ? "je-error" : "je-input"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
      {error && (
        <p className="mt-1 text-xs font-medium text-red" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
