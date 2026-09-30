import type { MenuItem } from "@/lib/types";

/**
 * Dish thumbnail. Falls back to a tinted monogram tile for the items that have
 * no photograph (branded drinks and the restaurant's own specials), so card
 * heights stay consistent without inventing a photo of a real dish.
 */
export function DishImage({
  item,
  className = "h-24 w-24",
}: {
  item: MenuItem;
  className?: string;
}) {
  if (item.imageUrl) {
    return (
      <img
        src={item.imageUrl}
        alt={item.name}
        width={96}
        height={96}
        loading="lazy"
        decoding="async"
        className={`${className} shrink-0 rounded-card border border-grey-light object-cover`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${className} flex shrink-0 items-center justify-center rounded-card border border-grey-light text-2xl font-extrabold uppercase`}
      style={{ backgroundColor: tint(item.name), color: "rgba(0,0,0,0.45)" }}
    >
      {item.name.trim().charAt(0)}
    </div>
  );
}

/** Stable, low-saturation background derived from the dish name. */
function tint(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 40; // 0-40deg keeps everything in the warm neutral range
  return `hsl(${hue} 32% 88%)`;
}
