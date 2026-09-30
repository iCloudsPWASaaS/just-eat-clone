"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/components/admin/api";
import { Card, ErrorNote, Field, PageTitle, Saving, Toggle } from "@/components/admin/ui";
import ImageField from "@/components/admin/ImageField";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isFeatured: boolean;
  items: unknown[];
};

type MenuPayload = { categories: Category[]; error?: string };

export function Categories() {
  const [cats, setCats] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [add, setAdd] = useState({ name: "", description: "" });
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch<MenuPayload>("/api/admin/menu");
      if (res.error) throw new Error(res.error);
      setCats(res.categories ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setBusy(`c:${id}`);
      try {
        await adminFetch("/api/admin/categories", { method: "PATCH", body: JSON.stringify({ id, ...body }) });
        await load();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const remove = useCallback(
    async (c: Category) => {
      if (!window.confirm(`Delete "${c.name}" and its ${(c.items as unknown[]).length} items?`)) return;
      setBusy(`del:${c.id}`);
      try {
        await adminFetch("/api/admin/categories", { method: "DELETE", body: JSON.stringify({ id: c.id }) });
        await load();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const create = async () => {
    if (!add.name.trim()) return;
    setAdding(true);
    try {
      await adminFetch("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name: add.name.trim(), description: add.description }),
      });
      setAdd({ name: "", description: "" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <PageTitle sub="Ordering, featured status, names and images.">Categories</PageTitle>

      {error && <div className="je-alert-error mb-4">{error}</div>}

      <Card className="mb-4 p-5">
        <h2 className="mb-3 text-base font-extrabold text-grey-darkest">Add category</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <Field label="Name" className="w-64">
            <input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} className="je-input" placeholder="e.g. Kids Meals" />
          </Field>
          <Field label="Description" className="flex-1 min-w-48">
            <input value={add.description} onChange={(e) => setAdd({ ...add, description: e.target.value })} className="je-input" />
          </Field>
          <button type="submit" className="je-btn-primary" disabled={adding}>
            Add category
          </button>
        </form>
      </Card>

      <Card>
        {cats.length === 0 ? (
          <p className="p-6 text-sm text-grey-dark">No categories.</p>
        ) : (
          <ul className="divide-y divide-grey-light">
            {cats.map((c) => (
              <CategoryRow key={c.id} category={c} busy={busy} onPatch={patch} onDelete={remove} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function CategoryRow({
  category,
  busy,
  onPatch,
  onDelete,
}: {
  category: Category;
  busy: string | null;
  onPatch: (id: string, body: Record<string, unknown>) => Promise<void>;
  onDelete: (c: Category) => Promise<void>;
}) {
  const [name, setName] = useState(category.name);
  const [imageUrl, setImageUrl] = useState(category.imageUrl ?? "");
  const [sortOrder, setSortOrder] = useState(category.sortOrder);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(category.name);
    setImageUrl(category.imageUrl ?? "");
    setSortOrder(category.sortOrder);
  }, [category]);

  const save = async () => {
    setSaving(true);
    await onPatch(category.id, {
      name: name.trim() || undefined,
      imageUrl,
      sortOrder: Number(sortOrder) || 0,
    });
    setSaving(false);
  };

  return (
    <li className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="je-input !py-1.5 text-sm font-bold" />
          <span className="rounded-full bg-grey-lighter px-2 py-0.5 text-[11px] font-bold text-grey-dark">
            {(category.items as unknown[]).length} items
          </span>
        </div>
        <p className="mt-1 font-mono text-[11px] text-grey-midDark">/{category.slug}</p>
        <div className="mt-2">
          <span className="je-label">Image</span>
          <ImageField value={imageUrl} onChange={setImageUrl} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:justify-end">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-grey-dark">
          Order
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="je-input w-20 !py-1 text-sm"
          />
        </label>
        <Toggle
          checked={category.isFeatured}
          onChange={(v) => onPatch(category.id, { isFeatured: v })}
          label="Featured"
        />
        <button type="button" className="je-btn-secondary !px-2.5 !py-1 text-xs" onClick={save} disabled={saving || busy !== null}>
          Save
        </button>
        <Saving saving={saving} />
        <button
          type="button"
          className="text-xs font-bold text-red hover:underline"
          onClick={() => onDelete(category)}
          disabled={busy !== null}
        >
          Delete
        </button>
      </div>
    </li>
  );
}