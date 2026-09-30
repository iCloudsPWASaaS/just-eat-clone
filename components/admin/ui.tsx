import { STATUS_LABELS, STATUS_STYLES } from "@/lib/order-status";
import type { OrderStatus } from "@/lib/types";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`je-card overflow-hidden ${className}`}>{children}</div>;
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-extrabold text-grey-darkest">{children}</h1>
      {sub && <p className="mt-1 text-sm text-grey-dark">{sub}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
        STATUS_STYLES[status] ?? "bg-grey-lighter text-grey-dark"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="je-label">{label}</span>
      {children}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-xs font-semibold text-grey-darkest"
      aria-pressed={checked}
    >
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-orange" : "bg-grey-mid"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            checked ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
      {label}
    </button>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return <p className="text-xs font-semibold text-red">{message}</p>;
}

export function Saving({ saving }: { saving: boolean }) {
  return (
    <span
      className={`ms-1 text-xs font-semibold transition-opacity ${
        saving ? "opacity-100" : "opacity-0"
      } ${"text-grey-midDark"}`}
    >
      Saving&hellip;
    </span>
  );
}