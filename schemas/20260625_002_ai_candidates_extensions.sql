-- DnD Scribe - AI classification/candidate extensions.
-- Adds source run metadata so AI suggestions can be regenerated idempotently.

alter table segment_classifications
  add column if not exists source_run_id text,
  add column if not exists raw_output jsonb not null default '{}'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_segment_classifications_source_run
  on segment_classifications(source_run_id);

alter table canon_candidates
  add column if not exists source_system text,
  add column if not exists source_run_id text,
  add column if not exists source_candidate_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_canon_candidates_source_run
  on canon_candidates(session_id, source_run_id);

alter table quote_candidates
  add column if not exists source_system text,
  add column if not exists source_run_id text,
  add column if not exists source_candidate_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_quote_candidates_source_run
  on quote_candidates(session_id, source_run_id);

alter table outtake_candidates
  add column if not exists source_system text,
  add column if not exists source_run_id text,
  add column if not exists source_candidate_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_outtake_candidates_source_run
  on outtake_candidates(session_id, source_run_id);
