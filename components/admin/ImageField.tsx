"use client";

import { useRef, useState } from "react";

/** Image field for the admin editors: paste a URL or upload a file. Uploads go
 * to /api/admin/upload (Supabase Storage) and the returned public URL is
 * written straight into the value, so both paths feed the same field. */
export default function ImageField({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (url: string) => void;
  className?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (f: File | null) => {
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      setErr("Please choose an image file.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setErr("Image must be 5 MB or smaller.");
      return;
    }
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed.");
      onChange(json.url);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        {value ? (
          <img
            src={value}
            alt=""
            className="h-16 w-16 shrink-0 rounded-card border border-grey-light object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card border border-dashed border-grey-light px-1 text-center text-[10px] font-medium text-grey-midDark">
            No image
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://... or upload below"
            className="je-input"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                void onFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="je-btn-secondary !py-1.5 text-sm"
            >
              {uploading ? "Uploading\u2026" : "Upload image"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-xs font-semibold text-grey-dark hover:text-red"
              >
                Remove
              </button>
            )}
          </div>
          {err && <p className="text-xs font-semibold text-red">{err}</p>}
        </div>
      </div>
    </div>
  );
}