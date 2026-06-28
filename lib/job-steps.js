const STEP_META = {
  cloud_ingest_craig: {
    key: 'manifest',
    label: 'Manifest Craig',
    orderIndex: 20
  },
  cloud_extract_craig_tracks: {
    key: 'extract_tracks',
    label: 'Extrair faixas',
    orderIndex: 30
  },
  cloud_plan_audio_chunks: {
    key: 'plan_chunks',
    label: 'Planejar chunks',
    orderIndex: 40
  },
  transcribe_audio: {
    key: 'transcribe',
    label: 'Transcrever audio',
    orderIndex: 60
  }
};

function stepMeta(jobType, override = {}) {
  const base = STEP_META[jobType] || {
    key: jobType || 'job',
    label: jobType || 'Job',
    orderIndex: 100
  };
  return {
    key: override.key || base.key,
    label: override.label || base.label,
    orderIndex: override.orderIndex ?? base.orderIndex
  };
}

async function markJobStep(db, job, status, detail = {}) {
  const jobId = typeof job === 'string' ? job : job?.id;
  const jobType = typeof job === 'string' ? detail.jobType : job?.job_type || job?.type || detail.jobType;
  if (!db || !jobId) return { ok: false, skipped: true };
  const meta = stepMeta(jobType, detail);
  const retryable = detail.retryable ?? !['succeeded', 'skipped'].includes(status);
  const progress = detail.progress || {};
  const error = detail.error ? String(detail.error).slice(0, 4000) : null;
  try {
    await db.query(
      `
insert into processing_job_steps (
  id, job_id, step_key, label, status, attempts, retryable, order_index,
  progress, error, started_at, finished_at, created_at, updated_at
)
values (
  gen_random_uuid(), $1::uuid, $2, $3, $4,
  case when $4 = 'running' then 1 else 0 end,
  $5::boolean, $6::integer, $7::jsonb, $8,
  case when $4 in ('running','succeeded','failed','retrying','blocked') then now() else null end,
  case when $4 in ('succeeded','failed','skipped','blocked') then now() else null end,
  now(), now()
)
on conflict (job_id, step_key) do update set
  label = excluded.label,
  status = excluded.status,
  attempts = case
    when excluded.status = 'running'
     and processing_job_steps.status <> 'running'
      then processing_job_steps.attempts + 1
    else processing_job_steps.attempts
  end,
  retryable = excluded.retryable,
  order_index = excluded.order_index,
  progress = coalesce(processing_job_steps.progress, '{}'::jsonb) || excluded.progress,
  error = excluded.error,
  started_at = case
    when excluded.status in ('running','succeeded','failed','retrying','blocked')
      then coalesce(processing_job_steps.started_at, now())
    else processing_job_steps.started_at
  end,
  finished_at = case
    when excluded.status in ('succeeded','failed','skipped','blocked') then now()
    when excluded.status in ('running','retrying') then null
    else processing_job_steps.finished_at
  end,
  updated_at = now();`,
      [
        jobId,
        meta.key,
        meta.label,
        status,
        retryable,
        meta.orderIndex,
        JSON.stringify(progress),
        error
      ]
    );
    return { ok: true };
  } catch (error_) {
    console.warn('job_step_update_failed', error_.message || String(error_));
    return { ok: false, error: error_.message || String(error_) };
  }
}

module.exports = {
  markJobStep,
  stepMeta
};
