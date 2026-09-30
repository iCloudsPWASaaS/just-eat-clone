import { randomUUID } from "node:crypto";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const BUCKET = "menu-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — matches the bucket ceiling
const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

/**
 * POST /api/admin/upload — store an image (multipart "file") in Supabase
 * Storage and return its public URL, ready to paste into an item or category.
 * Kept deliberately small: admin-only, 5 MB gutter, images only.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { admin } = auth;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError("No file provided.", 400);
  if (!file.type || !/^image\//.test(file.type)) return jsonError("Only image files are allowed.", 400);
  if (file.size > MAX_BYTES) return jsonError("Image must be 5 MB or smaller.", 413);
  const ext = EXT[file.type];
  if (!ext) return jsonError("Unsupported image type.", 415);

  // Self-heal: the bucket might not exist on a fresh project. Creating it is
  // a no-op (and ignored) once it's there.
  const { error: bucketErr } = await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(EXT),
  });
  if (bucketErr && !/already exists|duplicate/i.test(bucketErr.message)) {
    return jsonError(bucketErr.message, 500);
  }

  const stamp = new Date().toISOString().slice(0, 7); // e.g. 2026-09
  const path = `menu/uploads/${stamp}/${randomUUID()}${ext}`;
  const payload = await file.arrayBuffer();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, payload, { contentType: file.type, upsert: false });

  if (error) return jsonError(error.message, 500);

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return jsonOk({ url: data.publicUrl });
}