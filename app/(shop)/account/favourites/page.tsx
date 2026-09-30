import Link from "next/link";
import { redirect } from "next/navigation";
import { IconHeart } from "@/components/Icons";
import { getFavourites } from "@/lib/data";
import { createClient } from "@/lib/server";
import { money } from "@/lib/money";
import type { MenuItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FavouritesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/favourites");

  const favourites = await getFavourites(user.id);

  return (
    <div>
      <h2 className="text-xl font-extrabold text-grey-darkest">Your favourites</h2>

      {favourites.length === 0 ? (
        <div className="je-card mt-4 p-10 text-center">
          <p className="text-base font-semibold text-grey-darkest">Nothing saved yet</p>
          <p className="mt-1.5 text-sm text-grey-dark">
            Tap the heart on any menu item to save it here for next time.
          </p>
          <Link href="/#menu" className="je-btn-primary je-btn-lg mt-6">
            Browse the menu
          </Link>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {favourites.map((item) => (
            <FavouriteCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FavouriteCard({ item }: { item: MenuItem }) {
  const prices = item.variations.map((v) => v.price);
  const from = prices.length ? Math.min(...prices) : item.basePrice;
  const hasVariations = item.variations.length > 1;

  return (
    <li className="je-card flex flex-col p-4">
      <div className="flex items-start gap-2">
        <h3 className="flex-1 text-base font-bold text-grey-darkest">{item.name}</h3>
        <IconHeart className="h-4 w-4 shrink-0 fill-red text-red" />
      </div>
      {item.description && (
        <p className="mt-1 line-clamp-2 text-sm text-grey-dark">{item.description}</p>
      )}
      <p className="mt-3 text-base font-bold text-grey-darkest">
        {hasVariations ? `from ${money(from)}` : money(from)}
      </p>
      <Link href="/#menu" className="je-btn-secondary mt-3 w-full">
        View on menu
      </Link>
    </li>
  );
}
