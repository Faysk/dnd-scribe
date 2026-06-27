-- RBAC foundation inspired by Azure-style role assignment:
-- principal(profile) + role definition + scope + assignment window.
--
-- This migration is intentionally additive. Existing campaign_members roles
-- continue to work while the app moves route-by-route to permission checks.

create extension if not exists "pgcrypto";

create table if not exists permission_catalog (
  action text primary key,
  plane text not null check (plane in ('technical', 'narrative', 'mixed')),
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists role_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  plane text not null check (plane in ('technical', 'narrative', 'mixed')),
  description text not null,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists role_permissions (
  role_id uuid not null references role_definitions(id) on delete cascade,
  permission_action text not null references permission_catalog(action) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_action)
);

create table if not exists role_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  role_id uuid not null references role_definitions(id) on delete cascade,
  scope_type text not null check (scope_type in ('project', 'campaign', 'session', 'resource', 'integration')),
  scope_id text not null,
  status text not null default 'active' check (status in ('active', 'eligible', 'ended', 'revoked')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  assigned_by uuid references profiles(id) on delete set null,
  revoked_by uuid references profiles(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists idx_role_assignments_profile_active
  on role_assignments(profile_id, status, scope_type, scope_id, starts_at, ends_at);

create index if not exists idx_role_assignments_scope_active
  on role_assignments(scope_type, scope_id, status, starts_at, ends_at);

create unique index if not exists idx_role_assignments_open_unique
  on role_assignments(profile_id, role_id, scope_type, scope_id)
  where status in ('active', 'eligible') and ends_at is null;

create table if not exists dm_tenures (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role_assignment_id uuid references role_assignments(id) on delete set null,
  tenure_type text not null default 'primary' check (tenure_type in ('primary', 'co_dm', 'session')),
  status text not null default 'active' check (status in ('active', 'ended', 'revoked')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  appointed_by uuid references profiles(id) on delete set null,
  ended_by uuid references profiles(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at)
);

create unique index if not exists idx_dm_tenures_one_primary_active
  on dm_tenures(campaign_id)
  where tenure_type = 'primary' and status = 'active' and ended_at is null;

alter table permission_catalog enable row level security;
alter table role_definitions enable row level security;
alter table role_permissions enable row level security;
alter table role_assignments enable row level security;
alter table dm_tenures enable row level security;

revoke all on table permission_catalog from public, anon, authenticated;
revoke all on table role_definitions from public, anon, authenticated;
revoke all on table role_permissions from public, anon, authenticated;
revoke all on table role_assignments from public, anon, authenticated;
revoke all on table dm_tenures from public, anon, authenticated;

grant select, insert, update, delete on table permission_catalog to service_role;
grant select, insert, update, delete on table role_definitions to service_role;
grant select, insert, update, delete on table role_permissions to service_role;
grant select, insert, update, delete on table role_assignments to service_role;
grant select, insert, update, delete on table dm_tenures to service_role;

insert into permission_catalog (action, plane, description)
values
  ('project.monitor.read', 'technical', 'Read production health, service readiness, token presence and redacted logs.'),
  ('project.logs.read_redacted', 'technical', 'Read technical logs with narrative/private content redacted.'),
  ('project.tokens.status.read', 'technical', 'Read secret presence and expiry metadata without secret values.'),
  ('project.costs.read', 'technical', 'Read infrastructure, storage and AI cost summaries.'),
  ('project.jobs.read', 'technical', 'Read production processing jobs and worker status.'),
  ('project.jobs.run', 'technical', 'Run non-narrative production workers and operational jobs.'),
  ('project.deployments.read', 'technical', 'Read Vercel deployment status and build/runtime health.'),
  ('project.rbac.manage', 'technical', 'Assign and revoke technical roles.'),
  ('campaign.access.manage', 'mixed', 'Approve profile links and manage campaign membership.'),
  ('campaign.read', 'narrative', 'Read approved campaign/session material according to visibility rules.'),
  ('campaign.upload.manage', 'mixed', 'Manage session uploads and Craig ingestion setup.'),
  ('narrative.review.read', 'narrative', 'Read review candidates for campaign content.'),
  ('narrative.review.manage', 'narrative', 'Review and classify campaign content.'),
  ('narrative.canon.approve', 'narrative', 'Final authority to approve or alter campaign canon.'),
  ('narrative.dm_notes.read', 'narrative', 'Read DM-only notes and backstage material.'),
  ('narrative.roll20.ingest', 'narrative', 'Import Roll20 events into campaign review flow.'),
  ('narrative.notes.review', 'narrative', 'Review table notes from Discord, Roll20 and site.')
on conflict (action) do update set
  plane = excluded.plane,
  description = excluded.description;

insert into role_definitions (slug, name, plane, description, is_system)
values
  ('platform_owner', 'Platform Owner', 'technical', 'Full technical administration of the DnD Scribe project without narrative authority by default.', true),
  ('platform_operator', 'Platform Operator', 'technical', 'Runs and observes production jobs without managing role assignments.', true),
  ('security_admin', 'Security Admin', 'technical', 'Manages account links and technical role assignments.', true),
  ('billing_observer', 'Billing Observer', 'technical', 'Reads cost, usage and storage metrics.', true),
  ('campaign_owner', 'Campaign Owner', 'mixed', 'Owns campaign administration and can transfer DM responsibility without being the DM.', true),
  ('campaign_dm', 'Campaign DM', 'narrative', 'Current DM authority for canon, DM notes and narrative review.', true),
  ('campaign_reviewer', 'Campaign Reviewer', 'narrative', 'Reviews table material without final canon authority.', true),
  ('player', 'Player', 'narrative', 'Reads approved table material and participates in review of their own material.', true),
  ('viewer', 'Viewer', 'narrative', 'Read-only approved material access.', true),
  ('former_dm_archive_reader', 'Former DM Archive Reader', 'narrative', 'Optional explicit access to historical DM material after a DM transition.', true)
on conflict (slug) do update set
  name = excluded.name,
  plane = excluded.plane,
  description = excluded.description,
  is_system = excluded.is_system,
  updated_at = now();

with role_map(slug, actions) as (
  values
    ('platform_owner', array[
      'project.monitor.read',
      'project.logs.read_redacted',
      'project.tokens.status.read',
      'project.costs.read',
      'project.jobs.read',
      'project.jobs.run',
      'project.deployments.read',
      'project.rbac.manage',
      'campaign.upload.manage'
    ]),
    ('platform_operator', array[
      'project.monitor.read',
      'project.logs.read_redacted',
      'project.costs.read',
      'project.jobs.read',
      'project.jobs.run',
      'project.deployments.read'
    ]),
    ('security_admin', array[
      'project.monitor.read',
      'project.tokens.status.read',
      'project.rbac.manage',
      'campaign.access.manage'
    ]),
    ('billing_observer', array[
      'project.monitor.read',
      'project.costs.read'
    ]),
    ('campaign_owner', array[
      'campaign.access.manage',
      'campaign.upload.manage'
    ]),
    ('campaign_dm', array[
      'campaign.read',
      'campaign.access.manage',
      'campaign.upload.manage',
      'narrative.review.read',
      'narrative.review.manage',
      'narrative.canon.approve',
      'narrative.dm_notes.read',
      'narrative.roll20.ingest',
      'narrative.notes.review'
    ]),
    ('campaign_reviewer', array[
      'campaign.read',
      'narrative.review.read',
      'narrative.review.manage',
      'narrative.notes.review'
    ]),
    ('player', array[
      'campaign.read'
    ]),
    ('viewer', array[
      'campaign.read'
    ]),
    ('former_dm_archive_reader', array[
      'narrative.dm_notes.read',
      'narrative.review.read'
    ])
)
insert into role_permissions (role_id, permission_action)
select rd.id, action
from role_map rm
join role_definitions rd on rd.slug = rm.slug
cross join unnest(rm.actions) as action
on conflict (role_id, permission_action) do nothing;

-- Project bootstrap: Faysk is the technical owner building/administering the
-- system. This does not grant DM/canon authority.
insert into role_assignments (
  profile_id, role_id, scope_type, scope_id, status, starts_at, reason, metadata
)
select p.id, rd.id, 'project', 'dnd-scribe', 'active', now(),
       'Initial technical project administrator.',
       jsonb_build_object('bootstrap', true, 'source', '20260627_017_rbac_foundation')
from profiles p
join role_definitions rd on rd.slug = 'platform_owner'
where lower(coalesce(p.roll20_name, '')) = 'faysk'
on conflict do nothing;

-- Compatibility bootstrap from the current campaign_members table.
insert into role_assignments (
  profile_id, role_id, scope_type, scope_id, status, starts_at, reason, metadata
)
select cm.profile_id,
       rd.id,
       'campaign',
       c.slug,
       'active',
       cm.created_at,
       'Bootstrap from campaign_members.role.',
       jsonb_build_object('bootstrap', true, 'legacyRole', cm.role, 'source', 'campaign_members')
from campaign_members cm
join campaigns c on c.id = cm.campaign_id
join role_definitions rd on rd.slug = case cm.role
  when 'owner' then 'campaign_owner'
  when 'master' then 'campaign_dm'
  when 'reviewer' then 'campaign_reviewer'
  when 'player' then 'player'
  when 'viewer' then 'viewer'
  else 'viewer'
end
on conflict do nothing;

insert into dm_tenures (
  campaign_id, profile_id, role_assignment_id, tenure_type, status, started_at, reason, metadata
)
select cm.campaign_id, cm.profile_id, ra.id, 'primary', 'active', cm.created_at,
       'Initial active DM tenure from campaign_members.role=master.',
       jsonb_build_object('bootstrap', true, 'legacyRole', cm.role)
from campaign_members cm
join campaigns c on c.id = cm.campaign_id
join role_definitions rd on rd.slug = 'campaign_dm'
join role_assignments ra
  on ra.profile_id = cm.profile_id
 and ra.role_id = rd.id
 and ra.scope_type = 'campaign'
 and ra.scope_id = c.slug
 and ra.status = 'active'
 and ra.ends_at is null
where cm.role = 'master'
on conflict do nothing;
