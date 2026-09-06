-- Make complete transcript reading an explicit, independently revocable site capability.

insert into public.permission_catalog (action, plane, description)
values ('campaign.transcript.read', 'narrative', 'Read complete session transcripts.')
on conflict (action) do update
set plane = excluded.plane,
    description = excluded.description;

insert into public.role_definitions (slug, name, plane, description, is_system)
values (
  'transcript_viewer',
  'Transcript Viewer',
  'narrative',
  'Can read complete session transcripts without editing them.',
  true
)
on conflict (slug) do update
set name = excluded.name,
    plane = excluded.plane,
    description = excluded.description,
    is_system = excluded.is_system,
    updated_at = now();

insert into public.role_permissions (role_id, permission_action)
select rd.id, 'campaign.transcript.read'
from public.role_definitions rd
where rd.slug = 'transcript_viewer'
on conflict (role_id, permission_action) do nothing;

-- Preserve the access campaign members had before transcript visibility became
-- an explicit permission. The Edit panel can revoke it independently afterwards.
insert into public.role_assignments (
  profile_id, role_id, scope_type, scope_id, status, starts_at, assigned_by, reason, metadata
)
select
  cm.profile_id,
  rd.id,
  'campaign',
  c.slug,
  'active',
  now(),
  null,
  'Backfill de acesso existente às transcrições.',
  jsonb_build_object('source', 'migration', 'permission', 'campaign.transcript.read')
from public.campaign_members cm
join public.campaigns c on c.id = cm.campaign_id
join public.role_definitions rd on rd.slug = 'transcript_viewer'
where c.slug = 'yuhara-main'
on conflict (profile_id, role_id, scope_type, scope_id)
where status in ('active', 'eligible') and ends_at is null
do update set
  status = 'active',
  ends_at = null,
  reason = excluded.reason,
  metadata = coalesce(public.role_assignments.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();
