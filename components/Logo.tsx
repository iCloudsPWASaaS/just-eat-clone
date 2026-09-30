import Link from "next/link";

/**
 * Restaurant brand mark shown in the header, footer and auth screens.
 *
 * Uses the restaurant's menu poster hosted on their own site as the logo.
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
      aria-label="Just Eat — home"
      className={`inline-flex items-center ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://woodfarm.nexolo.co.uk/storage/316/Restaurant-Menu-A3-Landscape.png"
        alt="Woodfarm Kebab & Pizza"
        width={640}
        height={457}
        className="h-10 w-auto max-w-[200px] object-contain"
      />
    </Link>
  );
}