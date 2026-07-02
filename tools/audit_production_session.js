#!/usr/bin/env node

const fs = require('fs');
const { Pool } = require('pg');

const DEFAULT_CAMPAIGN = 'yuhara-main';
const DEFAULT_COST_PER_MINUTE = 0.003;

function readEnv(path = '.env.local') {
  const values = { ...process.env };
  if (!fs.existsSync(path)) return values;
  for (const raw of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function argValue(name, fallback = '') {
  const prefix = `${name}=`;
  const inline = process.argv.find(item => item.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function asInt(value) {
  return Number.parseInt(value || 0, 10) || 0;
}

function asFloat(value) {
  return Number.parseFloat(value || 0) || 0;
}

async function tableExists(db, table) {
  const result = await db.query(
    `select exists (
       select 1 from information_schema.tables
       where table_schema = 'public' and table_name = $1
     ) exists`,
    [table]
  );
  return Boolean(result.rows[0]?.exists);
}

async function optionalCount(db, table, sessionId) {
  if (!(await tableExists(db, table))) return null;
  if (sessionId) {
    const columns = await db.query(
      `select column_name from information_schema.columns where table_schema='public' and table_name=$1`,
      [table]
    );
    if (columns.rows.some(row => row.column_name === 'session_id')) {
      const result = await db.query(`select count(*)::int count from ${table} where session_id=$1::uuid`, [sessionId]);
      return result.rows[0]?.count || 0;
    }
  }
  const result = await db.query(`select count(*)::int count from ${table}`);
  return result.rows[0]?.count || 0;
}

function evaluate(report) {
  const issues = [];
  const warnings = [];
  const jobs = report.jobs || [];
  const failed = jobs.filter(job => job.status === 'failed');
  const running = jobs.filter(job => job.status === 'running');
  const speech = report.speech || {};
  const transcription = report.transcription || {};

  if (failed.length) issues.push(`${failed.length} job(s) failed`);
  if (running.length) warnings.push(`${running.length} job(s) still running`);
  if (speech.totalChunks && speech.coveredChunks < speech.totalChunks) {
    warnings.push(`speech slicing partial: ${speech.coveredChunks}/${speech.totalChunks} chunks`);
  }
  if (transcription.objects > 0) {
    warnings.push(`paid transcription pending: ${transcription.objects} objects, ${transcription.minutes} minutes`);
  }
  if (report.roll20Events === 0) warnings.push('Roll20 events missing for this session');
  if (report.discordInteractions24h === 0) warnings.push('Discord interactions not observed in the last 24h');
  return {
    status: issues.length ? 'needs_attention' : warnings.length ? 'attention' : 'ok',
    issues,
    warnings
  };
}

async function buildReport(db, campaign, sourceSessionId, costPerMinute) {
  const sessionResult = await db.query(
    `
select s.id, s.source_session_id, s.title, s.status, s.session_date, s.started_at, s.ended_at
from sessions s
join campaigns c on c.id = s.campaign_id
where c.slug = $1 and s.source_session_id = $2
limit 1`,
    [campaign, sourceSessionId]
  );
  const session = sessionResult.rows[0];
  if (!session) {
    const error = new Error(`Session not found: ${sourceSessionId}`);
    error.code = 'SESSION_NOT_FOUND';
    throw error;
  }

  const jobs = await db.query(
    `
select job_type, status, attempts, created_at, started_at, finished_at, error,
       output->>'workerStatus' worker_status,
       output->'summary' summary
from processing_jobs
where session_id=$1
order by created_at`,
    [session.id]
  );
  const chunks = await db.query(
    `select count(*)::int total_chunks,
            coalesce(round(sum(duration_ms)::numeric / 60000, 3), 0)::text source_minutes
       from audio_chunks
      where session_id=$1`,
    [session.id]
  );
  const speech = await db.query(
    `select count(*)::int slices,
            count(distinct source_chunk_id)::int covered_chunks,
            coalesce(round(sum(duration_ms)::numeric / 60000, 3), 0)::text speech_minutes
       from audio_speech_slices
      where session_id=$1`,
    [session.id]
  );
  const byTrack = await db.query(
    `
with slice_chunks as (
  select source_chunk_id, count(*) slices, sum(duration_ms) speech_ms
  from audio_speech_slices
  where session_id=$1
  group by source_chunk_id
)
select ac.track_key,
       count(*)::int chunks,
       count(sc.source_chunk_id)::int covered_chunks,
       coalesce(sum(sc.slices), 0)::int slices,
       coalesce(round(sum(sc.speech_ms)::numeric / 60000, 3), 0)::text speech_minutes
from audio_chunks ac
left join slice_chunks sc on sc.source_chunk_id = ac.id
where ac.session_id=$1
group by ac.track_key
order by ac.track_key`,
    [session.id]
  );
  const transcription = await db.query(
    `
select count(*)::int objects,
       coalesce(round(sum(duration_ms)::numeric / 60000, 3), 0)::text minutes
from audio_transcription_work_units
where session_id=$1
  and coalesce(transcription_status, 'pending') not in ('skipped_silence', 'transcribed', 'cached')`,
    [session.id]
  );
  const artifacts = await db.query(
    `
select artifact_type, lifecycle_status, count(*)::int count, coalesce(sum(size_bytes), 0)::bigint::text bytes
from audio_artifacts
where session_id=$1
group by artifact_type, lifecycle_status
order by artifact_type, lifecycle_status`,
    [session.id]
  );
  const cleanup = await db.query(
    `
select readiness_status, count(*)::int count, coalesce(sum(reclaimable_bytes), 0)::bigint::text bytes
from audio_storage_cleanup_candidates
where session_id=$1
group by readiness_status
order by readiness_status`,
    [session.id]
  );
  const ledger = await db.query(
    `
select operation_type, count(*)::int entries,
       coalesce(round(sum(input_audio_minutes)::numeric, 3), 0)::text minutes,
       coalesce(round(sum(estimated_cost_usd)::numeric, 6), 0)::text cost_usd
from ai_usage_ledger
where session_id=$1
group by operation_type
order by operation_type`,
    [session.id]
  );

  const roll20Events = await optionalCount(db, 'roll20_events', session.id);
  const discordInteractions24h = (await tableExists(db, 'discord_interactions'))
    ? (await db.query(`select count(*)::int count from discord_interactions where created_at > now() - interval '24 hours'`)).rows[0].count
    : null;

  const source = chunks.rows[0] || {};
  const speechRow = speech.rows[0] || {};
  const transcriptionRow = transcription.rows[0] || {};
  const report = {
    campaign,
    sourceSessionId,
    session,
    jobs: jobs.rows.map(row => ({
      type: row.job_type,
      status: row.status,
      attempts: row.attempts,
      createdAt: row.created_at,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      workerStatus: row.worker_status,
      error: row.error,
      summary: row.summary
    })),
    sourceAudio: {
      chunks: asInt(source.total_chunks),
      minutes: asFloat(source.source_minutes)
    },
    speech: {
      slices: asInt(speechRow.slices),
      coveredChunks: asInt(speechRow.covered_chunks),
      totalChunks: asInt(source.total_chunks),
      minutes: asFloat(speechRow.speech_minutes),
      reductionPercent: asFloat(source.source_minutes)
        ? Number(((1 - (asFloat(speechRow.speech_minutes) / asFloat(source.source_minutes))) * 100).toFixed(2))
        : 0
    },
    speechByTrack: byTrack.rows,
    transcription: {
      objects: asInt(transcriptionRow.objects),
      minutes: asFloat(transcriptionRow.minutes),
      configuredCostUsdPerMinute: costPerMinute,
      estimatedCostUsd: Number((asFloat(transcriptionRow.minutes) * costPerMinute).toFixed(6))
    },
    artifacts: artifacts.rows,
    cleanup: cleanup.rows,
    ledger: ledger.rows,
    roll20Events,
    discordInteractions24h
  };
  report.evaluation = evaluate(report);
  return report;
}

function printHuman(report) {
  console.log(`session=${report.sourceSessionId}`);
  console.log(`status=${report.evaluation.status}`);
  console.log(`jobs=${report.jobs.map(job => `${job.type}:${job.status}`).join(', ')}`);
  console.log(`audio=${report.sourceAudio.minutes}m/${report.sourceAudio.chunks} chunks`);
  console.log(`speech=${report.speech.minutes}m ${report.speech.coveredChunks}/${report.speech.totalChunks} chunks ${report.speech.slices} slices reduction=${report.speech.reductionPercent}%`);
  console.log(`transcription=${report.transcription.objects} objects ${report.transcription.minutes}m estimate=$${report.transcription.estimatedCostUsd}`);
  console.log(`roll20Events=${report.roll20Events ?? 'n/a'} discordInteractions24h=${report.discordInteractions24h ?? 'n/a'}`);
  for (const issue of report.evaluation.issues) console.log(`issue=${issue}`);
  for (const warning of report.evaluation.warnings) console.log(`warning=${warning}`);
}

async function main() {
  const sourceSessionId = argValue('--source-session-id') || argValue('--sourceSessionId') || process.argv[2];
  if (!sourceSessionId || sourceSessionId.startsWith('--')) {
    console.error('Usage: node tools/audit_production_session.js <sourceSessionId> [--campaign yuhara-main] [--json] [--strict]');
    process.exit(2);
  }
  const campaign = argValue('--campaign', DEFAULT_CAMPAIGN);
  const json = process.argv.includes('--json');
  const strict = process.argv.includes('--strict');
  const env = readEnv();
  const connectionString = env.SUPABASE_DB_URL || env.DATABASE_URL || env.POSTGRES_URL || env.POSTGRES_PRISMA_URL;
  if (!connectionString) {
    console.error('Missing database URL in env.');
    process.exit(2);
  }
  const costPerMinute = Number(env.DND_COST_TRANSCRIPTION_AUDIO_MINUTE_USD || DEFAULT_COST_PER_MINUTE);
  const db = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    const report = await buildReport(db, campaign, sourceSessionId, costPerMinute);
    if (json) console.log(JSON.stringify(report, null, 2));
    else printHuman(report);
    if (strict && report.evaluation.status !== 'ok') process.exit(1);
  } finally {
    await db.end();
  }
}

main().catch(error => {
  console.error(error.message || String(error));
  process.exit(error.code === 'SESSION_NOT_FOUND' ? 2 : 1);
});
