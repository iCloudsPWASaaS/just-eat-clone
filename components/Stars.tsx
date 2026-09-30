/**
 * Star rating. Matches the Just Eat treatment: solid orange stars with a
 * partial final star for the fractional part of the average.
 */
export default function Stars({
  value,
  size = 16,
  className = "",
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));
  const percent = (clamped / 5) * 100;

  return (
    <span
      className={`relative inline-block align-middle ${className}`}
      style={{ width: size * 5, height: size }}
      role="img"
      aria-label={`${clamped.toFixed(1)} out of 5 stars`}
    >
      <span className="absolute inset-0 flex" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={size} filled={false} />
        ))}
      </span>
      <span
        className="absolute inset-0 flex overflow-hidden"
        style={{ width: `${percent}%` }}
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={size} filled className="shrink-0" />
        ))}
      </span>
    </span>
  );
}

function Star({ size, filled, className = "" }: { size: number; filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path
        d="M10 1.6l2.47 5.28 5.53.72-4.06 3.9 1.03 5.6L10 14.4l-4.97 2.7 1.03-5.6L2 7.6l5.53-.72L10 1.6z"
        fill={filled ? "#ff8000" : "none"}
        stroke={filled ? "#ff8000" : "#c5ccd3"}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
