import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { IconCheck } from "@/components/Icons";
import { OrderActions } from "@/components/OrderActions";
import { getMenuData, getOrderByReference } from "@/lib/data";
import { createClient } from "@/lib/server";
import { money } from "@/lib/money";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your order | Woodfarm Kebab & Pizza",
  robots: { index: false, follow: false },
};

const STATUS_COPY: Record<string, { label: string; blurb: string }> = {
  pending: {
    label: "Order received",
    blurb: "The restaurant has your order and will confirm shortly.",
  },
  confirmed: {
    label: "Confirmed",
    blurb: "The restaurant has confirmed your order and will start cooking soon.",
  },
  preparing: {
    label: "Preparing your food",
    blurb: "Your order is being made now.",
  },
  out_for_delivery: {
    label: "Out for delivery",
    blurb: "Your driver is on the way.",
  },
  collected: { label: "Collected", blurb: "This order has been collected." },
  delivered: { label: "Delivered", blurb: "This order was delivered. Enjoy your meal!" },
  cancelled: { label: "Cancelled", blurb: "This order was cancelled." },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: { reference: string };
  searchParams: { placed?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const order = await getOrderByReference(user.id, params.reference);
  if (!order) notFound();

  const { restaurant } = await getMenuData();
  const justPlaced = searchParams.placed === "1";
  const status = STATUS_COPY[order.status] ?? { label: order.status, blurb: "" };

  return (
    <div className="je-container max-w-3xl py-10">
      {justPlaced && (
        <div className="je-alert-success mb-6 flex items-start gap-3">
          <IconCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Order placed</p>
            <p className="mt-0.5">
              Thanks{order.contactName ? `, ${order.contactName.split(" ")[0]}` : ""} —{" "}
              {restaurant.name} has your order. Keep your reference handy.
            </p>
          </div>
        </div>
      )}

      <div className="je-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-grey-darkest">{status.label}</h1>
            <p className="mt-1 text-sm text-grey-dark">{status.blurb}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-grey-midDark">
              Order reference
            </p>
            <p className="mt-0.5 font-mono text-xl font-bold text-grey-darkest">
              {order.reference}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 border-y border-grey-light py-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-grey-midDark">
              Placed
            </dt>
            <dd className="mt-0.5 text-sm text-grey-darkest">{formatDate(order.placedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-grey-midDark">
              {order.fulfilmentType === "delivery" ? "Delivery" : "Collection"}
            </dt>
            <dd className="mt-0.5 text-sm text-grey-darkest">
              {order.fulfilmentType === "delivery"
                ? "To your saved address"
                : `From ${restaurant.postcode}`}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-grey-midDark">
              Estimated time
            </dt>
            <dd className="mt-0.5 text-sm text-grey-darkest">
              {order.etaMinutes ? `About ${order.etaMinutes} minutes` : "—"}
            </dd>
          </div>
        </dl>

        {order.deliveryAddress && (
          <section className="mt-5">
            <h2 className="text-sm font-bold text-grey-darkest">Delivering to</h2>
            <address className="mt-1 text-sm not-italic text-grey-dark">
              {order.deliveryAddress.firstName} {order.deliveryAddress.lastName}
              <br />
              {order.deliveryAddress.addressLine1}
              {order.deliveryAddress.addressLine2 ? (
                <>
                  <br />
                  {order.deliveryAddress.addressLine2}
                </>
              ) : null}
              <br />
              {order.deliveryAddress.city}, {order.deliveryAddress.postcode}
            </address>
            {order.deliveryAddress.deliveryNotes && (
              <p className="mt-2 text-sm text-grey-dark">
                <span className="font-semibold">Notes:</span>{" "}
                {order.deliveryAddress.deliveryNotes}
              </p>
            )}
          </section>
        )}

        <section className="mt-6 border-t border-grey-light pt-6">
          <h2 className="text-sm font-bold text-grey-darkest">Order progress</h2>
          <div className="mt-4">
            <OrderActions
              status={order.status}
              fulfilmentType={order.fulfilmentType}
              history={order.history}
              items={order.items}
            />
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-bold text-grey-darkest">
            {order.items.length} {order.items.length === 1 ? "item" : "items"}
          </h2>
          <ul className="mt-2 divide-y divide-grey-light">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-grey-darkest">
                    {item.quantity} &times; {item.name}
                  </span>
                  {item.variationName && item.variationName !== "Standard" && (
                    <span className="block text-xs text-grey-dark">{item.variationName}</span>
                  )}
                  {item.notes && (
                    <span className="block text-xs text-grey-midDark">{item.notes}</span>
                  )}
                </span>
                <span className="shrink-0 font-semibold text-grey-darkest">
                  {money(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <dl className="mt-5 space-y-2 border-t border-grey-light pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-grey-dark">Subtotal</dt>
            <dd className="font-semibold text-grey-darkest">{money(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-grey-dark">
              {order.fulfilmentType === "delivery" ? "Delivery" : "Collection"}
            </dt>
            <dd className="font-semibold text-grey-darkest">
              {order.deliveryFee === 0 ? "Free" : money(order.deliveryFee)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-grey-dark">Service fee</dt>
            <dd className="font-semibold text-grey-darkest">{money(order.serviceFee)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-green">
              <dt>Discount</dt>
              <dd className="font-semibold">-{money(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-grey-light pt-2 text-base">
            <dt className="font-bold text-grey-darkest">Total</dt>
            <dd className="font-bold text-grey-darkest">{money(order.total)}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/account" className="je-btn-secondary">
            Your orders
          </Link>
          <Link href="/#menu" className="je-btn-primary">
            Order something else
          </Link>
        </div>
      </div>
    </div>
  );
}
