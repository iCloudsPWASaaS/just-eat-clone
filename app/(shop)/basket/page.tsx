import { Suspense } from "react";
import BasketPage from "@/components/BasketPage";
import { getMenuData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: { redirected?: string };
}) {
  const { restaurant } = await getMenuData();
  const redirected = searchParams.redirected === "1";

  return (
    <Suspense fallback={<div className="je-container py-16 text-sm text-grey-midDark">Loading…</div>}>
      <BasketPage restaurant={restaurant} redirected={redirected} />
    </Suspense>
  );
}
