"use client";

import { useEffect, useRef, useState } from "react";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? "";

const CALLBACK = "__jetPlacesReady";
let placesPromise: Promise<typeof google> | null = null;

/** Loads the Maps JS API + Places library exactly once, then resolves. */
export function loadPlaces(): Promise<typeof google> {
  if (!KEY) return Promise.reject(new Error("Missing Places API key"));
  if (placesPromise) return placesPromise;
  placesPromise = new Promise((resolve, reject) => {
    window.setTimeout(() => reject(new Error("Places load timed out")), 8000);
    const g = window as unknown as Record<string, unknown>;
    const previous = g[CALLBACK];
    g[CALLBACK] = () => {
      if (typeof previous === "function") previous();
      resolve(window.google);
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      KEY
    )}&libraries=places&callback=${CALLBACK}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      g[CALLBACK] = undefined;
      reject(new Error("Failed to load Google Places"));
    };
    document.head.appendChild(script);
  });
  return placesPromise;
}

export type PlaceParts = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
};

function pick(components: google.maps.GeocoderAddressComponent[], ...types: string[]) {
  for (const type of types) {
    const found = components.find((c) => c.types.includes(type));
    if (found) return found.long_name || found.short_name;
  }
  return "";
}

/** Splits the Google place result into the fields our address form uses. */
function toParts(place: google.maps.places.PlaceResult): PlaceParts {
  const comps: google.maps.GeocoderAddressComponent[] = place.address_components ?? [];
  const streetNumber = pick(comps, "street_number");
  const route = pick(comps, "route");
  const subpremise = pick(comps, "subpremise");
  const premise = pick(comps, "premise");
  const sublocality = pick(comps, "sublocality_level_2", "sublocality_level_1", "sublocality");

  const addressLine1 = [premise, streetNumber, route].filter(Boolean).join(" ");
  const addressLine2 = [subpremise, sublocality].filter(Boolean).join(", ");

  return {
    addressLine1: addressLine1.trim() || (place.formatted_address ?? ""),
    addressLine2: addressLine2.trim(),
    city: pick(comps, "postal_town", "locality"),
    postcode: pick(comps, "postal_code"),
  };
}

/**
 * "Address line 1" input backed by Google Places Autocomplete (UK only).
 * Falls back to a plain text field if the API key is not configured.
 */
export default function AddressAutocomplete({
  id,
  label,
  value,
  onChange,
  onPlace,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onPlace: (parts: PlaceParts) => void;
  placeholder?: string;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    loadPlaces()
      .then(() => {
        if (cancelled || !inputRef.current) return;
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ["address_components", "formatted_address"],
          types: ["address"],
          componentRestrictions: { country: "gb" },
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.address_components) return;
          const parts = toParts(place);
          onPlace(parts);
          onChange(parts.addressLine1);
        });
        setStatus("ready");
      })
      .catch(() => {
        setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <label htmlFor={id} className="je-label">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        className={error ? "je-error" : "je-input"}
        value={value}
        placeholder={placeholder ?? "Start typing your address\u2026"}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="address-line1"
      />
      {error && (
        <p className="mt-1 text-xs font-medium text-red" role="alert">
          {error}
        </p>
      )}
      {status === "ready" && (
        <p className="mt-1 text-xs text-grey-midDark">
          Type and pick your address from the suggestions.
        </p>
      )}
      {status === "failed" && (
        <p className="mt-1 text-xs text-grey-midDark">
          Address lookup is unavailable right now — please type your address.
        </p>
      )}
    </div>
  );
}