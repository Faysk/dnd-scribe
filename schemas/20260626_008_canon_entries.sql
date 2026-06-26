-- DnD Scribe - consolidated canon entries.

create table if not exists canon_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  entity_id uuid references entities(id) on delete set null,
  source_candidate_id uuid references canon_candidates(id) on delete set null,
  title text not null,
  content text not null,
  entry_type text not null default 'canon_candidate',
  visibility text not null default 'private_players' check (visibility in ('private_master','private_players','review_only','public_campaign','public_web')),
  status text not null default 'active' check (status in ('active','superseded','retcon_pending','archived')),
  source_run_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (campaign_id, source_candidate_id)
);

create index if not exists idx_canon_entries_campaign_status
  on canon_entries(campaign_id, status);

create index if not exists idx_canon_entries_entity
  on canon_entries(entity_id);
