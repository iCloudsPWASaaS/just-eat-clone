import Link from "next/link";
import Logo from "@/components/Logo";

const columns = [
  {
    heading: "Order",
    links: [
      { href: "/", label: "Woodfarm Kebab & Pizza" },
      { href: "/#menu", label: "Full menu" },
      { href: "/basket", label: "Your basket" },
      { href: "/checkout", label: "Checkout" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/register", label: "Create an account" },
      { href: "/account", label: "Your orders" },
      { href: "/account/favourites", label: "Favourites" },
    ],
  },
  {
    heading: "Restaurant",
    links: [
      { href: "/#about", label: "About us" },
      { href: "/#reviews", label: "Reviews" },
      { href: "/#faq", label: "Frequently asked questions" },
      { href: "/#opening-hours", label: "Opening hours" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-grey-light bg-white">
      <div className="je-container py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-grey-dark">
              Order pizza, kebabs, wraps and burgers for delivery or collection in
              Marston, Oxford. Open every day 11:00&ndash;23:00.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.heading}>
              <h2 className="text-sm font-bold uppercase tracking-wide text-grey-darkest">
                {col.heading}
              </h2>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-grey-dark hover:text-blue hover:underline"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-grey-light pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-grey-midDark">
            &copy; {new Date().getFullYear()} Woodfarm Kebab &amp; Pizza. Demo storefront
            built with Next.js and Supabase.
          </p>
          <p className="text-xs text-grey-midDark">
            Not affiliated with Just Eat Takeaway.com. Restaurant data sourced from
            public listings.
          </p>
        </div>
      </div>
    </footer>
  );
}
