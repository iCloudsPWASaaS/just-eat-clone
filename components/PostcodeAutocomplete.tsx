"use client";

import { useEffect, useRef, useState } from "react";
import { loadPlaces } from "@/components/AddressAutocomplete";

/**
 * Postcode input with Google Places suggestions (UK only). Picking a
 * suggestion fills the field with just the postcode; `onPick` lets the
 * surrounding widget act immediately (e.g. run the delivery check).
 * Falls back to a plain input if Places can't load.
 */
export default function PostcodeAutocomplete({
  id,
  value,
  onChange,
  onPick,
  onEnter,
  placeholder,
  label,
  className = "je-input",
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onPick?: (postcode: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    loadPlaces()
      .then(() => {
        if (cancelled || !inputRef.current) return;
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ["address_components"],
          componentRestrictions: { country: "gb" },
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const postal = (place.address_components ?? []).find((c) =>
            c.types.includes("postal_code")
          );
          if (!postal) return;
          onChange(postal.long_name);
          onPick?.(postal.long_name);
        });
        setStatus("ready");
      })
      .catch(() => setStatus("failed"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {label && <label htmlFor={id} className="je-label">{label}</label>}
      <input
        ref={inputRef}
        id={id}
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter?.();
          }
        }}
        autoComplete="postal-code"
      />
      {status === "failed" && (
        <p className="mt-1 text-xs text-grey-midDark">
          Address lookup is unavailable — please type your postcode.
        </p>
      )}
    </div>
  );
}