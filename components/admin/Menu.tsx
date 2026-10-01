"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/components/admin/api";
import { Card, ErrorNote, Field, PageTitle, Saving, Toggle } from "@/components/admin/ui";
import ImageField from "@/components/admin/ImageField";
import { ModifierEditor, type AdminModifierGroup } from "@/components/admin/Modifiers";
import { money } from "@/lib/money";

type Variation = {
  id: string;
  sourceId: string | null;
  name: string;
  displayName: string | null;
  price: number;
  calories: number | null;
  isAvailable: boolean;
  sortOrder: number;
  /** Absent on rows cached before modifiers existed, hence the fallback. */
  modifierGroups?: AdminModifierGroup[];
};

type Item = {
  id: string;
  sourceId: string | null;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  calories: number | null;
  basePrice: number;
  isVegetarian: boolean;
  isVegan: boolean;
  isHalal: boolean;
  isSpicy: boolean;
  isPopular: boolean;
  isAvailable: boolean;
  sortOrder: number;
  variations: Variation[];
};

type Category = {
  id: string;
  sourceId: string | null;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isFeatured: boolean;
  items: Item[];
};

type MenuPayload = { categories: Category[]; error?: string };

const FLAG_KEYS: Array<{ key: "isVegetarian" | "isVegan" | "isHalal" | "isSpicy"; label: string }> = [
  { key: "isVegetarian", label: "Veg" },
  { key: "isVegan", label: "Vegan" },
  { key: "isHalal", label: "Halal" },
  { key: "isSpicy", label: "Spicy" },
];

