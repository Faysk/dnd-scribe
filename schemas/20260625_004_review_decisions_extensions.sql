-- DnD Scribe - review decision import extensions.
-- Allows local Review Board decisions to be applied idempotently.

alter table review_decisions
  add column if not exists source_system text,
  add column if not exists source_run_id text,
  add column if not exists source_decision_id text,
  add column if not exists target_source_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_review_decisions_source_run
  on review_decisions(session_id, source_run_id);

create unique index if not exists idx_review_decisions_source_unique
  on review_decisions(session_id, source_run_id, source_decision_id)
  where source_run_id is not null and source_decision_id is not null;
