import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/server";

const TABS = [
  { href: "/account", label: "Your orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/favourites", label: "Favourites" },
  { href: "/account/profile", label: "Profile" },
];

/** Shared chrome for every signed-in account screen. */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="je-container py-8">
      <h1 className="text-3xl font-extrabold text-grey-darkest">Your account</h1>
      <p className="mt-1 text-sm text-grey-dark">{user?.email}</p>

      <nav aria-label="Account sections" className="mt-6 border-b border-grey-light">
        <ul className="je-no-scrollbar -mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="block whitespace-nowrap border-b-2 border-transparent px-4 py-2.5 text-sm font-semibold text-grey-dark hover:border-grey-midDark hover:text-grey-darkest"
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="py-8">{children}</div>
    </div>
  );
}