export function MenuEditor() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openCat, setOpenCat] = useState<Set<string>>(new Set());
  const [openItem, setOpenItem] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await adminFetch<MenuPayload>("/api/admin/menu");
      if (res.error) throw new Error(res.error);
      setCategories(res.categories ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSet = (set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    set((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const patchItem = useCallback(
    async (id: string, patch: Record<string, unknown>, label: string) => {
      setBusy(label);
      try {
        await adminFetch(`/api/admin/items/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
        await load();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const deleteItem = useCallback(
    async (id: string, name: string) => {
      if (!window.confirm(`Delete "${name}"? This also removes its sizes/portions.`)) return;
      setBusy(`del:${id}`);
      try {
        await adminFetch(`/api/admin/items/${id}`, { method: "DELETE" });
        await load();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const deleteVariation = useCallback(
    async (id: string) => {
      setBusy(`delv:${id}`);
      try {
        await adminFetch(`/api/admin/variations/${id}`, { method: "DELETE" });
        await load();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  if (error) {
    return (
      <Card className="p-6">
        <ErrorNote message={error} />
      </Card>
    );
  }

  if (!categories.length) {
    return (
      <Card className="p-6">
        <p className="text-sm text-grey-dark">Loading menu&hellip;</p>
      </Card>
    );
  }

  return (
    <>
      <PageTitle sub={`Prices, availability and the \u201cHave you seen\u2026\u201d popular strip.`}>
        Menu editor
      </PageTitle>

      <div className="space-y-4">
        {categories.map((cat) => {
          const catOpen = openCat.has(cat.id);
          const items = categories.find((c) => c.id === cat.id)?.items ?? [];
          return (
            <Card key={cat.id}>
              <CategoryHeader
                cat={cat}
                open={catOpen}
                onToggle={() => toggleSet(setOpenCat, cat.id)}
                busy={busy}
                setError={setError}
                onChanged={load}
              />
              {catOpen && <CategoryBody catId={cat.id} categories={categories} items={items} onChanged={load} busy={busy} patchItem={patchItem} deleteItem={deleteItem} deleteVariation={deleteVariation} setBusy={setBusy} setError={setError} />}
            </Card>
          );
        })}
      </div>
    </>
  );
}

function CategoryHeader({
  cat,
  open,
  onToggle,
  busy,
  setError,
  onChanged,
}: {
  cat: Category;
  open: boolean;
  onToggle: () => void;
  busy: string | null;
  setError: (m: string | null) => void;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(cat.name);

  const saveName = async () => {
    const next = name.trim();
    if (!next || next === cat.name) return setRenaming(false);
    setSaving(true);
    try {
      await adminFetch("/api/admin/categories", {
        method: "PATCH",
        body: JSON.stringify({ id: cat.id, name: next }),
      });
      setRenaming(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCat = async () => {
    if (!window.confirm(`Delete category "${cat.name}" and all ${cat.items.length} items in it?`)) return;
    setSaving(true);
    try {
      await adminFetch("/api/admin/categories", { method: "DELETE", body: JSON.stringify({ id: cat.id }) });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-grey-light px-4 py-3 sm:px-5">
      {renaming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveName();
          }}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="je-input !py-1.5" />
          <button type="submit" className="je-btn-primary !py-1.5 text-xs" disabled={saving}>
            Save
          </button>
          <button type="button" onClick={() => { setRenaming(false); setName(cat.name); }} className="je-btn-quiet !py-1.5 text-xs">
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className={`text-xs text-grey-midDark transition-transform ${open ? "rotate-90" : ""}`}>{"\u203a"}</span>
          <span className="truncate text-base font-extrabold text-grey-darkest">{cat.name}</span>
          <span className="rounded-full bg-grey-lighter px-2 py-0.5 text-[11px] font-bold text-grey-dark">
            {cat.items.length} {cat.items.length === 1 ? "item" : "items"}
          </span>
        </button>
      )}

      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setRenaming(true)} className="je-btn-quiet !px-2.5 !py-1 text-xs">
          Rename
        </button>
        <button type="button" onClick={deleteCat} disabled={busy !== null} className="je-btn-secondary !px-2.5 !py-1 text-xs !text-red">
          Delete
        </button>
      </div>
    </div>
  );
}

function CategoryBody({
  catId,
  categories,
  items,
  onChanged,
  busy,
  patchItem,
  deleteItem,
  deleteVariation,
  setBusy,
  setError,
}: {
  catId: string;
  categories: Category[];
  items: Item[];
  onChanged: () => void;
  busy: string | null;
  patchItem: (id: string, patch: Record<string, unknown>, label: string) => Promise<void>;
  deleteItem: (id: string, name: string) => Promise<void>;
  deleteVariation: (id: string) => Promise<void>;
  setBusy: (k: string | null) => void;
  setError: (m: string | null) => void;
}) {
  return (
    <div className="divide-y divide-grey-light">
      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          categories={categories}
          busy={busy}
          patchItem={patchItem}
          deleteItem={deleteItem}
          deleteVariation={deleteVariation}
          onChanged={onChanged}
          setBusy={setBusy}
          setError={setError}
        />
      ))}
      <AddItemForm categoryId={catId} onChanged={onChanged} setError={setError} />
    </div>
  );
}

function ItemRow({
  item,
  categories,
  busy,
  patchItem,
  deleteItem,
  deleteVariation,
  onChanged,
  setBusy,
  setError,
}: {
  item: Item;
  categories: Category[];
  busy: string | null;
  patchItem: (id: string, patch: Record<string, unknown>, label: string) => Promise<void>;
  deleteItem: (id: string, name: string) => Promise<void>;
  deleteVariation: (id: string) => Promise<void>;
  onChanged: () => void;
  setBusy: (k: string | null) => void;
  setError: (m: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState({
    name: item.name,
    description: item.description ?? "",
    basePrice: item.basePrice,
    calories: item.calories ?? "",
    imageUrl: item.imageUrl ?? "",
    isVegetarian: item.isVegetarian,
    isVegan: item.isVegan,
    isHalal: item.isHalal,
    isSpicy: item.isSpicy,
  });
  const [variations, setVariations] = useState<Variation[]>(item.variations ?? []);
  const [newVar, setNewVar] = useState({ name: "", price: "" });
  const [saveBusy, setSaveBusy] = useState(false);
  // Modifier pickers save through their own endpoint, so which one is open is
  // tracked per variation rather than folded into this row's draft.
  const [openMods, setOpenMods] = useState<string | null>(null);

  // Sync local draft when the row re-renders after a save elsewhere.
  useEffect(() => {
    setEdit({
      name: item.name,
      description: item.description ?? "",
      basePrice: item.basePrice,
      calories: item.calories ?? "",
      imageUrl: item.imageUrl ?? "",
      isVegetarian: item.isVegetarian,
      isVegan: item.isVegan,
      isHalal: item.isHalal,
      isSpicy: item.isSpicy,
    });
    setVariations(item.variations ?? []);
  }, [item]);

  const save = async () => {
    if (!edit.name.trim()) return;
    setSaveBusy(true);
    setError(null);
    try {
      await patchItem(
        item.id,
        {
          name: edit.name.trim(),
          description: edit.description,
          basePrice: Number(edit.basePrice) || 0,
          calories: edit.calories === "" ? null : Number(edit.calories),
          imageUrl: edit.imageUrl,
          isVegetarian: edit.isVegetarian,
          isVegan: edit.isVegan,
          isHalal: edit.isHalal,
          isSpicy: edit.isSpicy,
          variations,
        },
        `save:${item.id}`
      );
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaveBusy(false);
    }
  };

  const price = (i: Item) => {
    if (!i.variations.length) return money(i.basePrice);
    const lo = Math.min(...i.variations.map((v) => v.price));
    const hi = Math.max(...i.variations.map((v) => v.price));
    return lo === hi ? money(lo) : `${money(lo)} \u2013 ${money(hi)}`;
  };

  const toggleFast = (key: "isPopular" | "isAvailable") =>
    patchItem(item.id, { [key]: !item[key] }, `toggle:${item.id}`);

  return (
    <div className="px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex flex-wrap items-center gap-2 text-left"
          >
            <span
              className={`rounded-full text-[10px] font-bold uppercase ${item.isAvailable ? "bg-green-offWhite text-green" : "bg-red-offWhite text-red"}`}
            >
              {"\u25cf"}
            </span>
            <span className={`text-sm font-bold ${item.isAvailable ? "text-grey-darkest" : "text-grey-midDark line-through"}`}>
              {item.name}
            </span>
            <span className="rounded-full bg-grey-lighter px-2 py-0.5 text-[10px] font-bold uppercase text-grey-midDark">
              {item.variations.length} sizes
            </span>
            {item.variations.some((v) => (v.modifierGroups ?? []).length > 0) && (
              <span className="rounded-full bg-grey-lighter px-2 py-0.5 text-[10px] font-bold uppercase text-grey-midDark">
                {new Set(item.variations.flatMap((v) => (v.modifierGroups ?? []).map((g) => g.id))).size} customisations
              </span>
            )}
            {item.isPopular && (
              <span className="rounded-full bg-jet-offWhite px-2 py-0.5 text-[10px] font-bold uppercase text-orange-darkest">
                Popular
              </span>
            )}
          </button>
          {item.description && <p className="mt-0.5 truncate text-xs text-grey-dark">{item.description}</p>}
        </div>
        <span className="text-sm font-extrabold tabular-nums text-grey-darkest">{price(item)}</span>
        <div className="flex items-center gap-1">
          <Toggle checked={item.isPopular} onChange={() => toggleFast("isPopular")} label="Popular" />
          <span className="mx-1 h-4 w-px bg-grey-light" />
          <Toggle checked={item.isAvailable} onChange={() => toggleFast("isAvailable")} label="On sale" />
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="je-btn-quiet !px-2.5 !py-1 text-xs">
          {open ? "Close" : "Edit"}
        </button>
      </div>

      {open && (
        <div className="mt-3 rounded-card border border-grey-light bg-grey-offWhite p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2">
              <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="je-input" />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <textarea
                value={edit.description}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                rows={2}
                className="je-input resize-y"
              />
            </Field>
            <Field label="Base price (\u00a3)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={edit.basePrice}
                onChange={(e) => setEdit({ ...edit, basePrice: Number(e.target.value) })}
                className="je-input"
              />
            </Field>
            <Field label="Calories (kcal)">
              <input
                type="number"
                min={0}
                value={edit.calories}
                onChange={(e) => setEdit({ ...edit, calories: e.target.value === "" ? "" : Number(e.target.value) })}
                className="je-input"
              />
            </Field>
            <div className="sm:col-span-2">
              <span className="je-label">Image</span>
              <ImageField value={edit.imageUrl} onChange={(url) => setEdit({ ...edit, imageUrl: url })} />
            </div>
            <Field label="Move to category">
              <select
                defaultValue={item.categoryId}
                onChange={async (e) => {
                  const target = e.target.value;
                  if (target && target !== item.categoryId) {
                    setBusy(`move:${item.id}`);
                    try {
                      await adminFetch(`/api/admin/items/${item.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ categoryId: target }),
                      });
                    } catch (err) {
                      setError((err as Error).message);
                    } finally {
                      setBusy(null);
                    }
                  }
                }}
                className="je-select"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {FLAG_KEYS.map((f) => (
              <Toggle
                key={f.key}
                checked={edit[f.key] as boolean}
                onChange={(v) => setEdit({ ...edit, [f.key]: v })}
                label={f.label}
              />
            ))}
          </div>

          <div className="mt-4 border-t border-grey-light pt-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-grey-midDark">Sizes / portions</p>
            <ul className="space-y-1.5">
              {variations.map((v) => (
                <li key={v.id} className="rounded-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={v.name}
                      onChange={(e) => setVariations(variations.map((x) => (x.id === v.id ? { ...x, name: e.target.value } : x)))}
                      className="je-input w-56 !py-1.5 text-sm"
                    />
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-grey-midDark">{"\u00a3"}</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={v.price}
                        onChange={(e) =>
                          setVariations(variations.map((x) => (x.id === v.id ? { ...x, price: Number(e.target.value) } : x)))
                        }
                        className="je-input w-28 !py-1.5 pl-7 text-sm"
                      />
                    </div>
                    <Toggle
                      checked={v.isAvailable}
                      onChange={(next) => setVariations(variations.map((x) => (x.id === v.id ? { ...x, isAvailable: next } : x)))}
                      label={v.isAvailable ? "On" : "Off"}
                    />
                    <button
                      type="button"
                      onClick={() => setOpenMods(openMods === v.id ? null : v.id)}
                      className="je-btn-quiet !px-2.5 !py-1 text-xs"
                    >
                      Customisations ({(v.modifierGroups ?? []).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Remove variation "${v.name}"? This also removes its customisations.`)) return;
                        setVariations(variations.filter((x) => x.id !== v.id));
                        deleteVariation(v.id);
                      }}
                      className="text-xs font-bold text-red hover:underline"
                    >
                      Remove
                    </button>
                  </div>

                  {openMods === v.id && !v.id.startsWith("new-") && (
                    <ModifierEditor
                      variationId={v.id}
                      groups={v.modifierGroups ?? []}
                      onChanged={onChanged}
                      setError={setError}
                    />
                  )}
                  {openMods === v.id && v.id.startsWith("new-") && (
                    <p className="mt-2 text-xs text-grey-midDark">
                      Save the dish first, then reopen to add customisations to this new size.
                    </p>
                  )}
                </li>
              ))}
              {variations.length === 0 && (
                <li className="text-xs text-grey-midDark">No sizes {"\u2014"} customers pay the base price.</li>
              )}
            </ul>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 border-t border-grey-light pt-3">
            <div className="flex flex-wrap gap-2">
              <input
                value={newVar.name}
                onChange={(e) => setNewVar({ ...newVar, name: e.target.value })}
                placeholder="New size name"
                className="je-input w-52 !py-1.5 text-sm"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={newVar.price}
                onChange={(e) => setNewVar({ ...newVar, price: e.target.value })}
                placeholder="Price"
                className="je-input w-28 !py-1.5 text-sm"
              />
              <button
                type="button"
                className="je-btn-secondary !py-1.5 text-xs"
                onClick={() => {
                  if (!newVar.name.trim()) return;
                  setVariations([...variations, { id: `new-${Date.now()}`, sourceId: null, displayName: null, name: newVar.name.trim(), price: Number(newVar.price) || 0, calories: null, isAvailable: true, sortOrder: variations.length }]);
                  setNewVar({ name: "", price: "" });
                }}
              >
                Add size
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs font-bold text-red hover:underline"
                onClick={() => deleteItem(item.id, item.name)}
              >
                Delete item
              </button>
              <button type="button" onClick={save} disabled={saveBusy} className="je-btn-primary !py-1.5 text-xs">
                Save changes
              </button>
              <Saving saving={saveBusy} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddItemForm({
  categoryId,
  onChanged,
  setError,
}: {
  categoryId: string;
  onChanged: () => void;
  setError: (m: string | null) => void;
}) {
  const [form, setForm] = useState({ name: "", price: "" });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await adminFetch("/api/admin/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          name: form.name.trim(),
          basePrice: Number(form.price) || 0,
          isAvailable: true,
        }),
      });
      setForm({ name: "", price: "" });
      setOpen(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-3 sm:px-5">
      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Dish name"
            className="je-input w-64 !py-1.5 text-sm"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="Price"
            className="je-input w-28 !py-1.5 text-sm"
          />
          <button type="submit" className="je-btn-primary !py-1.5 text-xs" disabled={saving}>
            Add dish
          </button>
          <button type="button" onClick={() => setOpen(false)} className="je-btn-quiet !py-1.5 text-xs">
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="je-btn-secondary !py-1.5 text-xs">
          + Add dish
        </button>
      )}
    </div>
  );
}