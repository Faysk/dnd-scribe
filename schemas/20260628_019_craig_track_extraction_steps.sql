-- DnD Scribe - per-track Craig extraction progress and resumability.

create table if not exists craig_track_extraction_steps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  job_id uuid references processing_jobs(id) on delete set null,
  source_recording_file_id uuid references recording_files(id) on delete set null,
  recording_file_id uuid references recording_files(id) on delete set null,
  track_key text not null,
  source_filename text not null,
  source_storage_bucket text,
  source_storage_path text,
  target_storage_bucket text not null,
  target_storage_path text not null,
  status text not null default 'pending' check (status in (
    'pending',
    'running',
    'succeeded',
    'failed',
    'skipped'
  )),
  attempts integer not null default 0,
  size_bytes bigint,
  compressed_size_bytes bigint,
  duration_ms integer,
  compression_method integer,
  crc32 bigint,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, target_storage_bucket, target_storage_path),
  unique (session_id, source_recording_file_id, track_key)
);

create index if not exists idx_craig_track_extraction_steps_job
  on craig_track_extraction_steps(job_id, status, updated_at desc);

create index if not exists idx_craig_track_extraction_steps_session_status
  on craig_track_extraction_steps(session_id, status, updated_at desc);

create index if not exists idx_craig_track_extraction_steps_source_file
  on craig_track_extraction_steps(source_recording_file_id, track_key)
  where source_recording_file_id is not null;

alter table craig_track_extraction_steps enable row level security;

with recording_tracks as (
  select
    rf.*,
    case
      when (rf.metadata->>'source_job_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (rf.metadata->>'source_job_id')::uuid
      else null
    end as source_job_id
  from recording_files rf
  where rf.file_type = 'craig_track'
)
insert into craig_track_extraction_steps (
  session_id,
  job_id,
  source_recording_file_id,
  recording_file_id,
  track_key,
  source_filename,
  source_storage_bucket,
  source_storage_path,
  target_storage_bucket,
  target_storage_path,
  status,
  attempts,
  size_bytes,
  compressed_size_bytes,
  duration_ms,
  compression_method,
  crc32,
  metadata,
  started_at,
  finished_at,
  created_at,
  updated_at
)
select
  rt.session_id,
  rt.source_job_id,
  case
    when (pj.input->>'recordingFileId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (pj.input->>'recordingFileId')::uuid
    else null
  end,
  rt.id,
  coalesce(nullif(rt.metadata->>'track_key', ''), regexp_replace(coalesce(rt.source_file_role, ''), '^craig_track_', ''), 'unknown'),
  coalesce(nullif(rt.metadata->>'source_zip_filename', ''), rt.original_filename, rt.storage_path),
  nullif(rt.metadata->>'source_zip_bucket', ''),
  nullif(rt.metadata->>'source_zip_path', ''),
  rt.storage_bucket,
  rt.storage_path,
  'succeeded',
  greatest(coalesce(pj.attempts, 1), 1),
  rt.size_bytes,
  nullif(rt.metadata->>'compressed_size', '')::bigint,
  rt.duration_ms,
  nullif(rt.metadata->>'compression_method', '')::integer,
  nullif(rt.metadata->>'crc32', '')::bigint,
  coalesce(rt.metadata, '{}'::jsonb) || jsonb_build_object('backfilled_from', 'recording_files'),
  coalesce(pj.started_at, rt.created_at),
  coalesce(pj.finished_at, rt.created_at),
  rt.created_at,
  now()
from recording_tracks rt
left join processing_jobs pj on pj.id = rt.source_job_id
on conflict (session_id, target_storage_bucket, target_storage_path) do update set
  job_id = coalesce(excluded.job_id, craig_track_extraction_steps.job_id),
  source_recording_file_id = coalesce(excluded.source_recording_file_id, craig_track_extraction_steps.source_recording_file_id),
  recording_file_id = coalesce(excluded.recording_file_id, craig_track_extraction_steps.recording_file_id),
  status = 'succeeded',
  attempts = greatest(craig_track_extraction_steps.attempts, excluded.attempts),
  size_bytes = coalesce(excluded.size_bytes, craig_track_extraction_steps.size_bytes),
  compressed_size_bytes = coalesce(excluded.compressed_size_bytes, craig_track_extraction_steps.compressed_size_bytes),
  duration_ms = coalesce(excluded.duration_ms, craig_track_extraction_steps.duration_ms),
  compression_method = coalesce(excluded.compression_method, craig_track_extraction_steps.compression_method),
  crc32 = coalesce(excluded.crc32, craig_track_extraction_steps.crc32),
  metadata = coalesce(craig_track_extraction_steps.metadata, '{}'::jsonb) || excluded.metadata,
  error = null,
  started_at = coalesce(craig_track_extraction_steps.started_at, excluded.started_at),
  finished_at = coalesce(excluded.finished_at, craig_track_extraction_steps.finished_at, now()),
  updated_at = now();

create or replace view craig_track_extraction_summary
with (security_invoker = true) as
select
  ctes.job_id,
  ctes.session_id,
  ctes.source_recording_file_id,
  count(*)::int as total_tracks,
  count(*) filter (where ctes.status = 'pending')::int as pending_tracks,
  count(*) filter (where ctes.status = 'running')::int as running_tracks,
  count(*) filter (where ctes.status = 'succeeded')::int as succeeded_tracks,
  count(*) filter (where ctes.status = 'failed')::int as failed_tracks,
  count(*) filter (where ctes.status = 'skipped')::int as skipped_tracks,
  coalesce(sum(ctes.size_bytes) filter (where ctes.status = 'succeeded'), 0)::bigint as extracted_bytes,
  coalesce(sum(ctes.compressed_size_bytes), 0)::bigint as source_compressed_bytes,
  case
    when count(*) filter (where ctes.status = 'failed') > 0 then 'failed'
    when count(*) filter (where ctes.status = 'running') > 0 then 'running'
    when count(*) filter (where ctes.status = 'pending') > 0 then 'pending'
    when count(*) filter (where ctes.status = 'succeeded') = count(*) then 'succeeded'
    else 'pending'
  end as extraction_status,
  json_agg(
    json_build_object(
      'id', ctes.id,
      'trackKey', ctes.track_key,
      'filename', ctes.source_filename,
      'status', ctes.status,
      'attempts', ctes.attempts,
      'sizeBytes', ctes.size_bytes,
      'compressedSizeBytes', ctes.compressed_size_bytes,
      'durationMs', ctes.duration_ms,
      'targetPath', ctes.target_storage_path,
      'recordingFileId', ctes.recording_file_id,
      'error', ctes.error,
      'startedAt', ctes.started_at,
      'finishedAt', ctes.finished_at,
      'updatedAt', ctes.updated_at
    )
    order by ctes.track_key, ctes.source_filename
  ) as tracks
from craig_track_extraction_steps ctes
group by ctes.job_id, ctes.session_id, ctes.source_recording_file_id;
