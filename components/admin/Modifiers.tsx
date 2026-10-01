"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/components/admin/api";
import { Saving, Toggle } from "@/components/admin/ui";
import { money } from "@/lib/money";

export type AdminModifierOption = {
  id: string;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
  sortOrder: number;
};

export type AdminModifierGroup = {
  id: string;
  name: string;
  description: string | null;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  /** How many dish sizes in total offer this group — usually more than one. */
  variationCount: number;
  options: AdminModifierOption[];
};

/** Describes the picker the customer will see, so the limits are edited in the
 *  same terms the storefront uses rather than as bare numbers. */
function limitsHint(min: number, max: number): string {
  if (max <= 1) return min >= 1 ? "Required \u2014 customer picks one" : "Optional \u2014 at most one";
  if (min === max) return `Required \u2014 exactly ${max}`;
  return min === 0 ? `Optional \u2014 up to ${max}` : `At least ${min}, up to ${max}`;
}

export function ModifierEditor({
  variationId,
  groups,
  onChanged,
  setError,
}: {
  variationId: string;
  groups: AdminModifierGroup[];
  onChanged: () => void;
  setError: (m: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMin, setNewMin] = useState(0);
  const [newMax, setNewMax] = useState(1);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch("/api/admin/modifiers", {
        method: "POST",
        body: JSON.stringify({
          variationId,
          name: newName.trim(),
          minSelect: newMin,
          maxSelect: newMax,
        }),
      });
      setNewName("");
      setNewMin(0);
      setNewMax(1);
      setAdding(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-card border border-grey-light bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-grey-midDark">
          Customisations
        </p>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="je-btn-secondary !px-2.5 !py-1 text-xs">
            + Add picker
          </button>
        )}
      </div>

      {groups.length === 0 && !adding && (
        <p className="mt-1 text-xs text-grey-midDark">None \u2014 customers get this dish exactly as priced.</p>
      )}

      <ul className="mt-2 space-y-2">
        {groups.map((g) => (
          <GroupRow
            key={g.id}
            variationId={variationId}
            group={g}
            onChanged={onChanged}
            setError={setError}
          />
        ))}
      </ul>

      {adding && (
        <div className="mt-2 rounded-card border border-grey-light bg-grey-offWhite p-3">
          <p className="mb-2 text-xs font-bold text-grey-darkest">New picker for this dish</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Picker name, e.g. Choose Your Sauce"
              className="je-input w-72 !py-1.5 text-sm"
            />
            <label className="flex items-center gap-1 text-xs text-grey-dark">
              Min
              <input
                type="number"
                min={0}
                max={99}
                value={newMin}
                onChange={(e) => setNewMin(Math.max(0, Number(e.target.value) || 0))}
                className="je-input w-16 !py-1.5 text-sm"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-grey-dark">
              Max
              <input
                type="number"
                min={1}
                max={99}
                value={newMax}
                onChange={(e) => setNewMax(Math.max(1, Number(e.target.value) || 1))}
                className="je-input w-16 !py-1.5 text-sm"
              />
            </label>
            <button type="button" onClick={create} disabled={busy} className="je-btn-primary !py-1.5 text-xs">
              Create
            </button>
            <button type="button" onClick={() => setAdding(false)} className="je-btn-quiet !py-1.5 text-xs">
              Cancel
            </button>
            <Saving saving={busy} />
          </div>
          <p className="mt-2 text-xs text-grey-midDark">{limitsHint(newMin, newMax)}</p>
        </div>
      )}
    </div>
  );
}

