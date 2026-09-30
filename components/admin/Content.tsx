"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/components/admin/api";
import { Card, ErrorNote, Field, PageTitle, Saving, Toggle } from "@/components/admin/ui";

type Tab = "deals" | "faqs" | "hours";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "deals", label: "Deals" },
  { key: "faqs", label: "FAQs" },
  { key: "hours", label: "Opening hours" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Deal = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  discountType: string;
  discountValue: number;
  minOrderValue: number;
  badge: string | null;
  isActive: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
};

type Faq = { id: string; question: string; answer: string; sortOrder: number };

type Hour = {
  id: string;
  dayOfWeek: number;
  label: string;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
};

export function Content() {
  const [tab, setTab] = useState<Tab>("deals");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [hours, setHours] = useState<Hour[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, f, h] = await Promise.all([
        adminFetch<{ deals: Deal[] }>("/api/admin/content?type=deals"),
        adminFetch<{ faqs: Faq[] }>("/api/admin/content?type=faqs"),
        adminFetch<{ opening_hours: Hour[] }>("/api/admin/content?type=hours"),
      ]);
      setDeals(d.deals ?? []);
      setFaqs(f.faqs ?? []);
      setHours(h.opening_hours ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = useCallback(
    async (type: Tab, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, busyKey: string) => {
      setSaving(busyKey);
      try {
        await adminFetch("/api/admin/content", { method, body: JSON.stringify({ type, ...body }) });
        await load();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(null);
      }
    },
    [load]
  );

  if (error) {
    return (
      <Card className="p-6">
        <ErrorNote message={error} />
        <button type="button" onClick={() => setError(null)} className="je-btn-quiet mt-3 text-xs">
          Dismiss
        </button>
      </Card>
    );
  }

  return (
    <>
      <PageTitle sub="Deals, FAQs and opening hours shown on the site.">Content</PageTitle>

      <div className="mb-4 flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-button px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.key ? "bg-orange text-white" : "bg-white text-grey-dark ring-1 ring-grey-light hover:bg-grey-lighter"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {tab === "deals" && deals.map((d) => <DealRow key={d.id} deal={d} saving={saving} send={send} />)}
        {tab === "deals" && (
          <AddCard kind="deals" saving={saving} onSubmit={(body) => send("deals", "POST", body, "add:deals")} />
        )}
        {tab === "faqs" && faqs.map((f) => <FaqRow key={f.id} faq={f} saving={saving} send={send} />)}
        {tab === "faqs" && (
          <AddCard kind="faqs" saving={saving} onSubmit={(body) => send("faqs", "POST", body, "add:faqs")} />
        )}
        {tab === "hours" && hours.map((h) => <HourRow key={h.id} hour={h} saving={saving} send={send} />)}
        {tab === "hours" && (
          <AddCard kind="hours" saving={saving} onSubmit={(body) => send("hours", "POST", body, "add:hours")} />
        )}
      </div>
    </>
  );
}

function DealRow({
  deal,
  saving,
  send,
}: {
  deal: Deal;
  saving: string | null;
  send: (type: Tab, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, busyKey: string) => Promise<void>;
}) {
  const [form, setForm] = useState({ ...deal, badge: deal.badge ?? "", subtitle: deal.subtitle ?? "", description: deal.description ?? "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({ ...deal, badge: deal.badge ?? "", subtitle: deal.subtitle ?? "", description: deal.description ?? "" });
  }, [deal]);

  const save = async () => {
    setBusy(true);
    await send(
      "deals",
      "PATCH",
      {
        id: deal.id,
        title: form.title,
        subtitle: form.subtitle,
        description: form.description,
        badge: form.badge,
        discountType: form.discountType,
        discountValue: form.discountValue,
        minOrderValue: form.minOrderValue,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
      },
      `save:${deal.id}`
    );
    setBusy(false);
  };

  return (
    <Card className="p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Title" className="sm:col-span-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="je-input" />
        </Field>
        <Field label="Badge (shown in the banner)">
          <input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} className="je-input" placeholder="e.g. Popular" />
        </Field>
        <Field label="Sort order">
          <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} className="je-input" />
        </Field>
        <Field label="Subtitle" className="sm:col-span-2">
          <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="je-input" />
        </Field>
        <Field label="Discount value">
          <input type="number" step="0.01" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} className="je-input" />
        </Field>
        <Field label="Min order (\u00a3)">
          <input type="number" step="0.01" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: Number(e.target.value) })} className="je-input" />
        </Field>
        <Field label="Discount type" className="sm:col-span-2">
          <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })} className="je-select">
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed amount</option>
            <option value="free_delivery">Free delivery</option>
            <option value="bogo">Buy one get one</option>
          </select>
        </Field>
        <Field label="Description" className="sm:col-span-4">
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="je-input resize-y" />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Active on site" />
        <span className="ms-auto flex items-center gap-2">
          <button
            type="button"
            className="text-xs font-bold text-red hover:underline"
            onClick={() => {
              if (window.confirm(`Delete deal "${deal.title}"?`)) send("deals", "DELETE", { id: deal.id }, `del:${deal.id}`);
            }}
          >
            Delete
          </button>
          <button type="button" className="je-btn-primary !py-1.5 text-xs" onClick={save} disabled={busy || saving !== null}>
            Save
          </button>
          <Saving saving={busy} />
        </span>
      </div>
    </Card>
  );
}

