"use client";

import { useCallback, useEffect, useState } from "react";
import { IconTrash } from "@/components/Icons";
import type { Address } from "@/lib/types";

const EMPTY = {
  label: "Home",
  firstName: "",
  lastName: "",
  addressLine1: "",
  addressLine2: "",
  city: "Oxford",
  postcode: "",
  phone: "",
  deliveryNotes: "",
};

export default function AddressesClient({ initial }: { initial: Address[] }) {
  const [addresses, setAddresses] = useState<Address[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setAddresses(initial), [initial]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/addresses");
    if (res.ok) {
      const data = await res.json();
      setAddresses(data.addresses ?? []);
    }
  }, []);

  const startAdd = () => {
    setEditingId("new");
    setForm(EMPTY);
    setErrors({});
    setError(null);
  };

  const startEdit = (a: Address) => {
    setEditingId(a.id);
    setForm({
      label: a.label,
      firstName: a.firstName,
      lastName: a.lastName,
      addressLine1: a.addressLine1,
      addressLine2: a.addressLine2 ?? "",
      city: a.city,
      postcode: a.postcode,
      phone: a.phone ?? "",
      deliveryNotes: a.deliveryNotes ?? "",
    });
    setErrors({});
    setError(null);
  };

  const set = (k: keyof typeof EMPTY) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "Required.";
    if (!form.lastName.trim()) errs.lastName = "Required.";
    if (!form.addressLine1.trim()) errs.addressLine1 = "Required.";
    if (!form.city.trim()) errs.city = "Required.";
    if (!/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(form.postcode.trim())) {
      errs.postcode = "Enter a valid UK postcode.";
    }
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setBusy(true);
    const res = await fetch("/api/addresses", {
      method: editingId === "new" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, ...(editingId !== "new" ? { id: editingId } : {}) }),
    });
    setBusy(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "We couldn't save that address.");
      return;
    }
    await refresh();
    setEditingId(null);
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("Delete this address?")) return;
    const res = await fetch(`/api/addresses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) await refresh();
  };

  const onMakeDefault = async (id: string) => {
    const res = await fetch("/api/addresses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isDefault: true }),
    });
    if (res.ok) await refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-grey-darkest">Delivery addresses</h2>
        {!editingId && (
          <button type="button" onClick={startAdd} className="je-btn-primary">
            Add address
          </button>
        )}
      </div>

      {error && <div className="je-alert-error mt-4">{error}</div>}

      {editingId && (
        <form onSubmit={onSave} noValidate className="je-card mt-4 p-5">
          <h3 className="text-base font-bold text-grey-darkest">
            {editingId === "new" ? "New address" : "Edit address"}
          </h3>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField id="label" label="Label" value={form.label} onChange={set("label")} />
            <TextField id="firstName" label="First name" value={form.firstName} onChange={set("firstName")} error={errors.firstName} />
            <TextField id="lastName" label="Last name" value={form.lastName} onChange={set("lastName")} error={errors.lastName} />
            <TextField id="postcode" label="Postcode" value={form.postcode} onChange={set("postcode")} error={errors.postcode} />
          </div>

          <div className="mt-4">
            <TextField id="addressLine1" label="Address line 1" value={form.addressLine1} onChange={set("addressLine1")} error={errors.addressLine1} />
          </div>
          <div className="mt-4">
            <TextField id="addressLine2" label="Address line 2 (optional)" value={form.addressLine2} onChange={set("addressLine2")} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField id="city" label="Town or city" value={form.city} onChange={set("city")} error={errors.city} />
            <TextField id="phone" label="Phone (optional)" value={form.phone} onChange={set("phone")} />
          </div>
          <div className="mt-4">
            <label htmlFor="deliveryNotes" className="je-label">
              Delivery notes
            </label>
            <textarea
              id="deliveryNotes"
              rows={2}
              className="je-input resize-y"
              value={form.deliveryNotes}
              onChange={(e) => set("deliveryNotes")(e.target.value)}
            />
          </div>

          <div className="mt-5 flex gap-2">
            <button type="submit" disabled={busy} className="je-btn-primary">
              {busy ? "Saving…" : "Save address"}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="je-btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {addresses.length === 0 && !editingId ? (
        <div className="je-card mt-4 p-10 text-center">
          <p className="text-base font-semibold text-grey-darkest">No saved addresses</p>
          <p className="mt-1.5 text-sm text-grey-dark">
            Save an address to check out in a couple of taps.
          </p>
          <button type="button" onClick={startAdd} className="je-btn-primary je-btn-lg mt-6">
            Add your first address
          </button>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="je-card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-grey-darkest">
                  {a.label}
                  {a.isDefault && (
                    <span className="ml-2 rounded-full bg-green-offWhite px-1.5 py-0.5 text-[10px] font-bold uppercase text-green">
                      Default
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => onDelete(a.id)}
                  className="text-grey-midDark hover:text-red"
                  aria-label={`Delete ${a.label} address`}
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
              <address className="mt-1.5 text-sm not-italic text-grey-dark">
                {a.firstName} {a.lastName}
                <br />
                {a.addressLine1}
                {a.addressLine2 ? (
                  <>
                    <br />
                    {a.addressLine2}
                  </>
                ) : null}
                <br />
                {a.city}, {a.postcode}
                {a.phone ? (
                  <>
                    <br />
                    {a.phone}
                  </>
                ) : null}
              </address>
              {a.deliveryNotes && (
                <p className="mt-1.5 text-xs text-grey-midDark">{a.deliveryNotes}</p>
              )}
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => startEdit(a)}
                  className="text-sm font-semibold text-blue hover:underline"
                >
                  Edit
                </button>
                {!a.isDefault && (
                  <button
                    type="button"
                    onClick={() => onMakeDefault(a.id)}
                    className="text-sm font-semibold text-blue hover:underline"
                  >
                    Make default
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="je-label">
        {label}
      </label>
      <input
        id={id}
        className={error ? "je-error" : "je-input"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <p className="mt-1 text-xs font-medium text-red" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
