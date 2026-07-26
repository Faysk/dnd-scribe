-- Current campaign members can collaborate on published text. Local machine
-- access remains exclusive to the operator profile and can later be changed
-- from the permissions workspace.

insert into public.role_assignments (
  profile_id,
  role_id,
  scope_type,
  scope_id,
  status,
  starts_at,
  reason,
  metadata
)
select
  cm.profile_id,
  rd.id,
  'campaign',
  c.slug,
  'active',
  now(),
  'Initial access for the unified Edit workspace.',
  '{"source":"site_feature_seed"}'::jsonb
from public.campaign_members cm
join public.campaigns c on c.id = cm.campaign_id
join public.role_definitions rd on rd.slug = 'site_editor'
where c.slug = 'yuhara-main'
on conflict (profile_id, role_id, scope_type, scope_id)
where status in ('active', 'eligible') and ends_at is null
do nothing;

insert into public.role_assignments (
  profile_id,
  role_id,
  scope_type,
  scope_id,
  status,
  starts_at,
  reason,
  metadata
)
select
  p.id,
  rd.id,
  'campaign',
  'yuhara-main',
  'active',
  now(),
  'Local-machine access for the primary operator.',
  '{"source":"site_feature_seed"}'::jsonb
from public.profiles p
cross join public.role_definitions rd
where lower(p.email) = 'faysk.nan@gmail.com'
  and rd.slug in ('local_operator', 'audio_operator')
on conflict (profile_id, role_id, scope_type, scope_id)
where status in ('active', 'eligible') and ends_at is null
do nothing;
