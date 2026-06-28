const crypto = require('crypto');
const { Readable } = require('node:stream');
const zlib = require('node:zlib');
const { Pool } = require('pg');
const { notifyDiscord } = require('../../lib/discord');
const { markJobStep } = require('../../lib/job-steps');

const ZIP_TAIL_BYTES = 128 * 1024;
const MAX_TRACKS_PER_RUN = 3;
const DEFAULT_TRACKS_PER_RUN = 1;
const SIGNED_URL_SECONDS = 1800;

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
      } catch (error) {
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

async function headObject(bucket, key) {
  const response = await fetch(createR2SignedUrl(key, 300, bucket, 'HEAD'), { method: 'HEAD' });
  if (!response.ok) throw httpError(502, `Falha ao consultar R2 HEAD (${response.status}).`);
  return Number(response.headers.get('content-length') || 0);
}

async function fetchObjectRangeResponse(bucket, key, start, end) {
  const response = await fetch(createR2SignedUrl(key, 300, bucket, 'GET'), {
    headers: { Range: `bytes=${start}-${end}` }
  });
  if (![200, 206].includes(response.status)) {
    throw httpError(502, `Falha ao ler range R2 ${start}-${end} (${response.status}).`);
  }
  return response;
}

async function fetchObjectRangeBuffer(bucket, key, start, end) {
  const response = await fetchObjectRangeResponse(bucket, key, start, end);
  return Buffer.from(await response.arrayBuffer());
}

async function putObjectStream(bucket, key, body, contentType, contentLength = null) {
  const headers = { 'Content-Type': contentType || 'application/octet-stream' };
  if (Number.isFinite(contentLength) && contentLength >= 0) headers['Content-Length'] = String(contentLength);
  const response = await fetch(createR2SignedUrl(key, SIGNED_URL_SECONDS, bucket, 'PUT'), {
    method: 'PUT',
    headers,
    body,
    duplex: 'half'
  });
  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw httpError(502, `Falha ao gravar R2 PUT (${response.status}): ${message.slice(0, 200)}`);
  }
}

function findEndOfCentralDirectory(tail) {
  for (let index = tail.length - 22; index >= 0; index -= 1) {
    if (tail.readUInt32LE(index) === 0x06054b50) return index;
  }
  throw httpError(400, 'ZIP Craig sem end of central directory reconhecivel.');
}

function decodeZipName(buffer, utf8) {
  return buffer.toString(utf8 ? 'utf8' : 'latin1');
}

async function readZipDirectory(bucket, key, sizeBytes) {
  const objectSize = sizeBytes || await headObject(bucket, key);
  if (!objectSize || objectSize < 22) throw httpError(400, 'ZIP Craig vazio ou tamanho desconhecido.');
  const tailSize = Math.min(objectSize, ZIP_TAIL_BYTES);
  const tailStart = objectSize - tailSize;
  const tail = await fetchObjectRangeBuffer(bucket, key, tailStart, objectSize - 1);
  const eocd = findEndOfCentralDirectory(tail);
  const totalEntries = tail.readUInt16LE(eocd + 10);
  const centralDirectorySize = tail.readUInt32LE(eocd + 12);
  const centralDirectoryOffset = tail.readUInt32LE(eocd + 16);
  if (totalEntries === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    throw httpError(400, 'ZIP64 ainda nao suportado no cloud extract runner.');
  }
  const centralDirectory = await fetchObjectRangeBuffer(
    bucket,
    key,
    centralDirectoryOffset,
    centralDirectoryOffset + centralDirectorySize - 1
  );
  const entries = [];
  let offset = 0;
  while (offset < centralDirectory.length) {
    if (centralDirectory.readUInt32LE(offset) !== 0x02014b50) {
      throw httpError(400, `Central directory ZIP invalido no offset ${offset}.`);
    }
    const flags = centralDirectory.readUInt16LE(offset + 8);
    const compressionMethod = centralDirectory.readUInt16LE(offset + 10);
    const crc32 = centralDirectory.readUInt32LE(offset + 16);
    const compressedSize = centralDirectory.readUInt32LE(offset + 20);
    const uncompressedSize = centralDirectory.readUInt32LE(offset + 24);
    const fileNameLength = centralDirectory.readUInt16LE(offset + 28);
    const extraLength = centralDirectory.readUInt16LE(offset + 30);
    const commentLength = centralDirectory.readUInt16LE(offset + 32);
    const localHeaderOffset = centralDirectory.readUInt32LE(offset + 42);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      throw httpError(400, 'ZIP64 entry ainda nao suportada no cloud extract runner.');
    }
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    const filename = decodeZipName(centralDirectory.subarray(nameStart, nameEnd), Boolean(flags & 0x0800));
    entries.push({
      filename,
      fileSize: uncompressedSize,
      compressedSize,
      compressionMethod,
      crc32,
      flags,
      localHeaderOffset,
      isDirectory: filename.endsWith('/'),
      isFlac: filename.toLowerCase().endsWith('.flac')
    });
    offset = nameEnd + extraLength + commentLength;
  }
  return { objectSize, totalEntries, entries };
}

