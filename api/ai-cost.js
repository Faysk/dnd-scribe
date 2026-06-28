const { Pool } = require('pg');
const {
  handleDiscordInteraction,
  verifyDiscordSignature
} = require('../lib/discord-interactions');
const { handlePipelineRecovery } = require('../lib/pipeline-recovery');

const DEFAULT_CAMPAIGN = 'yuhara-main';
const DEFAULT_SOURCE_SESSION = 'craig-AdabEqbzngmT-stage1-full';
const DEFAULT_MODEL = 'gpt-4o-mini-transcribe';
const DEFAULT_PROMPT_VERSION = 'transcribe_v1';

let pool;

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_POOLER_URL || process.env.SUPABASE_POOLER_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_POOLER_URL or DATABASE_URL is not configured');
  pool = new Pool({
    connectionString,
    max: 3,
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

function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body, 'utf8'));
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(Buffer.from(JSON.stringify(req.body), 'utf8'));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleDiscordEndpoint(req, res) {
  if (req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      app: 'dnd-scribe-discord-interactions',
      configured: Boolean(process.env.DISCORD_PUBLIC_KEY),
      routedVia: 'api/ai-cost',
      commands: ['/dnd status', '/dnd custos', '/dnd nota', '/dnd vincular', 'Salvar no DnD Scribe']
    });
  }
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed' });

  const rawBody = await readRawBody(req);
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  const verified = verifyDiscordSignature({ signature, timestamp, rawBody });
  if (!verified) return sendJson(res, 401, { ok: false, error: 'Invalid Discord signature' });

  const payload = JSON.parse(rawBody.toString('utf8') || '{}');
  const response = await handleDiscordInteraction(payload);
  return sendJson(res, 200, response);
}

async function data(sql, params = [], db = getPool()) {
  const result = await db.query(sql, params);
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return row.data ?? row.row_to_json ?? row.coalesce ?? Object.values(row)[0] ?? null;
}

function warnings(summary) {
  const items = [];
  if (Number(summary.missingHash || 0) > 0) {
    items.push({
      level: 'blocked',
      code: 'missing_hash',
      message: 'Ha work units sem sha256; transcricao paga deve ficar bloqueada.'
    });
  }
  if (Number(summary.chunkFallbacks || 0) > 0) {
    items.push({
      level: 'cost',
      code: 'chunk_fallback',
      message: 'Ainda existem chunks inteiros nao silenciosos; gerar speech slices deve reduzir minutos cobraveis.'
    });
  }
  if (Number(summary.transcribeCandidates || 0) > 0) {
    items.push({
      level: 'ready',
      code: 'transcription_candidates',
      message: 'Existem work units prontos para dry-run ou rodada pequena.'
    });
  }
  return items;
}

