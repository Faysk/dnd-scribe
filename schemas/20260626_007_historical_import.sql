-- DnD Scribe - conservative Markdown history import.

create table if not exists historical_documents (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  source_path text not null,
  title text not null,
  content text not null,
  content_hash text not null,
  status text not null default 'historical_import' check (status in ('historical_import','needs_review','reviewed','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (campaign_id, source_path)
);

create index if not exists idx_historical_documents_campaign_status
  on historical_documents(campaign_id, status);

create index if not exists idx_historical_documents_text
  on historical_documents using gin (to_tsvector('portuguese', content));