function GroupRow({
  variationId,
  group,
  onChanged,
  setError,
}: {
  variationId: string;
  group: AdminModifierGroup;
  onChanged: () => void;
  setError: (m: string | null) => void;
}) {
  const [draft, setDraft] = useState(group);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(group);
    setDirty(false);
  }, [group]);

  const patch = (p: Partial<AdminModifierGroup>) => {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  };

  const patchOption = (id: string, p: Partial<AdminModifierOption>) => {
    setDraft((d) => ({ ...d, options: d.options.map((o) => (o.id === id ? { ...o, ...p } : o)) }));
    setDirty(true);
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setError("A picker needs a name.");
      return;
    }
    if (draft.options.some((o) => !o.name.trim())) {
      setError("Every option needs a name. Remove any blank ones.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminFetch("/api/admin/modifiers", {
        method: "PATCH",
        body: JSON.stringify({
          groupId: draft.id,
          name: draft.name.trim(),
          minSelect: draft.minSelect,
          maxSelect: draft.maxSelect,
          options: draft.options,
          removeMissingOptions: true,
        }),
      });
      setDirty(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const detach = async () => {
    if (
      !window.confirm(
        `Stop offering "${group.name}" on this dish?\n\nAny other dish using the same picker keeps it.`
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminFetch("/api/admin/modifiers", {
        method: "PATCH",
        body: JSON.stringify({ groupId: group.id, detachedVariationIds: [variationId] }),
      });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-card border border-grey-light bg-grey-offWhite p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          className="je-input w-64 !py-1.5 text-sm"
        />
        <label className="flex items-center gap-1 text-xs text-grey-dark">
          Min
          <input
            type="number"
            min={0}
            max={99}
            value={draft.minSelect}
            onChange={(e) => patch({ minSelect: Math.max(0, Number(e.target.value) || 0) })}
            className="je-input w-16 !py-1.5 text-sm"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-grey-dark">
          Max
          <input
            type="number"
            min={1}
            max={99}
            value={draft.maxSelect}
            onChange={(e) => patch({ maxSelect: Math.max(1, Number(e.target.value) || 1) })}
            className="je-input w-16 !py-1.5 text-sm"
          />
        </label>
        <span className="text-xs text-grey-midDark">{limitsHint(draft.minSelect, draft.maxSelect)}</span>
        <button type="button" onClick={save} disabled={!dirty || saving} className="je-btn-primary !py-1.5 text-xs">
          Save
        </button>
        <button type="button" onClick={detach} disabled={saving} className="text-xs font-bold text-red hover:underline">
          Remove from this dish
        </button>
        <Saving saving={saving} />
      </div>

      {/* A group is one shared row, so editing it here reaches every other dish
          offering the same picker. That is the opposite of what "edit this
          dish" implies, so warn before the save rather than after. */}
      {group.variationCount > 1 && (
        <p className="mt-2 rounded-sm bg-jet-offWhite px-2 py-1 text-xs text-orange-darkest">
          Shared by {group.variationCount} dish sizes. A rename or price change saved here applies to all{" "}
          {group.variationCount} of them.
        </p>
      )}

      <ul className="mt-2 space-y-1.5 border-t border-grey-light pt-2">
        {draft.options.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-2">
            <input
              value={o.name}
              onChange={(e) => patchOption(o.id, { name: e.target.value })}
              className="je-input w-52 !py-1.5 text-sm"
            />
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-grey-midDark">
                {"\u00a3"}
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={o.priceDelta}
                onChange={(e) => patchOption(o.id, { priceDelta: Number(e.target.value) || 0 })}
                className="je-input w-24 !py-1.5 pl-7 text-sm"
              />
            </div>
            <span className="text-xs text-grey-midDark">
              {o.priceDelta === 0 ? "no extra cost" : `adds ${money(o.priceDelta)}`}
            </span>
            <Toggle
              checked={o.isAvailable}
              onChange={(next) => patchOption(o.id, { isAvailable: next })}
              label={o.isAvailable ? "On" : "Off"}
            />
            <button
              type="button"
              onClick={() => {
                setDraft((d) => ({ ...d, options: d.options.filter((x) => x.id !== o.id) }));
                setDirty(true);
              }}
              className="text-xs font-bold text-red hover:underline"
            >
              Remove
            </button>
          </li>
        ))}
        {draft.options.length === 0 && <li className="text-xs text-grey-midDark">No options yet.</li>}
      </ul>

      <button
        type="button"
        onClick={() => {
          setDraft((d) => ({
            ...d,
            options: [
              ...d.options,
              { id: `new-${Date.now()}`, name: "", priceDelta: 0, isAvailable: true, sortOrder: d.options.length },
            ],
          }));
          setDirty(true);
        }}
        className="je-btn-secondary mt-2 !py-1.5 text-xs"
      >
        + Add option
      </button>
    </li>
  );
}