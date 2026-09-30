-- =============================================================================
--  Supabase Storage for dish and restaurant images
-- =============================================================================
--  Dish photography is Just Eat's own generic product set, mirrored from their
--  public Cloudinary folder into our bucket so the site does not hotlink a
--  third-party CDN. scripts/upload-images.mjs creates the bucket itself, so
--  running this file is optional — it exists for a SQL-only workflow and to
--  document the intended access rules.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,                                  -- public read: dish photos are served straight to the browser
  5242880,                               -- 5 MB ceiling
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read for anyone, including signed-out visitors. Writes are intentionally
-- not granted to anon/authenticated: images are only ever written by the
-- service role via scripts/upload-images.mjs, so nobody can upload through the
-- public API.
drop policy if exists "menu images are publicly readable" on storage.objects;
create policy "menu images are publicly readable"
  on storage.objects
  for select
  using (bucket_id = 'menu-images');
