import { Suspense } from "react";
import CheckoutClient from "@/components/CheckoutClient";
import { getMenuData } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Checkout | Woodfarm Kebab & Pizza",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const { restaurant } = await getMenuData();

  return (
    <Suspense
      fallback={<div className="je-container py-16 text-sm text-grey-midDark">Loading checkout…</div>}
    >
      <CheckoutClient restaurant={restaurant} />
    </Suspense>
  );
}
