-- Keep local processing distributable without exposing the installer or
-- permission administration to every campaign editor/DM.

insert into public.permission_catalog (action, plane, description)
values
  ('campaign.companion.download', 'mixed', 'Download the official Windows local companion installer.'),
  ('campaign.local.publish', 'mixed', 'Publish a locally processed transcript to the campaign database.'),
  ('campaign.permissions.manage', 'technical', 'Manage DnD Scribe site feature permissions.')
on conflict (action) do update
set plane = excluded.plane,
    description = excluded.description;

insert into public.role_definitions (slug, name, plane, description, is_system)
values
  ('local_publisher', 'Local Publication Operator', 'mixed', 'Can publish results produced by a local companion.', true),
  ('site_permissions_owner', 'Site Permissions Owner', 'technical', 'Exclusive owner of DnD Scribe site feature access.', true)
on conflict (slug) do update
set name = excluded.name,
    plane = excluded.plane,
    description = excluded.description,
    is_system = excluded.is_system,
    updated_at = now();

insert into public.role_permissions (role_id, permission_action)
select rd.id, permission.action
from public.role_definitions rd
join (
  values
    ('local_operator', 'campaign.companion.download'),
    ('local_publisher', 'campaign.local.publish'),
    ('site_permissions_owner', 'campaign.permissions.manage')
) as permission(role_slug, action) on permission.role_slug = rd.slug
on conflict (role_id, permission_action) do nothing;

-- Only the primary owner can administer feature permissions. This role is not
-- assignable through the web UI; ownership transfer requires an audited
-- migration or direct administrative action.
insert into public.role_assignments (
  profile_id, role_id, scope_type, scope_id, status, starts_at, reason, metadata
)
select
  p.id,
  rd.id,
  'project',
  'dnd-scribe',
  'active',
  now(),
  'Exclusive DnD Scribe permission administration owner.',
  '{"source":"companion_distribution_permissions"}'::jsonb
from public.profiles p
cross join public.role_definitions rd
where lower(p.email) = 'faysk.nan@gmail.com'
  and rd.slug = 'site_permissions_owner'
on conflict (profile_id, role_id, scope_type, scope_id)
where status in ('active', 'eligible') and ends_at is null
do nothing;

-- Publication is deliberately narrower than local processing. Renan starts
-- as the only local publisher; other operators can process and review first.
insert into public.role_assignments (
  profile_id, role_id, scope_type, scope_id, status, starts_at, reason, metadata
)
select
  p.id,
  rd.id,
  'campaign',
  'yuhara-main',
  'active',
  now(),
  'Initial local publication owner.',
  '{"source":"companion_distribution_permissions"}'::jsonb
from public.profiles p
cross join public.role_definitions rd
where lower(p.email) = 'faysk.nan@gmail.com'
  and rd.slug = 'local_publisher'
on conflict (profile_id, role_id, scope_type, scope_id)
where status in ('active', 'eligible') and ends_at is null
do nothing;

-- Yuhara and Arthur are approved GPU/audio operators. Their local files stay
-- on their own PCs and no publication right is implied by these assignments.
insert into public.role_assignments (
  profile_id, role_id, scope_type, scope_id, status, starts_at, reason, metadata
)
select
  p.id,
  rd.id,
  'campaign',
  'yuhara-main',
  'active',
  now(),
  'Approved local GPU and audio operator.',
  '{"source":"companion_distribution_permissions"}'::jsonb
from public.profiles p
cross join public.role_definitions rd
where lower(p.email) in (
    'renan.takeshi@gmail.com',
    'arthur.rodrigues.camine@hotmail.com'
  )
  and rd.slug in ('local_operator', 'audio_operator')
on conflict (profile_id, role_id, scope_type, scope_id)
where status in ('active', 'eligible') and ends_at is null
do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'companion-releases',
  'companion-releases',
  false,
  10485760,
  array['application/vnd.microsoft.portable-executable']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types,
    updated_at = now();
