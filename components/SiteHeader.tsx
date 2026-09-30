"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import PostcodeAutocomplete from "@/components/PostcodeAutocomplete";
import { useBasket } from "@/components/BasketProvider";
import { getCurrentUser, logout, type AuthUser } from "@/lib/auth";
import { IconBag, IconChevronDown, IconPin, IconUser } from "@/components/Icons";

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { itemCount, hydrated, setOpen, postcode, setPostcode } = useBasket();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [postcodeDraft, setPostcodeDraft] = useState("");

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, [pathname]);

  useEffect(() => {
    setPostcodeDraft(postcode);
  }, [postcode]);

  useEffect(() => {
    if (!accountOpen && !locationOpen) return;
    const close = (e: MouseEvent) => {
      // Ignore clicks inside the Google Places suggestion dropdown.
      if ((e.target as Element | null)?.closest?.(".pac-container")) return;
      setAccountOpen(false);
      setLocationOpen(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [accountOpen, locationOpen]);

  const onSignOut = async () => {
    await logout();
    setUser(null);
    setAccountOpen(false);
    router.push("/");
    router.refresh();
  };

  const savePostcode = () => {
    setPostcode(postcodeDraft.trim().toUpperCase());
    setLocationOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-grey-light bg-white">
      <div className="je-container">
        <div className="flex h-16 items-center gap-4">
          <Logo />

          {/* Postcode / location switcher */}
          <div className="relative ml-2 hidden lg:block">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLocationOpen((v) => !v);
                setAccountOpen(false);
              }}
              className="flex items-center gap-2 rounded-button px-2.5 py-1.5 text-left hover:bg-grey-lighter"
              aria-expanded={locationOpen}
            >
              <IconPin className="h-4 w-4 text-grey-dark" />
              <span className="leading-tight">
                <span className="block text-[11px] font-medium text-grey-midDark">
                  Deliver to
                </span>
                <span className="block text-sm font-semibold text-grey-darkest">
                  {postcode || "Set postcode"}
                </span>
              </span>
              <IconChevronDown className="h-4 w-4 text-grey-midDark" />
            </button>

            {locationOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 top-full z-50 mt-2 w-72 rounded-card border border-grey-light bg-white p-4 shadow-raised"
              >
                <label htmlFor="header-postcode" className="je-label">
                  Delivery postcode
                </label>
                <PostcodeAutocomplete
                  id="header-postcode"
                  value={postcodeDraft}
                  onChange={setPostcodeDraft}
                  onEnter={savePostcode}
                  placeholder="e.g. OX3 8RA"
                />
                <p className="mt-2 text-xs text-grey-dark">
                  We deliver to Marston, Headington, Cutteslowe and the wider Oxford
                  area.
                </p>
                <button type="button" onClick={savePostcode} className="je-btn-primary mt-3 je-btn-block">
                  Save
                </button>
              </div>
            )}
          </div>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            <Link
              href="/#reviews"
              className={`rounded-button px-3 py-2 text-sm font-semibold ${
                pathname === "/reviews" ? "text-orange" : "text-grey-darkest hover:bg-grey-lighter"
              }`}
            >
              Reviews
            </Link>
            <Link
              href="/#about"
              className="rounded-button px-3 py-2 text-sm font-semibold text-grey-darkest hover:bg-grey-lighter"
            >
              About
            </Link>
            <Link
              href="/#faq"
              className="rounded-button px-3 py-2 text-sm font-semibold text-grey-darkest hover:bg-grey-lighter"
            >
              Help
            </Link>
          </nav>

          {/* Account */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAccountOpen((v) => !v);
                setLocationOpen(false);
              }}
              className="flex items-center gap-2 rounded-button border border-grey-midDark px-3 py-2 text-sm font-semibold text-grey-darkest hover:bg-grey-lighter"
              aria-expanded={accountOpen}
            >
              <IconUser className="h-4 w-4" />
              <span className="hidden sm:inline">
                {user ? `${user.firstName ?? "Account"}` : "Sign in"}
              </span>
              <IconChevronDown className="h-4 w-4 text-grey-midDark" />
            </button>

            {accountOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full z-50 mt-2 w-60 rounded-card border border-grey-light bg-white p-1.5 shadow-raised"
              >
                {user ? (
                  <>
                    <div className="border-b border-grey-light px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-grey-darkest">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="truncate text-xs text-grey-midDark">{user.email}</p>
                    </div>
                    {[
                      { href: "/account", label: "Your orders" },
                      { href: "/account/addresses", label: "Addresses" },
                      { href: "/account/favourites", label: "Favourites" },
                      { href: "/account/profile", label: "Profile & settings" },
                    ].map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={() => setAccountOpen(false)}
                        className="block rounded-button px-3 py-2 text-sm text-grey-darkest hover:bg-grey-lighter"
                      >
                        {l.label}
                      </Link>
                    ))}
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="mt-1 block w-full rounded-button border-t border-grey-light px-3 py-2 text-left text-sm font-semibold text-grey-darkest hover:bg-grey-lighter"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setAccountOpen(false)}
                      className="block rounded-button px-3 py-2 text-sm font-semibold text-grey-darkest hover:bg-grey-lighter"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setAccountOpen(false)}
                      className="block rounded-button px-3 py-2 text-sm text-grey-darkest hover:bg-grey-lighter"
                    >
                      Create an account
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Basket */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative flex items-center gap-2 rounded-button bg-jet px-3 py-2 text-sm font-semibold text-white hover:bg-orange-dark"
            aria-label={`Basket, ${itemCount} items`}
          >
            <IconBag className="h-5 w-5" />
            <span className="hidden sm:inline">Basket</span>
            {hydrated && itemCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-orange-darkest">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