function FaqRow({
  faq,
  saving,
  send,
}: {
  faq: Faq;
  saving: string | null;
  send: (type: Tab, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, busyKey: string) => Promise<void>;
}) {
  const [q, setQ] = useState(faq.question);
  const [a, setA] = useState(faq.answer);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setQ(faq.question);
    setA(faq.answer);
  }, [faq]);

  const save = async () => {
    setBusy(true);
    await send("faqs", "PATCH", { id: faq.id, question: q, answer: a }, `save:${faq.id}`);
    setBusy(false);
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="je-input flex-1 !py-1.5 text-sm font-bold" />
        <input type="number" defaultValue={faq.sortOrder} onBlur={(e) => send("faqs", "PATCH", { id: faq.id, sortOrder: Number(e.target.value) || 0 }, `sort:${faq.id}`)} className="je-input w-24 !py-1.5 text-sm" title="Sort order" />
      </div>
      <textarea value={a} onChange={(e) => setA(e.target.value)} rows={2} className="je-input mt-2 resize-y" />
      <div className="mt-2 flex items-center gap-2">
        <span className="ms-auto flex items-center gap-2">
          <button
            type="button"
            className="text-xs font-bold text-red hover:underline"
            onClick={() => {
              if (window.confirm(`Delete FAQ "${faq.question}"?`)) send("faqs", "DELETE", { id: faq.id }, `del:${faq.id}`);
            }}
          >
            Delete
          </button>
          <button type="button" className="je-btn-primary !py-1.5 text-xs" onClick={save} disabled={busy || saving !== null}>
            Save
          </button>
          <Saving saving={busy} />
        </span>
      </div>
    </Card>
  );
}

function HourRow({
  hour,
  saving,
  send,
}: {
  hour: Hour;
  saving: string | null;
  send: (type: Tab, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, busyKey: string) => Promise<void>;
}) {
  const [closed, setClosed] = useState(hour.isClosed);
  const [open, setOpen] = useState(hour.openTime ?? "17:00");
  const [close, setClose] = useState(hour.closeTime ?? "23:00");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setClosed(hour.isClosed);
    setOpen(hour.openTime ?? "17:00");
    setClose(hour.closeTime ?? "23:00");
  }, [hour]);

  const save = async () => {
    setBusy(true);
    await send("hours", "PATCH", { id: hour.id, isClosed: closed, openTime: open, closeTime: close }, `save:${hour.id}`);
    setBusy(false);
  };

  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <span className="w-32 text-sm font-bold text-grey-darkest">{DAYS[hour.dayOfWeek]}</span>
      <span className="text-xs text-grey-midDark">{hour.label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <input type="time" value={open} disabled={closed} onChange={(e) => setOpen(e.target.value)} className="je-input w-36 !py-1.5 text-sm disabled:opacity-40" />
        <span className="text-grey-dark">to</span>
        <input type="time" value={close} disabled={closed} onChange={(e) => setClose(e.target.value)} className="je-input w-36 !py-1.5 text-sm disabled:opacity-40" />
      </div>
      <Toggle checked={closed} onChange={setClosed} label="Closed" />
      <span className="ms-auto flex items-center gap-2">
        <button
          type="button"
          className="text-xs font-bold text-red hover:underline"
          onClick={() => {
            if (window.confirm(`Remove ${DAYS[hour.dayOfWeek]} hours?`)) send("hours", "DELETE", { id: hour.id }, `del:${hour.id}`);
          }}
        >
          Delete
        </button>
        <button type="button" className="je-btn-primary !py-1.5 text-xs" onClick={save} disabled={busy || saving !== null}>
          Save
        </button>
        <Saving saving={busy} />
      </span>
    </Card>
  );
}

function AddCard({
  kind,
  saving,
  onSubmit,
}: {
  kind: Tab;
  saving: string | null;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    await onSubmit(form);
    setBusy(false);
    setOpen(false);
    setForm({});
  };

  return (
    <Card className="p-4">
      {open ? (
        <>
          {kind === "deals" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title">
                <input value={(form.title as string) ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} className="je-input" />
              </Field>
              <Field label="Badge">
                <input value={(form.badge as string) ?? ""} onChange={(e) => setForm({ ...form, badge: e.target.value })} className="je-input" />
              </Field>
              <Field label="Discount value">
                <input type="number" value={(form.discountValue as number) ?? 0} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} className="je-input" />
              </Field>
              <Field label="Min order (\u00a3)">
                <input type="number" value={(form.minOrderValue as number) ?? 0} onChange={(e) => setForm({ ...form, minOrderValue: Number(e.target.value) })} className="je-input" />
              </Field>
            </div>
          )}
          {kind === "faqs" && (
            <div className="grid gap-3">
              <Field label="Question">
                <input value={(form.question as string) ?? ""} onChange={(e) => setForm({ ...form, question: e.target.value })} className="je-input" />
              </Field>
              <Field label="Answer">
                <textarea value={(form.answer as string) ?? ""} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={2} className="je-input resize-y" />
              </Field>
            </div>
          )}
          {kind === "hours" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Day">
                <select value={(form.dayOfWeek as number) ?? 0} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })} className="je-select">
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Open">
                <input type="time" defaultValue="17:00" onChange={(e) => setForm({ ...form, openTime: e.target.value })} className="je-input" />
              </Field>
              <Field label="Close">
                <input type="time" defaultValue="23:00" onChange={(e) => setForm({ ...form, closeTime: e.target.value })} className="je-input" />
              </Field>
              <Field label="Status">
                <select value={form.isClosed === true ? "closed" : "open"} onChange={(e) => setForm({ ...form, isClosed: e.target.value === "closed" })} className="je-select">
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </Field>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" className="je-btn-primary text-xs" onClick={submit} disabled={busy || saving !== null}>
              Create
            </button>
            <button type="button" className="je-btn-quiet text-xs" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="je-btn-secondary !py-1.5 text-xs">
          + Add {kind === "deals" ? "deal" : kind === "faqs" ? "FAQ" : "hours"}
        </button>
      )}
    </Card>
  );
}