const crypto = require('crypto');
const { Pool } = require('pg');

const DEFAULT_CHUNK_SECONDS = 600;
const MIN_CHUNK_SECONDS = 60;
const MAX_CHUNK_SECONDS = 1800;
const FLAC_HEADER_READ_BYTES = 64 * 1024;

let pool;

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_POOLER_URL || process.env.SUPABASE_POOLER_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_POOLER_URL or DATABASE_URL is not configured');
  pool = new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false }
  });
  return pool;
}

function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanText(value, max = 500) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : '';
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(req.body ? JSON.parse(req.body) : {});
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 128 * 1024) {
        reject(httpError(413, 'Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_error) {
        reject(httpError(400, 'JSON invalido.'));
      }
    });
    req.on('error', reject);
  });
}

function r2Config() {
  const endpoint = process.env.R2_S3_ENDPOINT || process.env.R2_ENDPOINT || '';
  return {
    endpoint,
    bucket: process.env.R2_BUCKET || '',
    accessKey: process.env.R2_ACCESS_KEY_ID || '',
    secretKey: process.env.R2_SECRET_ACCESS_KEY || ''
  };
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function r2SigningKey(secretKey, dateStamp) {
  const kDate = hmac(Buffer.from(`AWS4${secretKey}`, 'utf8'), dateStamp);
  const kRegion = hmac(kDate, 'auto');
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

function encodeRfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalQuery(params) {
  return Object.keys(params).sort().map(key => `${encodeRfc3986(key)}=${encodeRfc3986(params[key])}`).join('&');
}

function createR2SignedUrl(key, expiresSeconds, bucketOverride = '', method = 'GET') {
  const config = r2Config();
  if (!config.endpoint || !config.bucket || !config.accessKey || !config.secretKey) {
    throw httpError(500, 'R2 config ausente no ambiente.');
  }
  const endpoint = new URL(config.endpoint);
  const bucket = bucketOverride || config.bucket;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const canonicalUri = `/${encodeRfc3986(bucket)}/${String(key).split('/').map(encodeRfc3986).join('/')}`;
  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${config.accessKey}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': 'host'
  };
  const query = canonicalQuery(params);
  const canonicalRequest = [
    method,
    canonicalUri,
    query,
    `host:${endpoint.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD'
  ].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256(canonicalRequest)].join('\n');
  const signature = hmac(r2SigningKey(config.secretKey, dateStamp), stringToSign, 'hex');
  return `${endpoint.protocol}//${endpoint.host}${canonicalUri}?${query}&X-Amz-Signature=${signature}`;
}

async function fetchObjectRangeBuffer(bucket, key, start, end) {
  const response = await fetch(createR2SignedUrl(key, 300, bucket, 'GET'), {
    headers: { Range: `bytes=${start}-${end}` }
  });
  if (![200, 206].includes(response.status)) {
    throw httpError(502, `Falha ao ler range R2 ${start}-${end} (${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function headObject(bucket, key) {
  const response = await fetch(createR2SignedUrl(key, 300, bucket, 'HEAD'), { method: 'HEAD' });
  if (!response.ok) throw httpError(502, `Falha ao consultar R2 HEAD (${response.status}).`);
  return Number(response.headers.get('content-length') || 0);
}

function parseFlacStreamInfo(buffer) {
  if (buffer.subarray(0, 4).toString('ascii') !== 'fLaC') {
    throw httpError(400, 'Arquivo de faixa nao parece FLAC.');
  }
  let offset = 4;
  while (offset + 4 <= buffer.length) {
    const header = buffer[offset];
    const blockType = header & 0x7f;
    const length = buffer.readUIntBE(offset + 1, 3);
    const dataStart = offset + 4;
    const dataEnd = dataStart + length;
    if (dataEnd > buffer.length) break;
    if (blockType === 0) {
      if (length < 34) throw httpError(400, 'STREAMINFO FLAC curto demais.');
      const block = buffer.subarray(dataStart, dataEnd);
      const sampleRate = (block[10] << 12) | (block[11] << 4) | (block[12] >> 4);
      const channels = ((block[12] & 0x0e) >> 1) + 1;
      const bitsPerSample = (((block[12] & 0x01) << 4) | (block[13] >> 4)) + 1;
      const totalSamples = (BigInt(block[13] & 0x0f) << 32n) | BigInt(block.readUInt32BE(14));
      if (!sampleRate || totalSamples <= 0n) throw httpError(400, 'STREAMINFO FLAC sem duracao util.');
      const durationMs = Number((totalSamples * 1000n) / BigInt(sampleRate));
      return { sampleRate, channels, bitsPerSample, totalSamples: totalSamples.toString(), durationMs };
    }
    offset = dataEnd;
    if (header & 0x80) break;
  }
  throw httpError(400, 'STREAMINFO FLAC nao encontrado nos primeiros bytes.');
}

function normalizeChunkSeconds(raw) {
  const value = Number(raw.chunkSeconds || raw.chunk_seconds || DEFAULT_CHUNK_SECONDS);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_CHUNK_SECONDS;
  return Math.max(MIN_CHUNK_SECONDS, Math.min(MAX_CHUNK_SECONDS, Math.floor(value)));
}

function safePathSegment(value) {
  return cleanText(value, 200)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '') || 'unknown';
}

function plannedChunkPath(job, trackKey, chunkIndex) {
  return [
    'campaigns',
    safePathSegment(job.campaign_slug || 'campaign'),
    'sessions',
    safePathSegment(job.source_session_id || job.session_id),
    'chunks',
    safePathSegment(trackKey),
    `chunk_${String(chunkIndex).padStart(3, '0')}.flac`
  ].join('/');
}

async function selectJob(db, jobId) {
  const result = await db.query(
    `
select pj.*, s.source_session_id, s.title session_title, c.slug campaign_slug
from processing_jobs pj
join sessions s on s.id = pj.session_id
join campaigns c on c.id = s.campaign_id
where pj.job_type = 'cloud_plan_audio_chunks'
  and ($1::uuid is null or pj.id = $1::uuid)
  and pj.status in ('queued','retrying','running')
order by case when pj.status = 'running' then 1 else 0 end, pj.created_at
limit 1;`,
    [jobId || null]
  );
  return result.rows[0] || null;
}

async function claimJob(db, jobId) {
  const result = await db.query(
    `
with candidate as (
  select pj.id
  from processing_jobs pj
  where pj.job_type = 'cloud_plan_audio_chunks'
    and pj.status in ('queued','retrying')
    and ($1::uuid is null or pj.id = $1::uuid)
  order by pj.created_at
  for update skip locked
  limit 1
)
update processing_jobs pj
set status = 'running',
    attempts = coalesce(pj.attempts, 0) + 1,
    started_at = now(),
    error = null,
    output = coalesce(pj.output, '{}'::jsonb) || $2::jsonb
from candidate
where pj.id = candidate.id
returning pj.*;`,
    [jobId || null, JSON.stringify({ workerStatus: 'running', worker: 'vercel_cloud_plan_chunks', paidAiCostUsd: 0 })]
  );
  return result.rows[0] || null;
}

async function finishJob(db, jobId, output) {
  await db.query(
    `
update processing_jobs
set status = 'succeeded',
    output = coalesce(output, '{}'::jsonb) || $2::jsonb,
    finished_at = now(),
    error = null
where id = $1::uuid;`,
    [jobId, JSON.stringify(output)]
  );
}

async function failJob(db, jobId, error, output = {}) {
  await db.query(
    `
update processing_jobs
set status = 'failed',
    output = coalesce(output, '{}'::jsonb) || $3::jsonb,
    finished_at = now(),
    error = $2
where id = $1::uuid;`,
    [jobId, String(error.message || error).slice(0, 4000), JSON.stringify(output)]
  );
}

async function loadTrackFiles(db, job) {
  const fromInput = Array.isArray(job.input?.trackFiles) ? job.input.trackFiles : [];
  if (fromInput.length) {
    return fromInput.map(item => ({
      recordingFileId: item.recordingFileId || item.recording_file_id,
      trackKey: item.trackKey || item.track_key,
      storageBucket: item.storageBucket || item.storage_bucket,
      storagePath: item.storagePath || item.storage_path,
      sizeBytes: item.sizeBytes || item.size_bytes || null
    })).filter(item => item.recordingFileId && item.trackKey && item.storageBucket && item.storagePath);
  }
  const result = await db.query(
    `
select id recording_file_id, source_file_role, storage_bucket, storage_path, size_bytes
from recording_files
where session_id = $1::uuid
  and file_type = 'craig_track'
order by source_file_role, storage_path;`,
    [job.session_id]
  );
  return result.rows.map(row => ({
    recordingFileId: row.recording_file_id,
    trackKey: String(row.source_file_role || '').replace(/^craig_track_/, '') || row.storage_path.split('/').pop().replace(/\.[^.]+$/, ''),
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    sizeBytes: row.size_bytes || null
  }));
}

async function inspectTrack(track) {
  const sizeBytes = Number(track.sizeBytes || 0) || await headObject(track.storageBucket, track.storagePath);
  const headerBytes = Math.min(sizeBytes, FLAC_HEADER_READ_BYTES);
  const header = await fetchObjectRangeBuffer(track.storageBucket, track.storagePath, 0, headerBytes - 1);
  const flac = parseFlacStreamInfo(header);
  return { ...track, sizeBytes, flac, durationMs: flac.durationMs };
}

function chunkPlanForTrack(job, track, chunkSeconds) {
  const chunkMs = chunkSeconds * 1000;
  const chunks = [];
  let index = 0;
  for (let startMs = 0; startMs < track.durationMs; startMs += chunkMs) {
    const endMs = Math.min(track.durationMs, startMs + chunkMs);
    chunks.push({
      trackKey: track.trackKey,
      sourceFileId: track.recordingFileId,
      chunkIndex: index,
      startMs,
      endMs,
      durationMs: endMs - startMs,
      storageBucket: track.storageBucket,
      storagePath: plannedChunkPath(job, track.trackKey, index),
      sourceTrackPath: track.storagePath,
      sourceTrackSizeBytes: track.sizeBytes,
      flac: track.flac
    });
    index += 1;
  }
  return chunks;
}

async function upsertChunk(db, job, chunk, chunkSeconds) {
  const result = await db.query(
    `
insert into audio_chunks (
  id, session_id, source_file_id, chunk_index, start_ms, end_ms,
  storage_bucket, storage_path, transcription_status, created_at,
  track_key, source_chunk_name, duration_ms, size_bytes, metadata, updated_at
)
values (
  gen_random_uuid(), $1::uuid, $2::uuid, $3::int, $4::int, $5::int,
  $6, $7, 'planned_cloud_chunk', now(),
  $8, $9, $10::int, null, $11::jsonb, now()
)
on conflict (session_id, track_key, chunk_index)
where track_key is not null
do update set
  source_file_id = excluded.source_file_id,
  start_ms = excluded.start_ms,
  end_ms = excluded.end_ms,
  storage_bucket = excluded.storage_bucket,
  storage_path = excluded.storage_path,
  transcription_status = case
    when audio_chunks.transcription_status in ('succeeded','skipped_silence') then audio_chunks.transcription_status
    else excluded.transcription_status
  end,
  duration_ms = excluded.duration_ms,
  metadata = coalesce(audio_chunks.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now()
returning id;`,
    [
      job.session_id,
      chunk.sourceFileId,
      chunk.chunkIndex,
      chunk.startMs,
      chunk.endMs,
      chunk.storageBucket,
      chunk.storagePath,
      chunk.trackKey,
      `chunk_${String(chunk.chunkIndex).padStart(3, '0')}.flac`,
      chunk.durationMs,
      JSON.stringify({
        imported_from: 'cloud_plan_audio_chunks',
        source_job_id: job.id,
        source_track_path: chunk.sourceTrackPath,
        source_track_size_bytes: chunk.sourceTrackSizeBytes,
        planned_only: true,
        storage_state: 'planned_not_rendered',
        chunk_seconds: chunkSeconds,
        flac: chunk.flac
      })
    ]
  );
  return result.rows[0].id;
}

async function insertNextSpeechJob(db, job, chunks, chunkSeconds) {
  const result = await db.query(
    `
insert into processing_jobs (id, session_id, job_type, status, attempts, input, output, created_at)
select gen_random_uuid(), $1::uuid, 'cloud_detect_speech_slices', 'queued', 0, $2::jsonb, $3::jsonb, now()
where not exists (
  select 1 from processing_jobs
  where session_id = $1::uuid
    and job_type = 'cloud_detect_speech_slices'
    and input->>'sourcePlanJobId' = $4
    and status in ('queued','retrying','running','succeeded')
)
returning id;`,
    [
      job.session_id,
      JSON.stringify({
        sourcePlanJobId: job.id,
        sourceSessionId: job.source_session_id,
        chunkSeconds,
        chunks: chunks.map(item => ({
          audioChunkId: item.audioChunkId,
          trackKey: item.trackKey,
          chunkIndex: item.chunkIndex,
          startMs: item.startMs,
          endMs: item.endMs,
          storageBucket: item.storageBucket,
          storagePath: item.storagePath,
          sourceTrackPath: item.sourceTrackPath
        }))
      }),
      JSON.stringify({
        workerStatus: 'pending_worker_implementation',
        nextAction: 'Renderizar chunks fisicos ou detectar speech slices antes de qualquer transcricao paga.',
        paidAiCostUsd: 0
      }),
      job.id
    ]
  );
  return result.rows[0]?.id || null;
}

async function buildPlan(db, job, chunkSeconds) {
  const trackFiles = await loadTrackFiles(db, job);
  if (!trackFiles.length) throw httpError(400, 'Job sem trackFiles e sem craig_track em recording_files.');
  const inspected = [];
  for (const track of trackFiles) inspected.push(await inspectTrack(track));
  const chunks = inspected.flatMap(track => chunkPlanForTrack(job, track, chunkSeconds));
  return { trackFiles: inspected, chunks };
}

async function runPlanChunks(raw) {
  const dryRun = Boolean(raw.dryRun || raw.dry_run);
  const jobId = cleanText(raw.jobId || raw.job_id, 80) || null;
  const chunkSeconds = normalizeChunkSeconds(raw);
  const db = getPool();
  const job = dryRun ? await selectJob(db, jobId) : await claimJob(db, jobId);
  if (!job) {
    return {
      ok: true,
      processed: false,
      mode: 'cloud_plan_audio_chunks',
      message: jobId ? `Job nao encontrado ou nao elegivel: ${jobId}` : 'Nenhum job cloud_plan_audio_chunks pendente.'
    };
  }

  try {
    const plan = await buildPlan(db, job, chunkSeconds);
    if (dryRun) {
      return {
        ok: true,
        processed: true,
        dryRun: true,
        mode: 'cloud_plan_audio_chunks',
        jobId: job.id,
        summary: {
          tracks: plan.trackFiles.length,
          chunks: plan.chunks.length,
          chunkSeconds,
          totalAudioMinutes: Math.round(plan.trackFiles.reduce((sum, item) => sum + item.durationMs, 0) / 60) / 1000
        },
        tracks: plan.trackFiles.map(item => ({
          trackKey: item.trackKey,
          durationMs: item.durationMs,
          sizeBytes: item.sizeBytes,
          flac: item.flac
        })),
        cost: { paidAiCostUsd: 0 }
      };
    }

    const persisted = [];
    for (const chunk of plan.chunks) {
      const audioChunkId = await upsertChunk(db, job, chunk, chunkSeconds);
      persisted.push({ ...chunk, audioChunkId });
    }
    const nextJobId = await insertNextSpeechJob(db, job, persisted, chunkSeconds);
    const output = {
      workerStatus: 'chunks_planned',
      paidAiCostUsd: 0,
      tracks: plan.trackFiles.length,
      chunks: persisted.length,
      chunkSeconds,
      totalAudioMinutes: Math.round(plan.trackFiles.reduce((sum, item) => sum + item.durationMs, 0) / 60) / 1000,
      nextJobId
    };
    await finishJob(db, job.id, output);
    await db.query(
      `
update sessions
set status = case when status in ('uploaded','processing') then 'processing' else status end,
    metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
    updated_at = now()
where id = $1::uuid;`,
      [job.session_id, JSON.stringify({ cloud_plan_audio_chunks: { source_job_id: job.id, completed_at: new Date().toISOString(), chunks: persisted.length, chunk_seconds: chunkSeconds } })]
    );
    return {
      ok: true,
      processed: true,
      dryRun: false,
      mode: 'cloud_plan_audio_chunks',
      jobId: job.id,
      sourceSessionId: job.source_session_id,
      summary: output,
      cost: { paidAiCostUsd: 0 }
    };
  } catch (error) {
    if (!dryRun) {
      await failJob(db, job.id, error, { workerStatus: 'chunk_plan_failed', paidAiCostUsd: 0 });
    }
    throw error;
  }
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        endpoint: '/api/jobs/run-cloud-plan-chunks',
        method: 'POST',
        mode: 'cloud_plan_audio_chunks',
        defaultChunkSeconds: DEFAULT_CHUNK_SECONDS,
        paidAiCostUsd: 0
      });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    const body = await readBody(req);
    return sendJson(res, 200, await runPlanChunks(body));
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};
