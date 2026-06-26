-- DnD Scribe - OpenAI cost controls: audio hashes, silence metadata, transcript cache and usage ledger.

alter table recording_files
  add column if not exists sha256 text,
  add column if not exists audio_rms numeric,
  add column if not exists audio_peak integer,
  add column if not exists audio_dbfs numeric,
  add column if not exists probably_silent boolean,
  add column if not exists silence_dbfs_threshold numeric;

alter table audio_chunks
  add column if not exists sha256 text,
  add column if not exists audio_rms numeric,
  add column if not exists audio_peak integer,
  add column if not exists audio_dbfs numeric,
  add column if not exists probably_silent boolean,
  add column if not exists silence_dbfs_threshold numeric;

create index if not exists idx_recording_files_sha256
  on recording_files(sha256)
  where sha256 is not null;

create index if not exists idx_audio_chunks_sha256
  on audio_chunks(sha256)
  where sha256 is not null;

create index if not exists idx_audio_chunks_silence
  on audio_chunks(session_id, probably_silent)
  where probably_silent is not null;

create table if not exists transcription_cache (
  id uuid primary key default gen_random_uuid(),
  audio_sha256 text not null,
  audio_duration_ms integer,
  provider text not null default 'openai',
  model text not null,
  prompt_version text not null default 'transcribe_v1',
  language text,
  status text not null default 'succeeded' check (status in ('succeeded','failed','skipped_silence','needs_review')),
  transcript_text text not null default '',
  segments jsonb not null default '[]'::jsonb,
  confidence numeric,
  raw_response jsonb not null default '{}'::jsonb,
  provider_request_id text,
  input_audio_minutes numeric,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric(12, 6),
  actual_cost_usd numeric(12, 6),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (provider, model, prompt_version, audio_sha256)
);

create index if not exists idx_transcription_cache_audio_sha
  on transcription_cache(audio_sha256);

create index if not exists idx_transcription_cache_status
  on transcription_cache(status);

create table if not exists ai_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete set null,
  session_id uuid references sessions(id) on delete set null,
  job_id uuid references processing_jobs(id) on delete set null,
  provider text not null default 'openai',
  model text not null,
  operation_type text not null check (operation_type in ('transcription','classification','summarization','embedding','rerank','other')),
  status text not null default 'estimated' check (status in ('estimated','submitted','succeeded','failed','cached','skipped')),
  source_hash text,
  provider_request_id text,
  provider_batch_id text,
  input_audio_minutes numeric,
  input_tokens integer,
  cached_input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric(12, 6),
  actual_cost_usd numeric(12, 6),
  currency text not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_ai_usage_ledger_session
  on ai_usage_ledger(session_id, created_at desc);

create index if not exists idx_ai_usage_ledger_source_hash
  on ai_usage_ledger(source_hash)
  where source_hash is not null;

create index if not exists idx_ai_usage_ledger_operation_status
  on ai_usage_ledger(operation_type, status, created_at desc);

create or replace view ai_usage_session_summary as
select
  s.id as session_id,
  s.source_session_id,
  count(l.id) as ledger_entries,
  coalesce(sum(l.estimated_cost_usd), 0)::numeric(12, 6) as estimated_cost_usd,
  coalesce(sum(l.actual_cost_usd), 0)::numeric(12, 6) as actual_cost_usd,
  coalesce(sum(l.input_audio_minutes), 0)::numeric(12, 3) as input_audio_minutes,
  coalesce(sum(l.input_tokens), 0)::bigint as input_tokens,
  coalesce(sum(l.cached_input_tokens), 0)::bigint as cached_input_tokens,
  coalesce(sum(l.output_tokens), 0)::bigint as output_tokens,
  max(l.created_at) as last_usage_at
from sessions s
left join ai_usage_ledger l on l.session_id = s.id
group by s.id, s.source_session_id;
