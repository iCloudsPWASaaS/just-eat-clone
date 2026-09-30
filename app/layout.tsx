import type { Metadata } from "next";
import "./globals.css";
import { getMenuData } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  let title = "Woodfarm Kebab & Pizza | Kebab and Pizza delivery in Oxford";
  let description =
    "Order pizza, kebabs, wraps and burgers for delivery or collection in Marston, Oxford.";

  try {
    const { restaurant } = await getMenuData();
    title = restaurant.keywordSeoTitle ?? title;
    description = restaurant.keywordSeoDesc ?? description;
  } catch {
    // Fall back to the defaults above if the catalogue is unavailable.
  }

  return {
    title,
    description,
    openGraph: { title, description, type: "website", locale: "en_GB" },
  };
}

/**
 * Minimal root layout. The customer-facing chrome (header, footer, basket) is
 * provided by the `(shop)` route group, so the admin console can render as a
 * clean internal application without the shop chrome.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}