-- DnD Scribe - publication pipeline extensions.
-- Keeps generated publications idempotent and tied to a source run.

alter table publications
  add column if not exists source_system text,
  add column if not exists source_run_id text,
  add column if not exists source_publication_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_publications_source_run
  on publications(session_id, source_run_id);

create unique index if not exists idx_publications_source_publication_unique
  on publications(session_id, source_run_id, source_publication_id)
  where source_run_id is not null and source_publication_id is not null;