async function dataStartForEntry(bucket, key, entry) {
  if (entry.flags & 0x0001) throw httpError(400, `ZIP entry criptografada nao suportada: ${entry.filename}`);
  const localHeader = await fetchObjectRangeBuffer(bucket, key, entry.localHeaderOffset, entry.localHeaderOffset + 30 - 1);
  if (localHeader.readUInt32LE(0) !== 0x04034b50) throw httpError(400, `Local header invalido: ${entry.filename}`);
  const fileNameLength = localHeader.readUInt16LE(26);
  const extraLength = localHeader.readUInt16LE(28);
  return entry.localHeaderOffset + 30 + fileNameLength + extraLength;
}

function baseName(filename) {
  return String(filename || '').replace(/\\/g, '/').split('/').filter(Boolean).pop() || '';
}

function trackKey(filename) {
  const stem = baseName(filename).replace(/\.[^.]+$/, '');
  return stem.replace(/^\d+-/, '');
}

function safePathSegment(value) {
  return cleanText(value, 200)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '') || 'unknown';
}

function targetTrackPath(job, track) {
  return [
    'campaigns',
    safePathSegment(job.campaign_slug || 'campaign'),
    'sessions',
    safePathSegment(job.source_session_id || job.session_id),
    'tracks',
    'craig',
    `${safePathSegment(track.trackKey)}.flac`
  ].join('/');
}

function normalizeMaxTracks(raw) {
  const value = Number(raw.maxTracks || raw.max_tracks || DEFAULT_TRACKS_PER_RUN);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_TRACKS_PER_RUN;
  return Math.max(1, Math.min(MAX_TRACKS_PER_RUN, Math.floor(value)));
}

