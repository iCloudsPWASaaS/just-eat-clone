import { notFound } from "next/navigation";
import type { Metadata } from "next";
import RestaurantHero from "@/components/RestaurantHero";
import { MenuBrowser } from "@/components/MenuBrowser";
import { FulfilmentPicker } from "@/components/FulfilmentPicker";
import ReviewsSection from "@/components/ReviewsSection";
import FaqSection from "@/components/FaqSection";
import { DeliveryCheck, OpeningHours } from "@/components/RestaurantInfo";
import { IconCheck, IconInfo, IconPin } from "@/components/Icons";
import { getMenuData, getReviews } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { restaurant } = await getMenuData();
  return {
    title: restaurant.keywordSeoTitle ?? restaurant.name,
    description: restaurant.keywordSeoDesc ?? restaurant.description ?? undefined,
  };
}

/** UK Food Standards Agency band names, keyed by rating out of 5. */
const HYGIENE_LABELS: Record<number, string> = {
  5: "Very good",
  4: "Good",
  3: "Satisfactory",
  2: "Needs improvement",
  1: "Poor",
  0: "Very poor",
};

function hygieneLabel(rating: number | null): string {
  if (rating === null) return "Not rated";
  return HYGIENE_LABELS[Math.round(rating)] ?? "Not rated";
}

export default async function RestaurantPage() {
  const data = await getMenuData();
  const reviews = await getReviews();

  if (!data.restaurant) notFound();

  const { restaurant, categories, hours, faqs, zones, deals } = data;
  const dishCount = categories.reduce((n, c) => n + c.items.length, 0);

  return (
    <>
      <RestaurantHero />

      {/* Deals strip */}
      {deals.length > 0 && (
        <section className="border-b border-grey-light bg-jet-offWhite">
          <div className="je-container py-3">
            <ul className="flex flex-wrap gap-2">
              {deals.map((d) => (
                <li key={d.id} className="je-chip bg-white text-orange-aa">
                  <span className="font-bold">{d.badge ?? "Offer"}</span>
                  <span className="font-normal text-grey-dark">{d.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="je-container grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="min-w-0 space-y-12">
          {/* About */}
          <section id="about" className="scroll-mt-24">
            <h2 className="text-2xl font-extrabold text-grey-darkest">
              {restaurant.name} &mdash; food delivery in {restaurant.city}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-grey-dark">
              {restaurant.description}
            </p>

            <ul className="mt-4 flex flex-wrap gap-2">
              <li className="je-chip bg-green-offWhite text-green">
                <IconCheck className="h-3.5 w-3.5" /> Halal
              </li>
              <li className="je-chip">
                <IconPin className="h-3.5 w-3.5" /> {restaurant.postcode}
              </li>
              {restaurant.foodHygieneRating !== null && (
                <li className="je-chip bg-green-offWhite text-green">
                  <IconCheck className="h-3.5 w-3.5" /> Food hygiene{" "}
                  {hygieneLabel(restaurant.foodHygieneRating)}
                </li>
              )}
              {restaurant.isVegetarian && (
                <li className="je-chip bg-green-offWhite text-green">
                  <IconCheck className="h-3.5 w-3.5" /> Vegetarian options
                </li>
              )}
              {restaurant.acceptsCod && (
                <li className="je-chip">
                  <IconInfo className="h-3.5 w-3.5" /> Cash on delivery
                </li>
              )}
            </ul>
          </section>

{/* Menu */}
          <section id="menu" className="scroll-mt-24">
            <h2 className="text-2xl font-extrabold text-grey-darkest">Menu</h2>
            <p className="-mt-2 mb-4 text-sm text-grey-dark">
              {categories.length} categories and {dishCount} dishes available for delivery
              and collection.
            </p>
            <FulfilmentPicker restaurant={restaurant} className="mb-5 lg:hidden" />
            <MenuBrowser categories={categories} />
          </section>

          <ReviewsSection
            reviews={reviews}
            rating={restaurant.rating}
            ratingCount={restaurant.ratingCount}
          />
          <FaqSection faqs={faqs} />
        </div>

        {/* Sidebar */}
        <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          <FulfilmentPicker restaurant={restaurant} className="hidden lg:block" />
          <DeliveryCheck restaurant={restaurant} zones={zones} />
          <OpeningHours hours={hours} />

          <section>
            <h2 className="text-lg font-extrabold text-grey-darkest">Restaurant details</h2>
            <dl className="je-card mt-3 divide-y divide-grey-light text-sm">
              <Row label="Address">
                {restaurant.addressLine1}
                <br />
                {restaurant.city}, {restaurant.postcode}
              </Row>
              {restaurant.phone && (
                <Row label="Telephone">
                  <a href={`tel:${restaurant.phone.replace(/\s+/g, "")}`} className="je-link">
                    {restaurant.phone}
                  </a>
                </Row>
              )}
              {restaurant.website && (
                <Row label="Website">
                  <a
                    href={restaurant.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="je-link break-all"
                  >
                    {restaurant.website.replace(/^https?:\/\//, "")}
                  </a>
                </Row>
              )}
              <Row label="Cuisine">{restaurant.cuisines.join(", ")}</Row>
              {restaurant.priceRange && <Row label="Price">{restaurant.priceRange}</Row>}
              {restaurant.foodHygieneRating !== null && (
                <Row label="Food hygiene">
                  {restaurant.foodHygieneRating}/5 &mdash;{" "}
                  {hygieneLabel(restaurant.foodHygieneRating)}
                </Row>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <dt className="w-24 shrink-0 text-grey-midDark">{label}</dt>
      <dd className="min-w-0 flex-1 text-grey-darkest">{children}</dd>
    </div>
  );
}
