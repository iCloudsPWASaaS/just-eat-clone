/**
 * Uploads the product and category images parsed from the Just Eat menu page
 * into Supabase Storage, writing a manifest the importer consumes.
 *
 *   npm run upload:images
 *   npm run upload:images -- --force   # re-upload even if already present
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY. Safe to re-run: objects already recorded
 * in data/images.json are skipped unless --force is passed.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET = "menu-images";
const TIMEOUT_MS = 30000;

if (existsSync(join(ROOT, ".env")) && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  for (const line of readFileSync(join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([\w-]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trimStart().startsWith("#")) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Add SUPABASE_SERVICE_ROLE_KEY to .env (Dashboard -> Settings -> API Keys).");
  process.exit(1);
}

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const force = process.argv.includes("--force");
const manifestPath = join(ROOT, "data", "images.json");
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : { generatedAt: null, items: {}, categories: {}, restaurant: {}, objects: {} };
manifest.objects ??= {};

const jePath = join(ROOT, "data", "je-images.json");
if (!existsSync(jePath)) {
  console.error("data/je-images.json not found — run `npm run parse:je-images` first.");
  process.exit(1);
}
const je = JSON.parse(readFileSync(jePath, "utf8"));

// Drop manifest entries for items that no longer have a source image, so the
// importer writes a null image_url instead of a stale public URL.
for (const sourceId of Object.keys(manifest.items)) {
  if (!je.items[sourceId]) {
    delete manifest.items[sourceId];
    console.log(`pruned ${sourceId} from manifest`);
  }
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

async function ensureBucket() {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
  });
  if (error && !/already exists|exists/i.test(error.message)) {
    console.error(`createBucket: ${error.message}`);
    process.exit(1);
  }
  console.log(`bucket "${BUCKET}" ready`);
}

async function download(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") ?? "image/jpeg",
    };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Uploads and returns `{ publicUrl, sha }`.
 *
 * The object path carries a short hash of the bytes, so replacing an image
 * produces a new URL. Without this the path stays the same when the contents
 * change and every browser keeps serving its cached copy of the old file.
 */
async function store(pathBase, sourceUrl, ext = "jpg") {
  const payload = await download(sourceUrl);
  const sha = createHash("sha256").update(payload.buffer).digest("hex").slice(0, 8);
  const path = `${pathBase}-${sha}.${ext}`;

  if (!force && manifest.objects[path]) {
    return { publicUrl: manifest.objects[path], sha };
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, payload.buffer, { contentType: payload.contentType, upsert: true });
  if (error) throw new Error(error.message);

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  manifest.objects[path] = publicUrl;
  return { publicUrl, sha };
}

function save() {
  manifest.generatedAt = new Date().toISOString();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

async function run() {
  await ensureBucket();

  let failed = 0;

  // --- Product images ------------------------------------------------------
  const itemEntries = Object.entries(je.items);
  console.log(`\nuploading ${itemEntries.length} product images`);
  for (const [sourceId, meta] of itemEntries) {
    const base = `menu/${slug(meta.category)}/${slug(meta.name)}-${sourceId}`;
    try {
      const { publicUrl } = await store(base, meta.url);
      manifest.items[sourceId] = {
        path: base,
        publicUrl,
        kind: meta.kind,
        matchedBy: meta.matchedBy,
      };
    } catch (err) {
      failed++;
      console.warn(`  ! ${meta.name}: ${err.message}`);
    }
  }
  save();

  // --- Category images -----------------------------------------------------
  const catEntries = Object.entries(je.categories);
  console.log(`uploading ${catEntries.length} category images`);
  for (const [catSlug, meta] of catEntries) {
    const base = `categories/${slug(catSlug)}`;
    try {
      const { publicUrl } = await store(base, meta.url);
      manifest.categories[catSlug] = { path: base, publicUrl, kind: meta.kind };
    } catch (err) {
      failed++;
      console.warn(`  ! category ${meta.name}: ${err.message}`);
    }
  }
  save();

  // --- Restaurant artwork --------------------------------------------------
  // The menu page carries the restaurant logo; copy it into our own bucket so
  // the site stops hotlinking Just Eat's CDN.
  console.log("uploading restaurant logo");
  const restaurantSeed = JSON.parse(
    readFileSync(join(ROOT, "data", "restaurant.json"), "utf8")
  );
  const logo = restaurantSeed.restaurants[0].logoUrl;
  if (logo) {
    try {
      const { publicUrl } = await store("restaurant/logo", logo, "gif");
      manifest.restaurant.logo = { path: "restaurant/logo", publicUrl };
      console.log(`  ✓ ${publicUrl}`);
    } catch (err) {
      failed++;
      console.warn(`  ! logo: ${err.message}`);
    }
  }
  save();

  const kinds = Object.values(manifest.items).reduce(
    (a, i) => ((a[i.kind] = (a[i.kind] ?? 0) + 1), a),
    {}
  );
  console.log(`
✓ ${Object.keys(manifest.items).length} product images, ${Object.keys(manifest.categories).length} category images
  provenance: ${JSON.stringify(kinds)}
  manifest:   data/images.json${failed ? `\n  ${failed} upload(s) failed and were skipped` : ""}
`);
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