async function costPayload(campaign, sourceSessionId, model, promptVersion) {
  const params = [campaign, sourceSessionId, model, promptVersion];
  const summary = await data(
    `
with target as (
  select c.id campaign_id, c.slug campaign_slug, c.name campaign_name,
         s.id session_id, s.source_session_id, s.title session_title, s.status session_status
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = $1 and s.source_session_id = $2
), units as (
  select wu.*, tc.id cache_id
  from audio_transcription_work_units wu
  join target t on t.session_id = wu.session_id
  left join transcription_cache tc
    on tc.audio_sha256 = wu.sha256
   and tc.provider = 'openai'
   and tc.model = $3
   and tc.prompt_version = $4
   and tc.status = 'succeeded'
), chunk_stats as (
  select
    count(*)::int raw_chunks,
    count(*) filter (where coalesce(ac.probably_silent, false) is true)::int silent_chunks,
    round((coalesce(sum(ac.duration_ms), 0) / 60000.0)::numeric, 3) raw_audio_minutes,
    round((coalesce(sum(ac.duration_ms) filter (where coalesce(ac.probably_silent, false) is true), 0) / 60000.0)::numeric, 3) silent_audio_minutes
  from audio_chunks ac
  join target t on t.session_id = ac.session_id
)
select json_build_object(
  'campaignSlug', (select campaign_slug from target),
  'campaignName', (select campaign_name from target),
  'sourceSessionId', (select source_session_id from target),
  'sessionTitle', (select session_title from target),
  'sessionStatus', (select session_status from target),
  'workUnits', count(*)::int,
  'speechSlices', count(*) filter (where unit_type = 'speech_slice')::int,
  'chunkFallbacks', count(*) filter (where unit_type = 'chunk')::int,
  'missingHash', count(*) filter (where nullif(sha256, '') is null)::int,
  'probablySilent', count(*) filter (where probably_silent is true)::int,
  'cacheHits', count(*) filter (where cache_id is not null)::int,
  'transcribeCandidates', count(*) filter (
    where nullif(sha256, '') is not null
      and coalesce(probably_silent, false) is false
      and cache_id is null
  )::int,
  'rawChunks', coalesce((select raw_chunks from chunk_stats), 0),
  'silentChunks', coalesce((select silent_chunks from chunk_stats), 0),
  'rawAudioMinutes', coalesce((select raw_audio_minutes from chunk_stats), 0),
  'silentAudioMinutes', coalesce((select silent_audio_minutes from chunk_stats), 0),
  'totalAudioMinutes', round((coalesce(sum(duration_ms), 0) / 60000.0)::numeric, 3),
  'speechAudioMinutes', round((coalesce(sum(duration_ms) filter (where unit_type = 'speech_slice'), 0) / 60000.0)::numeric, 3),
  'fallbackAudioMinutes', round((coalesce(sum(duration_ms) filter (where unit_type = 'chunk'), 0) / 60000.0)::numeric, 3),
  'billableAudioMinutes', round((coalesce(sum(
    case
      when nullif(sha256, '') is not null
       and coalesce(probably_silent, false) is false
       and cache_id is null
      then duration_ms else 0 end
  ), 0) / 60000.0)::numeric, 3)
) data
from units;`,
    params
  );
  if (!summary?.sourceSessionId) return null;

  const byType = await data(
    `
with target as (
  select s.id session_id
  from sessions s join campaigns c on c.id = s.campaign_id
  where c.slug = $1 and s.source_session_id = $2
), units as (
  select wu.*, tc.id cache_id
  from audio_transcription_work_units wu
  join target t on t.session_id = wu.session_id
  left join transcription_cache tc
    on tc.audio_sha256 = wu.sha256
   and tc.provider = 'openai'
   and tc.model = $3
   and tc.prompt_version = $4
   and tc.status = 'succeeded'
)
select coalesce(json_agg(row_to_json(row) order by row.unit_type), '[]'::json) data from (
  select
    unit_type,
    count(*)::int units,
    count(*) filter (where nullif(sha256, '') is null)::int missing_hash,
    count(*) filter (where cache_id is not null)::int cache_hits,
    count(*) filter (where nullif(sha256, '') is not null and coalesce(probably_silent, false) is false and cache_id is null)::int candidates,
    round((coalesce(sum(duration_ms), 0) / 60000.0)::numeric, 3) audio_minutes
  from units
  group by unit_type
) row;`,
    params
  ) || [];

  const ledger = await data(
    `
with target as (
  select s.id session_id
  from sessions s join campaigns c on c.id = s.campaign_id
  where c.slug = $1 and s.source_session_id = $2
), ledger_rows as (
  select l.*
  from ai_usage_ledger l
  join target t on t.session_id = l.session_id
)
select json_build_object(
  'entries', count(*)::int,
  'estimatedCostUsd', coalesce(sum(estimated_cost_usd), 0)::numeric(12, 6),
  'actualCostUsd', coalesce(sum(actual_cost_usd), 0)::numeric(12, 6),
  'audioMinutes', coalesce(sum(input_audio_minutes), 0)::numeric(12, 3),
  'byStatus', coalesce((
    select json_agg(row_to_json(row) order by row.status, row.model)
    from (
      select status, model, operation_type, count(*)::int entries,
             coalesce(sum(input_audio_minutes), 0)::numeric(12, 3) audio_minutes,
             coalesce(sum(estimated_cost_usd), 0)::numeric(12, 6) estimated_cost_usd,
             coalesce(sum(actual_cost_usd), 0)::numeric(12, 6) actual_cost_usd
      from ledger_rows
      group by status, model, operation_type
    ) row
  ), '[]'::json)
) data
from ledger_rows;`,
    [campaign, sourceSessionId]
  ) || { entries: 0, estimatedCostUsd: 0, actualCostUsd: 0, audioMinutes: 0, byStatus: [] };

  return {
    ok: true,
    model,
    promptVersion,
    generatedAt: new Date().toISOString(),
    summary,
    byType,
    ledger,
    warnings: warnings(summary)
  };
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  if (url.searchParams.get('discordInteractions') === '1' || url.pathname === '/api/discord/interactions') {
    try {
      return await handleDiscordEndpoint(req, res);
    } catch (error) {
      return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
    }
  }
  if (url.searchParams.get('pipelineRecover') === '1') {
    return handlePipelineRecovery(req, res);
  }
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const campaign = url.searchParams.get('campaignSlug') || DEFAULT_CAMPAIGN;
    const sourceSessionId = url.searchParams.get('sourceSessionId') || DEFAULT_SOURCE_SESSION;
    const model = url.searchParams.get('model') || DEFAULT_MODEL;
    const promptVersion = url.searchParams.get('promptVersion') || DEFAULT_PROMPT_VERSION;
    const payload = await costPayload(campaign, sourceSessionId, model, promptVersion);
    if (!payload) return sendJson(res, 404, { ok: false, error: `Sessao nao encontrada: ${sourceSessionId}` });
    return sendJson(res, 200, payload);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};