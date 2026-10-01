import Link from "next/link";

/**
 * Restaurant brand mark shown in the header, footer and auth screens.
 *
 * Uses the logotype shipped in `public/images/logo.png`.
 */
export default function Logo({
  className = "",
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="Woodfarm Kebab & Pizza — home"
      className={`inline-flex items-center ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo.png"
        alt="Woodfarm Kebab & Pizza"
        width={563}
        height={150}
        className="h-10 w-auto max-w-[200px] object-contain"
      />
    </Link>
  );
}