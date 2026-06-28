-- DnD Scribe - retryable processing job steps and progress summaries.

create table if not exists processing_job_steps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references processing_jobs(id) on delete cascade,
  step_key text not null,
  label text not null,
  status text not null default 'pending' check (status in (
    'pending',
    'running',
    'succeeded',
    'failed',
    'retrying',
    'skipped',
    'blocked'
  )),
  attempts integer not null default 0,
  retryable boolean not null default true,
  order_index integer not null default 0,
  progress jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, step_key)
);

create index if not exists idx_processing_job_steps_job_order
  on processing_job_steps(job_id, order_index, created_at);

create index if not exists idx_processing_job_steps_status
  on processing_job_steps(status, retryable)
  where status in ('failed', 'retrying', 'running', 'blocked');

insert into processing_job_steps (
  job_id,
  step_key,
  label,
  status,
  attempts,
  retryable,
  order_index,
  progress,
  error,
  started_at,
  finished_at,
  created_at,
  updated_at
)
select
  pj.id,
  pj.job_type,
  case pj.job_type
    when 'craig_direct_upload' then 'Upload ZIP Craig'
    when 'cloud_ingest_craig' then 'Manifest Craig'
    when 'cloud_extract_craig_tracks' then 'Extrair faixas'
    when 'cloud_plan_audio_chunks' then 'Planejar chunks'
    else pj.job_type
  end,
  case pj.status
    when 'queued' then 'pending'
    when 'retrying' then 'retrying'
    when 'running' then 'running'
    when 'succeeded' then 'succeeded'
    when 'failed' then 'failed'
    when 'cancelled' then 'blocked'
    else 'pending'
  end,
  coalesce(pj.attempts, 0),
  pj.status in ('queued', 'retrying', 'running', 'failed'),
  case pj.job_type
    when 'craig_direct_upload' then 10
    when 'cloud_ingest_craig' then 20
    when 'cloud_extract_craig_tracks' then 30
    when 'cloud_plan_audio_chunks' then 40
    else 100
  end,
  coalesce(pj.output, '{}'::jsonb),
  pj.error,
  pj.started_at,
  pj.finished_at,
  pj.created_at,
  now()
from processing_jobs pj
on conflict (job_id, step_key) do update set
  label = excluded.label,
  status = excluded.status,
  attempts = greatest(processing_job_steps.attempts, excluded.attempts),
  retryable = excluded.retryable,
  order_index = excluded.order_index,
  progress = coalesce(processing_job_steps.progress, '{}'::jsonb) || excluded.progress,
  error = excluded.error,
  started_at = coalesce(processing_job_steps.started_at, excluded.started_at),
  finished_at = coalesce(excluded.finished_at, processing_job_steps.finished_at),
  updated_at = now();

create or replace view processing_job_step_summary as
select
  pjs.job_id,
  count(*)::int as total_steps,
  count(*) filter (where pjs.status = 'succeeded')::int as succeeded_steps,
  count(*) filter (where pjs.status = 'failed')::int as failed_steps,
  count(*) filter (where pjs.status = 'running')::int as running_steps,
  count(*) filter (where pjs.status = 'retrying')::int as retrying_steps,
  count(*) filter (where pjs.status = 'blocked')::int as blocked_steps,
  case
    when count(*) filter (where pjs.status = 'failed') > 0 then 'failed'
    when count(*) filter (where pjs.status = 'blocked') > 0 then 'blocked'
    when count(*) filter (where pjs.status = 'running') > 0 then 'running'
    when count(*) filter (where pjs.status = 'retrying') > 0 then 'retrying'
    when count(*) filter (where pjs.status = 'pending') > 0 then 'pending'
    when count(*) filter (where pjs.status = 'succeeded') = count(*) then 'succeeded'
    else 'pending'
  end as step_status,
  json_agg(
    json_build_object(
      'id', pjs.id,
      'key', pjs.step_key,
      'label', pjs.label,
      'status', pjs.status,
      'attempts', pjs.attempts,
      'retryable', pjs.retryable,
      'orderIndex', pjs.order_index,
      'progress', pjs.progress,
      'error', pjs.error,
      'startedAt', pjs.started_at,
      'finishedAt', pjs.finished_at,
      'updatedAt', pjs.updated_at
    )
    order by pjs.order_index, pjs.created_at
  ) as steps
from processing_job_steps pjs
group by pjs.job_id;
