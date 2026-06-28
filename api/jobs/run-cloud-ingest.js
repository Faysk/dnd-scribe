const crypto = require('crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { Pool } = require('pg');
const { notifyDiscord } = require('../../lib/discord');
const { markJobStep } = require('../../lib/job-steps');

const DEFAULT_CAMPAIGN = 'yuhara-main';
const MAX_INFO_ENTRY_BYTES = 1024 * 1024;
const ZIP_TAIL_BYTES = 128 * 1024;
const FLAC_HEADER_BYTES = 64 * 1024;
const FLAC_PROBE_BYTES = 256 * 1024;
const SESSION_TIME_ZONE = process.env.DND_SESSION_TIME_ZONE || 'Europe/London';

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

async function fetchObjectRange(bucket, key, start, end) {
  const response = await fetch(createR2SignedUrl(key, 300, bucket, 'GET'), {
    headers: { Range: `bytes=${start}-${end}` }
  });
  if (![200, 206].includes(response.status)) {
    throw httpError(502, `Falha ao ler range R2 ${start}-${end} (${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
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
  const tail = await fetchObjectRange(bucket, key, tailStart, objectSize - 1);
  const eocd = findEndOfCentralDirectory(tail);
  const totalEntries = tail.readUInt16LE(eocd + 10);
  const centralDirectorySize = tail.readUInt32LE(eocd + 12);
  const centralDirectoryOffset = tail.readUInt32LE(eocd + 16);
  if (totalEntries === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    throw httpError(400, 'ZIP64 ainda nao suportado no manifest-only runner.');
  }
  const centralDirectory = await fetchObjectRange(
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
      throw httpError(400, 'ZIP64 entry ainda nao suportada no manifest-only runner.');
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

async function readZipEntry(bucket, key, entry) {
  if (entry.flags & 0x0001) throw httpError(400, `ZIP entry criptografada nao suportada: ${entry.filename}`);
  if (entry.compressedSize > MAX_INFO_ENTRY_BYTES) throw httpError(400, `ZIP entry grande demais para manifest-only: ${entry.filename}`);
  const dataStart = await dataStartForEntry(bucket, key, entry);
  const compressed = entry.compressedSize
    ? await fetchObjectRange(bucket, key, dataStart, dataStart + entry.compressedSize - 1)
    : Buffer.alloc(0);
  if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod === 8) return zlib.inflateRawSync(compressed);
  throw httpError(400, `Metodo de compressao nao suportado em ${entry.filename}: ${entry.compressionMethod}`);
}

async function dataStartForEntry(bucket, key, entry) {
  if (entry.flags & 0x0001) throw httpError(400, `ZIP entry criptografada nao suportada: ${entry.filename}`);
  const localHeader = await fetchObjectRange(bucket, key, entry.localHeaderOffset, entry.localHeaderOffset + 30 - 1);
  if (localHeader.readUInt32LE(0) !== 0x04034b50) throw httpError(400, `Local header invalido: ${entry.filename}`);
  const fileNameLength = localHeader.readUInt16LE(26);
  const extraLength = localHeader.readUInt16LE(28);
  return entry.localHeaderOffset + 30 + fileNameLength + extraLength;
}

function parseFlacDurationMs(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 42) return null;
  const marker = buffer.indexOf(Buffer.from('fLaC'));
  if (marker < 0) return null;
  let offset = marker + 4;
  while (offset + 4 <= buffer.length) {
    const header = buffer[offset];
    const blockType = header & 0x7f;
    const blockLength = buffer.readUIntBE(offset + 1, 3);
    const dataOffset = offset + 4;
    if (dataOffset + blockLength > buffer.length) return null;
    if (blockType === 0 && blockLength >= 34) {
      const streamInfo = buffer.subarray(dataOffset, dataOffset + blockLength);
      const packed = streamInfo.readBigUInt64BE(10);
      const sampleRate = Number((packed >> 44n) & 0xfffffn);
      const totalSamples = Number(packed & 0xfffffffffn);
      if (!sampleRate || !totalSamples) return null;
      return Math.round((totalSamples / sampleRate) * 1000);
    }
    if (header & 0x80) break;
    offset = dataOffset + blockLength;
  }
  return null;
}

async function readFlacDurationMs(bucket, key, entry) {
  try {
    const dataStart = await dataStartForEntry(bucket, key, entry);
    const readSize = entry.compressionMethod === 0
      ? Math.min(entry.fileSize, FLAC_HEADER_BYTES)
      : Math.min(entry.compressedSize, FLAC_PROBE_BYTES);
    if (!readSize) return null;
    const probe = await fetchObjectRange(bucket, key, dataStart, dataStart + readSize - 1);
    const header = entry.compressionMethod === 0
      ? probe
      : zlib.inflateRawSync(probe, { finishFlush: zlib.constants.Z_SYNC_FLUSH }).subarray(0, FLAC_HEADER_BYTES);
    return parseFlacDurationMs(header);
  } catch (_error) {
    return null;
  }
}

function baseName(filename) {
  return String(filename || '').replace(/\\/g, '/').split('/').filter(Boolean).pop() || '';
}

function trackKey(filename) {
  const stem = baseName(filename).replace(/\.[^.]+$/, '');
  return stem.replace(/^\d+-/, '');
}

function parseCraigInfo(text) {
  const result = { tracks: [] };
  let inTracks = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('Recording ')) {
      result.recording_id = line.replace(/^Recording\s+/, '').trim();
      continue;
    }
    if (line.startsWith('Guild:')) {
      result.guild = line.split(':').slice(1).join(':').trim();
      continue;
    }
    if (line.startsWith('Channel:')) {
      result.channel = line.split(':').slice(1).join(':').trim();
      continue;
    }
    if (line.startsWith('Requester:')) {
      result.requester = line.split(':').slice(1).join(':').trim();
      continue;
    }
    if (line.startsWith('Start time:')) {
      result.start_time = line.split(':').slice(1).join(':').trim();
      continue;
    }
    if (line === 'Tracks:') {
      inTracks = true;
      continue;
    }
    if (inTracks) {
      const match = line.match(/^(.*?)\s+\((\d+)\)$/);
      if (match) {
        const handle = match[1];
        result.tracks.push({ handle, track_key: handle.split('#', 1)[0], discord_id: match[2] });
      }
    }
  }
  return result;
}

function loadCraigMap() {
  const mapPath = path.join(process.cwd(), 'config', 'craig_user_map.json');
  return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
}

function buildParticipants(trackEntries, info, mappingData) {
  const mapping = mappingData.tracks || {};
  const infoTracks = Object.fromEntries((info.tracks || []).map(item => [item.track_key, item]));
  return trackEntries.map(entry => {
    const key = entry.trackKey || trackKey(entry.filename);
    const mapped = mapping[key] || {};
    const infoTrack = infoTracks[key] || {};
    const status = mapped.status || 'guest_or_unknown';
    return {
      track_key: key,
      source_file: baseName(entry.filename),
      zip_filename: entry.filename,
      discord_handle: infoTrack.handle || null,
      discord_id: infoTrack.discord_id || null,
      person_name: mapped.person_name || key,
      default_character: mapped.default_character || 'Convidado / indefinido',
      role: mapped.role || 'guest',
      status,
      character_aliases: mapped.character_aliases || [],
      needs_review: status !== 'known',
      file_size: entry.fileSize,
      compressed_size: entry.compressedSize,
      duration_ms: entry.durationMs || null,
      crc32: entry.crc32
    };
  });
}

function dateInTimeZone(value, timeZone = SESSION_TIME_ZONE) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function buildSessionWindow(manifest) {
  const startedAt = manifest.craig?.start_time || '';
  const durations = (manifest.tracks || [])
    .map(track => Number(track.durationMs || 0))
    .filter(duration => Number.isFinite(duration) && duration > 0);
  const durationMs = durations.length ? Math.max(...durations) : 0;
  const endedAt = startedAt && durationMs
    ? new Date(new Date(startedAt).getTime() + durationMs).toISOString()
    : '';
  const logicalDate = startedAt ? dateInTimeZone(startedAt) : '';
  const endDate = endedAt ? dateInTimeZone(endedAt) : '';
  return {
    time_zone: SESSION_TIME_ZONE,
    started_at: startedAt || null,
    ended_at: endedAt || null,
    logical_date: logicalDate || null,
    duration_ms: durationMs || null,
    duration_source: durations.length === (manifest.tracks || []).length ? 'flac_streaminfo_all_tracks' : (durations.length ? 'flac_streaminfo_partial_tracks' : 'pending_track_duration'),
    duration_tracks: durations.length,
    total_tracks: (manifest.tracks || []).length,
    crosses_midnight: Boolean(logicalDate && endDate && logicalDate !== endDate)
  };
}

async function selectJob(db, jobId) {
  const result = await db.query(
    `
select pj.*, s.source_session_id, s.title session_title, c.slug campaign_slug
from processing_jobs pj
join sessions s on s.id = pj.session_id
join campaigns c on c.id = s.campaign_id
where pj.job_type = 'cloud_ingest_craig'
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
  where pj.job_type = 'cloud_ingest_craig'
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
    [jobId || null, JSON.stringify({ workerStatus: 'running', worker: 'vercel_manifest_only', paidAiCostUsd: 0 })]
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

async function upsertParticipant(db, sessionId, participant) {
  const result = await db.query(
    `
insert into participants (
  id, session_id, player_name, character_name, role, audio_track_label, source_track_key,
  discord_handle, discord_id, participant_status, character_aliases, needs_review, metadata, created_at
)
values (
  gen_random_uuid(), $1::uuid, $2, $3, $4, $5, $6,
  $7, $8, $9, $10::text[], $11::boolean, $12::jsonb, now()
)
on conflict (session_id, source_track_key)
where source_track_key is not null
do update set
  player_name = excluded.player_name,
  character_name = excluded.character_name,
  role = excluded.role,
  audio_track_label = excluded.audio_track_label,
  discord_handle = excluded.discord_handle,
  discord_id = excluded.discord_id,
  participant_status = excluded.participant_status,
  character_aliases = excluded.character_aliases,
  needs_review = excluded.needs_review,
  metadata = coalesce(participants.metadata, '{}'::jsonb) || excluded.metadata
returning id;`,
    [
      sessionId,
      participant.person_name,
      participant.default_character,
      participant.role,
      participant.source_file,
      participant.track_key,
      participant.discord_handle,
      participant.discord_id,
      participant.status,
      participant.character_aliases,
      participant.needs_review,
      JSON.stringify({
        imported_from: 'cloud_manifest_only',
        zip_filename: participant.zip_filename,
        file_size: participant.file_size,
        compressed_size: participant.compressed_size,
        crc32: participant.crc32
      })
    ]
  );
  return result.rows[0].id;
}

async function persistManifest(db, job, manifest, dryRun) {
  const participants = manifest.participants || [];
  const sessionWindow = buildSessionWindow(manifest);
  if (dryRun) {
    return {
      dryRun: true,
      participants: participants.length,
      tracks: manifest.tracks.length,
      zipEntries: manifest.zipEntries.length,
      sessionWindow
    };
  }

  const participantIds = [];
  for (const participant of participants) {
    participantIds.push(await upsertParticipant(db, job.session_id, participant));
  }

  const manifestMetadata = {
    cloud_manifest_only: {
      parsed_at: new Date().toISOString(),
      worker: 'vercel_manifest_only',
      source_job_id: job.id,
      source_recording_file_id: manifest.recordingFileId,
      source_zip_path: manifest.storagePath,
      craig: manifest.craig,
      zip: {
        object_size: manifest.objectSize,
        entries: manifest.zipEntries.length,
        tracks: manifest.tracks.length,
        info_file: manifest.infoFilename || null
      },
      session_window: sessionWindow,
      participants: participants.map(item => ({
        track_key: item.track_key,
        person_name: item.person_name,
        default_character: item.default_character,
        role: item.role,
        status: item.status,
        needs_review: item.needs_review,
        source_file: item.source_file,
        discord_id: item.discord_id,
        duration_ms: item.duration_ms || null
      }))
    }
  };

  await db.query(
    `
update recording_files
set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
    source_system = coalesce(source_system, 'craig'),
    source_file_role = coalesce(source_file_role, 'craig_zip_upload')
where id = $1::uuid;`,
    [manifest.recordingFileId, JSON.stringify(manifestMetadata)]
  );

  await db.query(
    `
update sessions
set status = case when status in ('planned','recording') then 'uploaded' else status end,
    metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
    started_at = coalesce(started_at, nullif($3, '')::timestamptz),
    session_date = coalesce(session_date, nullif($4, '')::date),
    duration_ms = case when $5::integer > 0 then greatest(coalesce(duration_ms, 0), $5::integer) else duration_ms end,
    ended_at = coalesce(ended_at, nullif($6, '')::timestamptz),
    updated_at = now()
where id = $1::uuid;`,
    [
      job.session_id,
      JSON.stringify(manifestMetadata),
      sessionWindow.started_at || '',
      sessionWindow.logical_date || '',
      sessionWindow.duration_ms || 0,
      sessionWindow.ended_at || ''
    ]
  );

  const validationErrors = new Set();
  if (!manifest.tracks.length) validationErrors.add('manifest_without_flac_tracks');
  if (!sessionWindow.started_at) validationErrors.add('missing_start_time');
  if (!sessionWindow.logical_date) validationErrors.add('missing_logical_date');
  if (sessionWindow.duration_source === 'pending_track_duration') validationErrors.add('duration_pending');
  if (!sessionWindow.duration_ms || !sessionWindow.duration_source) validationErrors.add('duration_pending');
  if (!participants.length) validationErrors.add('missing_participants');
  const validationErrorList = [...validationErrors];
  const manifestStatus = validationErrors.has('manifest_without_flac_tracks')
    ? 'invalid'
    : validationErrorList.length
      ? 'warning'
      : 'valid';

  await db.query(
    `
insert into craig_manifests (
  id, session_id, source_recording_file_id, created_by_job_id, schema_version, status,
  recording_id, guild_name, channel_name, requester,
  started_at, ended_at, logical_date, time_zone, duration_ms, duration_source, crosses_midnight,
  zip_object_size, zip_entries, tracks_count, participants_count, info_filename,
  manifest_json, validation_errors, created_at, updated_at
)
values (
  gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::integer, $5,
  $6, $7, $8, $9,
  nullif($10, '')::timestamptz, nullif($11, '')::timestamptz, nullif($12, '')::date, $13, $14::integer, $15, $16::boolean,
  $17::bigint, $18::integer, $19::integer, $20::integer, $21,
  $22::jsonb, $23::jsonb, now(), now()
)
on conflict (session_id, source_recording_file_id) do update set
  created_by_job_id = excluded.created_by_job_id,
  schema_version = excluded.schema_version,
  status = excluded.status,
  recording_id = excluded.recording_id,
  guild_name = excluded.guild_name,
  channel_name = excluded.channel_name,
  requester = excluded.requester,
  started_at = excluded.started_at,
  ended_at = excluded.ended_at,
  logical_date = excluded.logical_date,
  time_zone = excluded.time_zone,
  duration_ms = excluded.duration_ms,
  duration_source = excluded.duration_source,
  crosses_midnight = excluded.crosses_midnight,
  zip_object_size = excluded.zip_object_size,
  zip_entries = excluded.zip_entries,
  tracks_count = excluded.tracks_count,
  participants_count = excluded.participants_count,
  info_filename = excluded.info_filename,
  manifest_json = excluded.manifest_json,
  validation_errors = excluded.validation_errors,
  updated_at = now();`,
    [
      job.session_id,
      manifest.recordingFileId,
      job.id,
      manifest.schemaVersion || 1,
      manifestStatus,
      manifest.craig?.recording_id || null,
      manifest.craig?.guild || null,
      manifest.craig?.channel || null,
      manifest.craig?.requester || null,
      sessionWindow.started_at || '',
      sessionWindow.ended_at || '',
      sessionWindow.logical_date || '',
      sessionWindow.time_zone || SESSION_TIME_ZONE,
      sessionWindow.duration_ms || 0,
      sessionWindow.duration_source || '',
      Boolean(sessionWindow.crosses_midnight),
      manifest.objectSize || 0,
      manifest.zipEntries.length,
      manifest.tracks.length,
      participants.length,
      manifest.infoFilename || null,
      JSON.stringify(manifestMetadata.cloud_manifest_only),
      JSON.stringify(validationErrorList)
    ]
  );

  const nextJob = await db.query(
    `
insert into processing_jobs (id, session_id, job_type, status, attempts, input, output, created_at)
select gen_random_uuid(), $1::uuid, 'cloud_extract_craig_tracks', 'queued', 0, $2::jsonb, $3::jsonb, now()
where not exists (
  select 1 from processing_jobs
  where session_id = $1::uuid
    and job_type = 'cloud_extract_craig_tracks'
    and input->>'recordingFileId' = $4
    and status in ('queued','retrying','running','succeeded')
)
returning id;`,
    [
      job.session_id,
      JSON.stringify({
        recordingFileId: manifest.recordingFileId,
        storageBucket: manifest.storageBucket,
        storagePath: manifest.storagePath,
        tracks: manifest.tracks.map(item => ({ filename: item.filename, sizeBytes: item.fileSize, durationMs: item.durationMs || null }))
      }),
      JSON.stringify({
        workerStatus: 'ready_to_run',
        nextAction: 'Executar cloud_extract_craig_tracks para extrair FLACs do ZIP para objetos R2 individuais.',
        paidAiCostUsd: 0
      }),
      manifest.recordingFileId
    ]
  );

  return {
    dryRun: false,
    participants: participantIds.length,
    tracks: manifest.tracks.length,
    zipEntries: manifest.zipEntries.length,
    sessionWindow,
    nextJobId: nextJob.rows[0]?.id || null
  };
}

async function buildManifest(job) {
  const input = job.input || {};
  const recordingFileId = cleanText(input.recordingFileId || input.recording_file_id, 80);
  const storageBucket = cleanText(input.storageBucket || input.storage_bucket || r2Config().bucket, 200);
  const storagePath = cleanText(input.storagePath || input.storage_path, 1200);
  const sizeBytes = Number(input.sizeBytes || 0) || null;
  if (!recordingFileId) throw httpError(400, 'Job sem recordingFileId.');
  if (!storageBucket || !storagePath) throw httpError(400, 'Job sem storageBucket/storagePath.');

  const directory = await readZipDirectory(storageBucket, storagePath, sizeBytes);
  const infoEntry = directory.entries.find(entry => baseName(entry.filename).toLowerCase() === 'info.txt') || null;
  const infoText = infoEntry ? (await readZipEntry(storageBucket, storagePath, infoEntry)).toString('utf8') : '';
  const craig = parseCraigInfo(infoText);
  const mappingData = loadCraigMap();
  const tracks = directory.entries
    .filter(entry => entry.isFlac && !entry.isDirectory)
    .sort((a, b) => a.filename.localeCompare(b.filename));
  const trackDetails = await Promise.all(tracks.map(async entry => ({
    ...entry,
    trackKey: trackKey(entry.filename),
    durationMs: await readFlacDurationMs(storageBucket, storagePath, entry)
  })));
  const participants = buildParticipants(trackDetails, craig, mappingData);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    campaignSlug: job.campaign_slug || DEFAULT_CAMPAIGN,
    sourceSessionId: job.source_session_id,
    recordingFileId,
    storageBucket,
    storagePath,
    objectSize: directory.objectSize,
    infoFilename: infoEntry?.filename || null,
    craig,
    zipEntries: directory.entries.map(entry => ({
      filename: entry.filename,
      fileSize: entry.fileSize,
      compressedSize: entry.compressedSize,
      compressionMethod: entry.compressionMethod,
      isFlac: entry.isFlac,
      isDirectory: entry.isDirectory
    })),
    tracks: trackDetails.map(entry => ({
      filename: entry.filename,
      fileSize: entry.fileSize,
      compressedSize: entry.compressedSize,
      crc32: entry.crc32,
      trackKey: entry.trackKey,
      durationMs: entry.durationMs || null
    })),
    participants,
    rules: mappingData.rules || {}
  };
}

async function runCloudIngest(raw) {
  const dryRun = Boolean(raw.dryRun || raw.dry_run);
  const jobId = cleanText(raw.jobId || raw.job_id, 80) || null;
  const db = getPool();
  const job = dryRun ? await selectJob(db, jobId) : await claimJob(db, jobId);
  if (!job) {
    return {
      ok: true,
      processed: false,
      mode: 'cloud_manifest_only',
      message: jobId ? `Job nao encontrado ou nao elegivel: ${jobId}` : 'Nenhum job cloud_ingest_craig pendente.'
    };
  }

  try {
    if (!dryRun) {
      await markJobStep(db, job, 'running', {
        progress: { workerStatus: 'manifest_running', paidAiCostUsd: 0 }
      });
    }
    const manifest = await buildManifest(job);
    const persisted = await persistManifest(db, job, manifest, dryRun);
    if (!dryRun) {
      await finishJob(db, job.id, {
        workerStatus: 'manifest_succeeded',
        paidAiCostUsd: 0,
        manifest: {
        tracks: manifest.tracks.length,
        participants: manifest.participants.length,
        zipEntries: manifest.zipEntries.length,
        infoFilename: manifest.infoFilename,
        sessionWindow: persisted.sessionWindow,
        nextJobId: persisted.nextJobId
      }
      });
      await markJobStep(db, job, 'succeeded', {
        retryable: false,
        progress: {
          workerStatus: 'manifest_succeeded',
          paidAiCostUsd: 0,
          tracks: manifest.tracks.length,
          participants: manifest.participants.length,
          zipEntries: manifest.zipEntries.length,
          nextJobId: persisted.nextJobId || null
        }
      });
      await notifyJob({
        target: 'recordings',
        title: 'Craig manifest processado',
        status: 'ok',
        sourceSessionId: job.source_session_id,
        jobId: job.id,
        description: 'ZIP Craig lido, participantes/faixas registrados e proximo job de extracao preparado.',
        fields: [
          { name: 'faixas', value: String(manifest.tracks.length), inline: true },
          { name: 'participantes', value: String(manifest.participants.length), inline: true },
          { name: 'entradas ZIP', value: String(manifest.zipEntries.length), inline: true },
          { name: 'proximo job', value: String(persisted.nextJobId || '-'), inline: false }
        ]
      });
    }
    return {
      ok: true,
      processed: true,
      dryRun,
      mode: 'cloud_manifest_only',
      jobId: job.id,
      sourceSessionId: job.source_session_id,
      summary: persisted,
      manifest: {
        craig: manifest.craig,
        tracks: manifest.tracks,
        participants: manifest.participants,
        infoFilename: manifest.infoFilename,
        zipEntries: manifest.zipEntries.length,
        sessionWindow: persisted.sessionWindow
      },
      cost: { paidAiCostUsd: 0 }
    };
  } catch (error) {
    if (!dryRun) {
      await failJob(db, job.id, error, { workerStatus: 'manifest_failed', paidAiCostUsd: 0 });
      await markJobStep(db, job, 'failed', {
        error: error.message || String(error),
        progress: { workerStatus: 'manifest_failed', paidAiCostUsd: 0 }
      });
      await notifyJob({
        target: 'ops',
        title: 'Falha no Craig manifest',
        status: 'failed',
        sourceSessionId: job.source_session_id,
        jobId: job.id,
        description: errorDescription(error),
        fields: [
          { name: 'worker', value: 'cloud_ingest_craig', inline: true },
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
        endpoint: '/api/jobs/run-cloud-ingest',
        method: 'POST',
        mode: 'cloud_manifest_only',
        paidAiCostUsd: 0
      });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    const body = await readBody(req);
    return sendJson(res, 200, await runCloudIngest(body));
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};
