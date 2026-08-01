-- Public campaign artwork is served through the Storage CDN. Uploads remain
-- closed by default and are authorized by short-lived signed URLs issued by
-- the authenticated editor API.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'session-images',
  'session-images',
  true,
  3145728,
  array['image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
