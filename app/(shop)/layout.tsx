import { getMenuData } from "@/lib/data";
import { BasketProvider } from "@/components/BasketProvider";
import BasketPanel from "@/components/BasketPanel";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

/** Customer-facing chrome: header, footer and basket panel. */
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const { restaurant } = await getMenuData();

  return (
    <BasketProvider restaurant={restaurant}>
      <SiteHeader />
      <main className="flex-1 pb-24">{children}</main>
      <SiteFooter />
      <BasketPanel restaurant={restaurant} />
    </BasketProvider>
  );
}