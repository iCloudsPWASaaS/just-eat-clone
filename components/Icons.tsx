/** Inline icon set — avoids adding an icon package for the handful we need. */
type IconProps = { className?: string };

const base = "h-5 w-5";

export const IconPin = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

export const IconClock = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconBike = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <circle cx="5.5" cy="17" r="3.5" />
    <circle cx="18.5" cy="17" r="3.5" />
    <path d="M15 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" strokeLinecap="round" />
    <path d="M9 17h5l-2-6h-3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 11l2.5-4H18" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconBag = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path d="M5 8h14l-1 12H6L5 8z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" />
  </svg>
);

export const IconUser = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
  </svg>
);

export const IconHeart = ({ className = base, filled = false }: IconProps & { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path d="M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8C19.5 15.3 12 20 12 20z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconSearch = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" strokeLinecap="round" />
  </svg>
);

export const IconChevronDown = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconChevronLeft = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
    <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconChevronRight = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconPlus = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className} aria-hidden="true">
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);

export const IconMinus = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className} aria-hidden="true">
    <path d="M5 12h14" strokeLinecap="round" />
  </svg>
);

export const IconTrash = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconCheck = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className} aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconInfo = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" strokeLinecap="round" />
    <circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconStarOutline = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" className={className} aria-hidden="true">
    <path d="M10 1.6l2.47 5.28 5.53.72-4.06 3.9 1.03 5.6L10 14.4l-4.97 2.7 1.03-5.6L2 7.6l5.53-.72L10 1.6z" strokeLinejoin="round" />
  </svg>
);

export const IconPhone = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 5.2 2 2 0 0 1 6 3z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconRotate = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path d="M20 8a8.5 8.5 0 1 0 1.2 5.5" strokeLinecap="round" />
    <path d="M20 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconX = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className} aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
  </svg>
);