async function selectJob(db, jobId) {
  const result = await db.query(
    `
select pj.*, s.source_session_id, s.title session_title, c.slug campaign_slug
from processing_jobs pj
join sessions s on s.id = pj.session_id
join campaigns c on c.id = s.campaign_id
where pj.job_type = 'cloud_extract_craig_tracks'
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
  where pj.job_type = 'cloud_extract_craig_tracks'
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
    [jobId || null, JSON.stringify({ workerStatus: 'running', worker: 'vercel_cloud_extract', paidAiCostUsd: 0 })]
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

async function requeueJob(db, jobId, output) {
  await db.query(
    `
update processing_jobs
set status = 'queued',
    output = coalesce(output, '{}'::jsonb) || $2::jsonb,
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

async function notifyJob(event) {
  try {
    return await notifyDiscord(event);
  } catch (error) {
    console.warn('discord_job_notify_failed', error.message || String(error));
    return { sent: false, error: error.message || String(error) };
  }
}

function errorDescription(error) {
  return cleanText(error.message || error, 1800);
}

async function existingTrackFiles(db, sessionId, bucket, paths) {
  if (!paths.length) return new Map();
  const result = await db.query(
    `
select id, storage_path
from recording_files
where session_id = $1::uuid
  and storage_bucket = $2
  and storage_path = any($3::text[]);`,
    [sessionId, bucket, paths]
  );
  return new Map(result.rows.map(row => [row.storage_path, row.id]));
}

function sourceRecordingFileId(job) {
  const input = job?.input || {};
  const value = cleanText(input.recordingFileId || input.recording_file_id, 80);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

async function existingExtractionSteps(db, sessionId, bucket, paths) {
  if (!paths.length) return new Map();
  const result = await db.query(
    `
select id, target_storage_path, status, attempts, error, recording_file_id,
       started_at, finished_at, updated_at
from craig_track_extraction_steps
where session_id = $1::uuid
  and target_storage_bucket = $2
  and target_storage_path = any($3::text[]);`,
    [sessionId, bucket, paths]
  );
  return new Map(result.rows.map(row => [row.target_storage_path, row]));
}

async function participantMap(db, sessionId, trackKeys) {
  if (!trackKeys.length) return new Map();
  const result = await db.query(
    `
select id, source_track_key
from participants
where session_id = $1::uuid
  and source_track_key = any($2::text[]);`,
    [sessionId, trackKeys]
  );
  return new Map(result.rows.map(row => [row.source_track_key, row.id]));
}

async function syncPlannedExtractionStep(db, job, track) {
  const recordingFileId = track.existingRecordingFileId || track.extractionStep?.recording_file_id || null;
  const status = recordingFileId ? 'succeeded' : 'pending';
  await db.query(
    `
insert into craig_track_extraction_steps (
  id, session_id, job_id, source_recording_file_id, recording_file_id,
  track_key, source_filename, source_storage_bucket, source_storage_path,
  target_storage_bucket, target_storage_path, status, attempts,
  size_bytes, compressed_size_bytes, duration_ms, compression_method, crc32,
  metadata, started_at, finished_at, created_at, updated_at
)
values (
  gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::uuid,
  $5, $6, $7, $8,
  $9, $10, $11, 0,
  $12::bigint, $13::bigint, $14::integer, $15::integer, $16::bigint,
  $17::jsonb,
  case when $11 = 'succeeded' then now() else null end,
  case when $11 = 'succeeded' then now() else null end,
  now(), now()
)
on conflict (session_id, target_storage_bucket, target_storage_path) do update set
  job_id = excluded.job_id,
  source_recording_file_id = coalesce(excluded.source_recording_file_id, craig_track_extraction_steps.source_recording_file_id),
  recording_file_id = coalesce(excluded.recording_file_id, craig_track_extraction_steps.recording_file_id),
  track_key = excluded.track_key,
  source_filename = excluded.source_filename,
  source_storage_bucket = excluded.source_storage_bucket,
  source_storage_path = excluded.source_storage_path,
  size_bytes = excluded.size_bytes,
  compressed_size_bytes = excluded.compressed_size_bytes,
  duration_ms = coalesce(excluded.duration_ms, craig_track_extraction_steps.duration_ms),
  compression_method = excluded.compression_method,
  crc32 = excluded.crc32,
  status = case
    when excluded.status = 'succeeded' then 'succeeded'
    when craig_track_extraction_steps.status in ('failed', 'running') then craig_track_extraction_steps.status
    else excluded.status
  end,
  error = case when excluded.status = 'succeeded' then null else craig_track_extraction_steps.error end,
  metadata = coalesce(craig_track_extraction_steps.metadata, '{}'::jsonb) || excluded.metadata,
  started_at = case
    when excluded.status = 'succeeded' then coalesce(craig_track_extraction_steps.started_at, now())
    else craig_track_extraction_steps.started_at
  end,
  finished_at = case
    when excluded.status = 'succeeded' then now()
    else craig_track_extraction_steps.finished_at
  end,
  updated_at = now();`,
    [
      job.session_id,
      job.id,
      sourceRecordingFileId(job),
      recordingFileId,
      track.trackKey,
      track.filename,
      track.sourceBucket,
      track.sourcePath,
      track.storageBucket,
      track.targetPath,
      status,
      track.fileSize,
      track.compressedSize,
      track.durationMs || null,
      track.compressionMethod,
      track.crc32,
      JSON.stringify({
        planned_from: 'cloud_extract_craig_tracks',
        source_job_id: job.id,
        source_recording_file_id: sourceRecordingFileId(job),
        planned_at: new Date().toISOString()
      })
    ]
  );
}

async function markExtractionStep(db, job, track, status, detail = {}) {
  const error = detail.error ? String(detail.error).slice(0, 4000) : null;
  const recordingFileId = detail.recordingFileId || track.existingRecordingFileId || null;
  await db.query(
    `
insert into craig_track_extraction_steps (
  id, session_id, job_id, source_recording_file_id, recording_file_id,
  track_key, source_filename, source_storage_bucket, source_storage_path,
  target_storage_bucket, target_storage_path, status, attempts,
  size_bytes, compressed_size_bytes, duration_ms, compression_method, crc32,
  error, metadata, started_at, finished_at, created_at, updated_at
)
values (
  gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::uuid,
  $5, $6, $7, $8,
  $9, $10, $11,
  case when $11 = 'running' then 1 else 0 end,
  $12::bigint, $13::bigint, $14::integer, $15::integer, $16::bigint,
  $17, $18::jsonb,
  case when $11 in ('running','succeeded','failed') then now() else null end,
  case when $11 in ('succeeded','failed','skipped') then now() else null end,
  now(), now()
)
on conflict (session_id, target_storage_bucket, target_storage_path) do update set
  job_id = excluded.job_id,
  source_recording_file_id = coalesce(excluded.source_recording_file_id, craig_track_extraction_steps.source_recording_file_id),
  recording_file_id = coalesce(excluded.recording_file_id, craig_track_extraction_steps.recording_file_id),
  track_key = excluded.track_key,
  source_filename = excluded.source_filename,
  source_storage_bucket = excluded.source_storage_bucket,
  source_storage_path = excluded.source_storage_path,
  status = excluded.status,
  attempts = case
    when excluded.status = 'running'
     and craig_track_extraction_steps.status <> 'running'
      then craig_track_extraction_steps.attempts + 1
    else craig_track_extraction_steps.attempts
  end,
  size_bytes = excluded.size_bytes,
  compressed_size_bytes = excluded.compressed_size_bytes,
  duration_ms = coalesce(excluded.duration_ms, craig_track_extraction_steps.duration_ms),
  compression_method = excluded.compression_method,
  crc32 = excluded.crc32,
  error = excluded.error,
  metadata = coalesce(craig_track_extraction_steps.metadata, '{}'::jsonb) || excluded.metadata,
  started_at = case
    when excluded.status in ('running','succeeded','failed') then coalesce(craig_track_extraction_steps.started_at, now())
    else craig_track_extraction_steps.started_at
  end,
  finished_at = case
    when excluded.status in ('succeeded','failed','skipped') then now()
    when excluded.status = 'running' then null
    else craig_track_extraction_steps.finished_at
  end,
  updated_at = now();`,
    [
      job.session_id,
      job.id,
      sourceRecordingFileId(job),
      recordingFileId,
      track.trackKey,
      track.filename,
      track.sourceBucket,
      track.sourcePath,
      track.storageBucket,
      track.targetPath,
      status,
      track.fileSize,
      track.compressedSize,
      track.durationMs || null,
      track.compressionMethod,
      track.crc32,
      error,
      JSON.stringify({
        marked_from: 'cloud_extract_craig_tracks',
        marked_at: new Date().toISOString(),
        ...detail.metadata
      })
    ]
  );
}

async function fetchExtractionSummary(db, job) {
  try {
    const result = await db.query(
      `
select row_to_json(summary) data
from craig_track_extraction_summary summary
where summary.job_id = $1::uuid
   or (
     summary.session_id = $2::uuid
     and summary.source_recording_file_id is not distinct from $3::uuid
   )
order by case when summary.job_id = $1::uuid then 0 else 1 end
limit 1;`,
      [job.id, job.session_id, sourceRecordingFileId(job)]
    );
    return result.rows[0]?.data || null;
  } catch (error) {
    console.warn('craig_track_extraction_summary_failed', error.message || String(error));
    return null;
  }
}

async function upsertTrackFile(db, job, track, participantId) {
  const result = await db.query(
    `
insert into recording_files (
  id, session_id, participant_id, file_type, storage_bucket, storage_path,
  original_filename, mime_type, size_bytes, duration_ms, source_system, source_file_role, metadata, created_at
)
values (
  gen_random_uuid(), $1::uuid, $2::uuid, 'craig_track', $3, $4,
  $5, 'audio/flac', $6::bigint, $7::integer, 'craig', $8, $9::jsonb, now()
)
on conflict (session_id, storage_bucket, storage_path)
do update set
  participant_id = coalesce(excluded.participant_id, recording_files.participant_id),
  file_type = 'craig_track',
  original_filename = excluded.original_filename,
  mime_type = excluded.mime_type,
  size_bytes = excluded.size_bytes,
  duration_ms = coalesce(excluded.duration_ms, recording_files.duration_ms),
  source_system = 'craig',
  source_file_role = excluded.source_file_role,
  metadata = coalesce(recording_files.metadata, '{}'::jsonb) || excluded.metadata
returning id;`,
    [
      job.session_id,
      participantId || null,
      track.storageBucket,
      track.targetPath,
      baseName(track.filename),
      track.fileSize,
      track.durationMs || null,
      `craig_track_${track.trackKey}`,
      JSON.stringify({
        imported_from: 'cloud_extract_craig_tracks',
        source_job_id: job.id,
        source_zip_bucket: track.sourceBucket,
        source_zip_path: track.sourcePath,
        source_zip_filename: track.filename,
        track_key: track.trackKey,
        compressed_size: track.compressedSize,
        compression_method: track.compressionMethod,
        duration_ms: track.durationMs || null,
        crc32: track.crc32,
        extracted_at: new Date().toISOString()
      })
    ]
  );
  return result.rows[0].id;
}

async function insertNextChunkJob(db, job, extractedFiles) {
  const result = await db.query(
    `
insert into processing_jobs (id, session_id, job_type, status, attempts, input, output, created_at)
select gen_random_uuid(), $1::uuid, 'cloud_plan_audio_chunks', 'queued', 0, $2::jsonb, $3::jsonb, now()
where not exists (
  select 1 from processing_jobs
  where session_id = $1::uuid
    and job_type = 'cloud_plan_audio_chunks'
    and input->>'sourceExtractJobId' = $4
    and status in ('queued','retrying','running','succeeded')
)
returning id;`,
    [
      job.session_id,
      JSON.stringify({
        sourceExtractJobId: job.id,
        sourceSessionId: job.source_session_id,
        trackFiles: extractedFiles.map(item => ({
          recordingFileId: item.recordingFileId,
          trackKey: item.trackKey,
          storageBucket: item.storageBucket,
          storagePath: item.storagePath,
          sizeBytes: item.sizeBytes
        }))
      }),
      JSON.stringify({
        workerStatus: 'pending_worker_implementation',
        nextAction: 'Planejar chunks por faixa e depois slices de fala antes da transcricao.',
        paidAiCostUsd: 0
      }),
      job.id
    ]
  );
  return result.rows[0]?.id || null;
}

async function extractEntryToR2(track) {
  const dataStart = await dataStartForEntry(track.sourceBucket, track.sourcePath, track.entry);
  const dataEnd = dataStart + track.compressedSize - 1;
  let body;
  let contentLength = null;
  if (track.compressedSize > 0) {
    const response = await fetchObjectRangeResponse(track.sourceBucket, track.sourcePath, dataStart, dataEnd);
    if (!response.body) throw httpError(502, `R2 sem stream para ${track.filename}.`);
    body = Readable.fromWeb(response.body);
  } else {
    body = Readable.from(Buffer.alloc(0));
  }

  if (track.compressionMethod === 0) {
    contentLength = track.compressedSize;
  } else if (track.compressionMethod === 8) {
    body = body.pipe(zlib.createInflateRaw());
    contentLength = track.fileSize;
  } else {
    throw httpError(400, `Metodo de compressao nao suportado em ${track.filename}: ${track.compressionMethod}`);
  }

  await putObjectStream(track.storageBucket, track.targetPath, body, 'audio/flac', contentLength);
}

async function buildPlan(db, job) {
  const input = job.input || {};
  const sourceBucket = cleanText(input.storageBucket || input.storage_bucket || r2Config().bucket, 200);
  const sourcePath = cleanText(input.storagePath || input.storage_path, 1200);
  const sizeBytes = Number(input.sizeBytes || input.size_bytes || 0) || null;
  if (!sourceBucket || !sourcePath) throw httpError(400, 'Job sem storageBucket/storagePath.');

  const directory = await readZipDirectory(sourceBucket, sourcePath, sizeBytes);
  const expected = Array.isArray(input.tracks) && input.tracks.length ? input.tracks : null;
  const expectedNames = expected ? new Set(expected.map(item => String(item.filename || '').replace(/\\/g, '/'))) : null;
  const expectedByName = expected
    ? new Map(expected.map(item => [String(item.filename || '').replace(/\\/g, '/'), item]))
    : new Map();
  const entries = directory.entries
    .filter(entry => entry.isFlac && !entry.isDirectory)
    .filter(entry => !expectedNames || expectedNames.has(entry.filename.replace(/\\/g, '/')))
    .sort((a, b) => a.filename.localeCompare(b.filename));
  const tracks = entries.map(entry => {
    const key = trackKey(entry.filename);
    const expectedTrack = expectedByName.get(entry.filename.replace(/\\/g, '/')) || {};
    const targetPath = targetTrackPath(job, { trackKey: key });
    return {
      entry,
      filename: entry.filename,
      trackKey: key,
      fileSize: entry.fileSize,
      compressedSize: entry.compressedSize,
      compressionMethod: entry.compressionMethod,
      durationMs: Number(expectedTrack.durationMs || 0) || null,
      crc32: entry.crc32,
      sourceBucket,
      sourcePath,
      storageBucket: r2Config().bucket || sourceBucket,
      targetPath
    };
  });

  const existing = await existingTrackFiles(db, job.session_id, r2Config().bucket || sourceBucket, tracks.map(item => item.targetPath));
  const extractionSteps = await existingExtractionSteps(db, job.session_id, r2Config().bucket || sourceBucket, tracks.map(item => item.targetPath));
  const participants = await participantMap(db, job.session_id, tracks.map(item => item.trackKey));
  return {
    objectSize: directory.objectSize,
    zipEntries: directory.entries.length,
    tracks: tracks.map(item => ({
      ...item,
      existingRecordingFileId: existing.get(item.targetPath) || null,
      extractionStep: extractionSteps.get(item.targetPath) || null,
      participantId: participants.get(item.trackKey) || null
    }))
  };
}

async function runCloudExtract(raw) {
  const dryRun = Boolean(raw.dryRun || raw.dry_run);
  const jobId = cleanText(raw.jobId || raw.job_id, 80) || null;
  const maxTracks = normalizeMaxTracks(raw);
  const db = getPool();
  const job = dryRun ? await selectJob(db, jobId) : await claimJob(db, jobId);
  if (!job) {
    return {
      ok: true,
      processed: false,
      mode: 'cloud_extract_craig_tracks',
      message: jobId ? `Job nao encontrado ou nao elegivel: ${jobId}` : 'Nenhum job cloud_extract_craig_tracks pendente.'
    };
  }

  try {
    if (!dryRun) {
      await markJobStep(db, job, 'running', {
        progress: { workerStatus: 'extract_running', paidAiCostUsd: 0, maxTracks }
      });
    }
    const plan = await buildPlan(db, job);
    if (!dryRun) {
      for (const track of plan.tracks) {
        await syncPlannedExtractionStep(db, job, track);
      }
    }
    const pending = plan.tracks.filter(item => !item.existingRecordingFileId);
    const selected = pending.slice(0, maxTracks);
    if (dryRun) {
      return {
        ok: true,
        processed: true,
        dryRun: true,
        mode: 'cloud_extract_craig_tracks',
        jobId: job.id,
        summary: {
          zipEntries: plan.zipEntries,
          tracks: plan.tracks.length,
          alreadyExtracted: plan.tracks.length - pending.length,
          pending: pending.length,
          selected: selected.length,
          maxTracks
        },
        selected: selected.map(item => ({
          trackKey: item.trackKey,
          filename: item.filename,
          sizeBytes: item.fileSize,
          targetPath: item.targetPath,
          status: item.extractionStep?.status || (item.existingRecordingFileId ? 'succeeded' : 'pending'),
          attempts: item.extractionStep?.attempts || 0,
          error: item.extractionStep?.error || null
        })),
        cost: { paidAiCostUsd: 0 }
      };
    }

    const extracted = [];
    for (const track of selected) {
      await markExtractionStep(db, job, track, 'running', {
        metadata: { selected_in_run: true }
      });
      let recordingFileId;
      try {
        await extractEntryToR2(track);
        recordingFileId = await upsertTrackFile(db, job, track, track.participantId);
        await markExtractionStep(db, job, track, 'succeeded', {
          recordingFileId,
          metadata: { target_written: true }
        });
      } catch (error) {
        await markExtractionStep(db, job, track, 'failed', {
          error: error.message || String(error),
          metadata: { target_written: false }
        });
        throw error;
      }
      extracted.push({
        recordingFileId,
        trackKey: track.trackKey,
        storageBucket: track.storageBucket,
        storagePath: track.targetPath,
        sizeBytes: track.fileSize,
        durationMs: track.durationMs || null
      });
    }

    const remaining = pending.length - extracted.length;
    const trackProgress = await fetchExtractionSummary(db, job);
    const progress = {
      workerStatus: remaining > 0 ? 'partially_extracted' : 'extract_succeeded',
      paidAiCostUsd: 0,
      extractedThisRun: extracted.length,
      alreadyExtractedBeforeRun: plan.tracks.length - pending.length,
      totalTracks: plan.tracks.length,
      remainingTracks: remaining,
      maxTracks,
      trackProgress,
      lastRunAt: new Date().toISOString()
    };

    if (remaining > 0) {
      await requeueJob(db, job.id, progress);
      await markJobStep(db, job, 'retrying', {
        progress,
        retryable: true
      });
      await notifyJob({
        target: 'recordings',
        title: 'Craig tracks parcialmente extraidas',
        status: 'partial',
        sourceSessionId: job.source_session_id,
        jobId: job.id,
        description: 'Extracao de faixas Craig em andamento; o job foi reenfileirado para continuar.',
        fields: [
          { name: 'extraidas agora', value: String(extracted.length), inline: true },
          { name: 'restantes', value: String(remaining), inline: true },
          { name: 'total', value: String(plan.tracks.length), inline: true }
        ]
      });
    } else {
      const allFiles = await existingTrackFiles(db, job.session_id, r2Config().bucket || (plan.tracks[0]?.sourceBucket || ''), plan.tracks.map(item => item.targetPath));
      const finalFiles = plan.tracks.map(item => ({
        recordingFileId: allFiles.get(item.targetPath) || extracted.find(file => file.storagePath === item.targetPath)?.recordingFileId || null,
        trackKey: item.trackKey,
        storageBucket: item.storageBucket,
        storagePath: item.targetPath,
        sizeBytes: item.fileSize,
        durationMs: item.durationMs || null
      })).filter(item => item.recordingFileId);
      const nextJobId = await insertNextChunkJob(db, job, finalFiles);
      await finishJob(db, job.id, {
        ...progress,
        nextJobId,
        extractedFiles: finalFiles.length
      });
      await markJobStep(db, job, 'succeeded', {
        retryable: false,
        progress: {
          ...progress,
          nextJobId,
          extractedFiles: finalFiles.length
        }
      });
      await db.query(
        `
update sessions
set status = case when status in ('uploaded','processing') then 'processing' else status end,
    metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
    updated_at = now()
where id = $1::uuid;`,
        [job.session_id, JSON.stringify({ cloud_extract_craig_tracks: { source_job_id: job.id, completed_at: new Date().toISOString(), tracks: finalFiles.length } })]
      );
      progress.nextJobId = nextJobId;
      progress.extractedFiles = finalFiles.length;
      await notifyJob({
        target: 'recordings',
        title: 'Craig tracks extraidas',
        status: 'ok',
        sourceSessionId: job.source_session_id,
        jobId: job.id,
        description: 'Faixas Craig extraidas para R2 e proximo job de chunks preparado.',
        fields: [
          { name: 'arquivos', value: String(finalFiles.length), inline: true },
          { name: 'proximo job', value: String(nextJobId || '-'), inline: false },
          { name: 'custo IA', value: '$0.0000', inline: true }
        ]
      });
    }

    return {
      ok: true,
      processed: true,
      dryRun: false,
      mode: 'cloud_extract_craig_tracks',
      jobId: job.id,
      sourceSessionId: job.source_session_id,
      extracted,
      summary: progress,
      cost: { paidAiCostUsd: 0 }
    };
  } catch (error) {
    if (!dryRun) {
      const trackProgress = await fetchExtractionSummary(db, job);
      await failJob(db, job.id, error, { workerStatus: 'extract_failed', paidAiCostUsd: 0, trackProgress });
      await markJobStep(db, job, 'failed', {
        error: error.message || String(error),
        progress: { workerStatus: 'extract_failed', paidAiCostUsd: 0, trackProgress }
      });
      await notifyJob({
        target: 'ops',
        title: 'Falha ao extrair Craig tracks',
        status: 'failed',
        sourceSessionId: job.source_session_id,
        jobId: job.id,
        description: errorDescription(error),
        fields: [
          { name: 'worker', value: 'cloud_extract_craig_tracks', inline: true },
          { name: 'custo IA', value: '$0.0000', inline: true }
        ]
      });
    }
    throw error;
  }
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        endpoint: '/api/jobs/run-cloud-extract',
        method: 'POST',
        mode: 'cloud_extract_craig_tracks',
        defaultTracksPerRun: DEFAULT_TRACKS_PER_RUN,
        maxTracksPerRun: MAX_TRACKS_PER_RUN,
        paidAiCostUsd: 0
      });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    const body = await readBody(req);
    return sendJson(res, 200, await runCloudExtract(body));
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};
