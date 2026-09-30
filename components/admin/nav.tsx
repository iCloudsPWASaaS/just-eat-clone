"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/content", label: "Content" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto je-no-scrollbar">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-button px-3 py-2 text-sm font-semibold transition-colors ${
              active
                ? "bg-jet-offWhite text-orange-darkest"
                : "text-grey-dark hover:bg-grey-lighter hover:text-grey-darkest"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}