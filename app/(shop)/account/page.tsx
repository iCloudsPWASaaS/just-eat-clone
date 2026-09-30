import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrders, getMenuData } from "@/lib/data";
import { createClient } from "@/lib/server";
import { money } from "@/lib/money";
import type { Order, OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-yellow-offWhite text-grey-darkest",
  confirmed: "bg-blue-offWhite text-blue-darkest",
  preparing: "bg-orange-offWhite text-orange-aa",
  out_for_delivery: "bg-blue-offWhite text-blue-darkest",
  collected: "bg-green-offWhite text-green",
  delivered: "bg-green-offWhite text-green",
  cancelled: "bg-red-offWhite text-red",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Order received",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for delivery",
  collected: "Collected",
  delivered: "Delivered",
  cancelled: "Cancelled",
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

export default async function AccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const [orders, { restaurant }] = await Promise.all([getOrders(user.id), getMenuData()]);

  return (
    <div>
      <h2 className="text-xl font-extrabold text-grey-darkest">Your orders</h2>

      {orders.length === 0 ? (
        <div className="je-card mt-4 p-10 text-center">
          <p className="text-base font-semibold text-grey-darkest">No orders yet</p>
          <p className="mt-1.5 text-sm text-grey-dark">
            When you order from {restaurant.name} it will show up here.
          </p>
          <Link href="/#menu" className="je-btn-primary je-btn-lg mt-6">
            Browse the menu
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} restaurantName={restaurant.name} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderRow({ order, restaurantName }: { order: Order; restaurantName: string }) {
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <li className="je-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-grey-darkest">{restaurantName}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                STATUS_STYLES[order.status] ?? "bg-grey-lighter text-grey-dark"
              }`}
            >
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
          <p className="mt-1 font-mono text-sm text-grey-dark">{order.reference}</p>
          <p className="text-sm text-grey-dark">
            {formatDate(order.placedAt)} &middot;{" "}
            {order.fulfilmentType === "delivery" ? "Delivery" : "Collection"} &middot;{" "}
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
        </div>

        <div className="text-right">
          <p className="text-lg font-extrabold text-grey-darkest">{money(order.total)}</p>
          <Link
            href={`/orders/${order.reference}`}
            className="mt-1 inline-block text-sm font-semibold text-blue hover:underline"
          >
            View order
          </Link>
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-grey-light pt-3 text-sm text-grey-dark">
        {order.items.slice(0, 4).map((i) => (
          <li key={i.id}>
            {i.quantity} &times; {i.name}
          </li>
        ))}
        {order.items.length > 4 && <li>and {order.items.length - 4} more</li>}
      </ul>
    </li>
  );
}
