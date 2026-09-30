import { redirect } from "next/navigation";
import Link from "next/link";
import { adminStatus } from "@/lib/admin";
import { AdminNav } from "@/components/admin/nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const status = await adminStatus();
  if (!status.signedIn) redirect("/login?next=/admin");
  if (!status.isAdmin) redirect("/");

  return (
    <div className="min-h-screen bg-grey-lighter">
      <header className="sticky top-0 z-40 border-b border-grey-light bg-white shadow-card">
        <div className="je-container flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/admin" className="flex shrink-0 items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-card bg-jet text-lg font-extrabold text-white">
                W
              </span>
              <span className="hidden text-base font-extrabold leading-tight text-grey-darkest sm:block">
                Woodfarm
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-grey-midDark">
                  Admin console
                </span>
              </span>
            </Link>
            <AdminNav />
          </div>
          <Link href="/" className="je-btn-secondary !py-2 text-xs">
            View site
          </Link>
        </div>
      </header>
      <main className="je-container py-8">{children}</main>
    </div>
  );
}