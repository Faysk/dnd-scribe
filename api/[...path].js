const crypto = require('crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const {
  parseRoll20ChatText,
  normalizeRoll20Events,
  summarizeRoll20Events
} = require('../lib/roll20-commands');

const DEFAULT_CAMPAIGN = 'yuhara-main';
const DEFAULT_SOURCE_SESSION = 'craig-AdabEqbzngmT-stage1-full';
const DEFAULT_RUN = 'classify_candidates_v2_gpt-4o';
const DEFAULT_ACTOR = 'renanyuhara';
const CRAIG_UPLOAD_MAX_BYTES = 2 * 1024 * 1024 * 1024;
const CRAIG_UPLOAD_EXPIRES_SECONDS = 900;

const SESSION_STATUSES = new Set([
  'planned',
  'recording',
  'uploaded',
  'processing',
  'ready_for_review',
  'reviewing',
  'approved',
  'published',
  'archived',
  'failed'
]);

const SEGMENT_STATUSES = new Set([
  'pending',
  'needs_review',
  'approved',
  'canon_candidate',
  'quote_candidate',
  'outtake',
  'private_note',
  'rejected'
]);

const CANDIDATE_STATUS = {
  canon_candidates: {
    candidate: 'candidate',
    approved: 'approved_canon',
    approved_canon: 'approved_canon',
    rejected: 'rejected',
    private: 'private',
    interpretation: 'interpretation',
    possible_hook: 'possible_hook',
    retcon_pending: 'retcon_pending'
  },
  quote_candidates: {
    candidate: 'candidate',
    approved: 'approved',
    rejected: 'rejected',
    private: 'private'
  },
  outtake_candidates: {
    candidate: 'candidate',
    approved: 'approved_by_speaker',
    approved_by_speaker: 'approved_by_speaker',
    approved_by_all: 'approved_by_all',
    rejected: 'rejected',
    private: 'private'
  }
};

let pool;

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_POOLER_URL || process.env.SUPABASE_POOLER_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_POOLER_URL or DATABASE_URL is not configured');
  }
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

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    return Promise.resolve(req.body ? JSON.parse(req.body) : {});
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

async function data(sql, params = [], db = getPool()) {
  const result = await db.query(sql, params);
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return row.data ?? row.row_to_json ?? row.coalesce ?? Object.values(row)[0] ?? null;
}

function cleanText(value, max = 500) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : '';
}

function slugify(value) {
  return cleanText(value, 120)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'sessao';
}

function normalizeDate(value) {
  const text = cleanText(value, 20);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw httpError(400, 'sessionDate precisa estar em YYYY-MM-DD.');
  return text;
}

function normalizeStatus(value, fallback = 'planned') {
  const status = cleanText(value || fallback, 40);
  if (!SESSION_STATUSES.has(status)) throw httpError(400, `status invalido: ${status}`);
  return status;
}

function generatedSourceSessionId(title, sessionDate) {
  const date = sessionDate || new Date().toISOString().slice(0, 10);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').toLowerCase();
  return `manual-${date}-${slugify(title)}-${stamp.slice(9, 15)}`;
}

function authPublicConfig() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      || process.env.SUPABASE_PUBLISHABLE_KEY
      || process.env.SUPABASE_ANON_KEY
      || ''
  };
}

function bearerToken(req) {
  const value = req.headers.authorization || req.headers.Authorization || '';
  if (!String(value).toLowerCase().startsWith('bearer ')) return '';
  return String(value).slice(7).trim();
}

function authName(user) {
  return user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.user_metadata?.global_name
    || user?.user_metadata?.preferred_username
    || user?.user_metadata?.user_name
    || user?.user_metadata?.username
    || user?.email
    || 'Usuario autenticado';
}

function authAvatar(user) {
  return user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
}

function authProvider(user) {
  return user?.app_metadata?.provider
    || user?.identities?.[0]?.provider
    || 'oauth';
}

function discordIdentity(user) {
  const identity = (user?.identities || []).find(item => item.provider === 'discord');
  const data = identity?.identity_data || {};
  const metadata = user?.user_metadata || {};
  const discordId = data.provider_id || data.sub || metadata.provider_id || metadata.sub || '';
  const handle = data.user_name
    || data.preferred_username
    || data.username
    || metadata.user_name
    || metadata.preferred_username
    || metadata.username
    || '';
  if (!discordId && !handle) return null;
  return { id: String(discordId || '').trim(), handle: String(handle || '').trim() };
}

function capabilitiesForRole(role) {
  const isDm = role === 'owner' || role === 'master';
  return {
    openTestMode: false,
    canReadCampaign: Boolean(role),
    canReviewOwnMaterial: Boolean(role),
    canReviewTableMaterial: ['owner', 'master', 'reviewer'].includes(role),
    canApproveCanon: isDm,
    canManageCampaign: isDm
  };
}

async function supabaseUserFromRequest(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const config = authPublicConfig();
  if (!config.supabaseUrl || !config.publishableKey) {
    const error = new Error('Supabase auth config publica ausente.');
    error.statusCode = 500;
    throw error;
  }
  const baseUrl = config.supabaseUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${token}`
    }
  });
  if (response.status === 401 || response.status === 403) {
    const error = new Error('Sessao invalida ou expirada.');
    error.statusCode = 401;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`Falha ao validar sessao Google (${response.status}).`);
    error.statusCode = 502;
    throw error;
  }
  return response.json();
}

async function syncAuthProfile(db, user) {
  if (!user?.id) return;
  const discord = discordIdentity(user);
  if (discord?.id) {
    await db.query(
      `
update profiles
set auth_user_id = coalesce(auth_user_id, $1::uuid),
    email = coalesce($2, email),
    avatar_url = coalesce($3, avatar_url),
    discord_handle = coalesce(nullif($5, ''), discord_handle),
    last_sign_in_at = now()
where discord_id = $4
  and (auth_user_id is null or auth_user_id = $1::uuid);`,
      [user.id, user.email || null, authAvatar(user), discord.id, discord.handle || null]
    );
  }
  await db.query(
    `
update profiles
set email = coalesce($2, email),
    avatar_url = coalesce($3, avatar_url),
    discord_id = case
      when $4::text is null or $4::text = '' then discord_id
      when discord_id is not null then discord_id
      when exists (
        select 1 from profiles other
        where other.discord_id = $4::text
          and other.auth_user_id is distinct from $1::uuid
      ) then discord_id
      else $4::text
    end,
    discord_handle = coalesce(nullif($5, ''), discord_handle),
    last_sign_in_at = now()
where auth_user_id = $1::uuid;`,
    [user.id, user.email || null, authAvatar(user), discord?.id || null, discord?.handle || null]
  );
}

async function linkedProfileForUser(db, userId, campaignSlug) {
  return await data(
    `
with selected_profile as (
  select p.id, p.display_name, p.roll20_name, p.default_character_name, p.avatar_url, p.last_sign_in_at
  from profiles p
  where p.auth_user_id = $1::uuid
  limit 1
),
memberships as (
  select c.slug campaign_slug, c.name campaign_name, cm.role
  from selected_profile p
  join campaign_members cm on cm.profile_id = p.id
  join campaigns c on c.id = cm.campaign_id
)
select json_build_object(
  'profile', (
    select json_build_object(
      'id', id,
      'displayName', display_name,
      'roll20Name', roll20_name,
      'defaultCharacterName', default_character_name,
      'avatarUrl', avatar_url,
      'lastSignInAt', last_sign_in_at
    )
    from selected_profile
  ),
  'memberships', coalesce((
    select json_agg(json_build_object(
      'campaignSlug', campaign_slug,
      'campaignName', campaign_name,
      'role', role
    ) order by campaign_slug)
    from memberships
  ), '[]'::json),
  'campaignRole', (
    select role from memberships where campaign_slug = $2 limit 1
  )
) data;`,
    [userId, campaignSlug],
    db
  ) || { profile: null, memberships: [], campaignRole: null };
}

async function authMePayload(req, campaignSlug) {
  const user = await supabaseUserFromRequest(req);
  if (!user) {
    return {
      ok: true,
      mode: 'auth_required',
      authenticated: false,
      user: null,
      profile: null,
      memberships: [],
      campaignRole: null,
      capabilities: capabilitiesForRole(null),
      note: 'Login Discord ou Google obrigatorio para acessar dados da mesa.'
    };
  }
  const db = getPool();
  await syncAuthProfile(db, user);
  const linked = await linkedProfileForUser(db, user.id, campaignSlug);
  return {
    ok: true,
    mode: 'auth_required',
    authenticated: true,
    user: {
      id: user.id,
      displayName: authName(user),
      avatarUrl: authAvatar(user),
      provider: authProvider(user),
      discord: discordIdentity(user)
    },
    profile: linked.profile,
    memberships: linked.memberships || [],
    campaignRole: linked.campaignRole || null,
    capabilities: capabilitiesForRole(linked.campaignRole || null),
    note: linked.campaignRole
      ? 'Perfil autenticado e aprovado na campanha.'
      : 'Perfil autenticado; vinculo com a campanha ainda depende de aprovacao do DM.'
  };
}

async function requireCampaignAccess(req, campaignSlug, allowedRoles = null) {
  const payload = await authMePayload(req, campaignSlug);
  if (!payload.authenticated) throw httpError(401, 'Login Discord ou Google obrigatorio.');
  const role = payload.campaignRole || null;
  if (!role) throw httpError(403, 'Perfil da mesa ainda nao aprovado pelo DM.');
  if (allowedRoles && !allowedRoles.includes(role)) {
    throw httpError(403, 'Sem permissao para esta acao.');
  }
  return payload;
}

async function roll20IngestPreviewPayload(req, campaign, raw) {
  const access = await requireCampaignAccess(req, campaign, ['owner', 'master']);
  const prefix = cleanText(raw.prefix || process.env.ROLL20_COMMAND_PREFIX || '!dnd', 20) || '!dnd';
  const source = cleanText(raw.source || 'copy-paste', 80) || 'copy-paste';
  const sourceSessionId = cleanText(raw.sourceSessionId || raw.source_session_id, 180) || null;
  const text = String(raw.text || raw.chatText || raw.chat_text || '').slice(0, 1024 * 1024);

  if (!text.trim()) throw httpError(400, 'text obrigatorio com chat copiado/exportado do Roll20.');

  const parsed = parseRoll20ChatText(text, { prefix });
  const events = normalizeRoll20Events(parsed, {
    campaignSlug: campaign,
    receivedAt: raw.receivedAt || raw.received_at || undefined
  });

  return {
    ok: true,
    mode: 'dry_run_only',
    dryRun: true,
    campaignSlug: campaign,
    sourceSessionId,
    source,
    prefix,
    actor: {
      profileId: access.profile?.id || null,
      displayName: access.profile?.displayName || access.user?.displayName || null,
      role: access.campaignRole || null
    },
    summary: summarizeRoll20Events(events),
    events
  };
}

function roll20SourceEventId(event) {
  const raw = [event.lineNo || 'na', event.rawLine || event.rawCommand || '', event.command || ''].join('|');
  const hash = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
  return `roll20-line-${event.lineNo || 'na'}-${hash}`;
}

function roll20EventText(event) {
  return cleanText(
    event.text
      || event.args?.motivo
      || event.args?.titulo
      || event.args?.descricao
      || event.positional?.join(' ')
      || event.rawCommand,
    3000
  ) || null;
}

async function persistRoll20Events(db, campaign, payload, raw) {
  const sourceSessionId = cleanText(payload.sourceSessionId || raw.sourceSessionId || raw.source_session_id, 180);
  if (!sourceSessionId) throw httpError(400, 'sourceSessionId obrigatorio para persistir eventos Roll20.');

  const session = await data(
    `
select row_to_json(s) data
from sessions s
join campaigns c on c.id = s.campaign_id
where c.slug = $1 and s.source_session_id = $2
limit 1;`,
    [campaign, sourceSessionId],
    db
  );
  if (!session) throw httpError(404, `Sessao nao encontrada para Roll20: ${sourceSessionId}`);

  const includeInvalid = Boolean(raw.includeInvalid || raw.include_invalid);
  const persistable = payload.events.filter(event => includeInvalid || event.status !== 'invalid');
  const skippedInvalid = payload.events.length - persistable.length;
  const importedAt = new Date().toISOString();
  const rows = [];

  for (const event of persistable) {
    const sourceEventId = cleanText(event.sourceEventId || event.source_event_id || roll20SourceEventId(event), 180);
    const eventPayload = {
      ...event,
      import: {
        source: payload.source,
        sourceSessionId,
        importedAt,
        dryRun: false,
        actor: payload.actor
      }
    };
    const result = await db.query(
      `
insert into roll20_events (
  id, session_id, event_type, roll20_who, character_name, approx_start_ms,
  text, payload, raw_line, source_system, source_event_id, created_at_roll20, created_at
)
values (
  gen_random_uuid(), $1::uuid, $2, $3, $4, null,
  $5, $6::jsonb, $7, 'roll20', $8, $9::timestamptz, now()
)
on conflict (session_id, source_system, source_event_id)
where source_system is not null and source_event_id is not null
do update set
  event_type = excluded.event_type,
  roll20_who = excluded.roll20_who,
  character_name = excluded.character_name,
  text = excluded.text,
  payload = excluded.payload,
  raw_line = excluded.raw_line,
  created_at_roll20 = excluded.created_at_roll20
returning id, source_event_id, event_type, roll20_who, character_name, text;`,
      [
        session.id,
        event.eventType || 'raw_roll20_note',
        event.speaker || null,
        event.targetCharacter || null,
        roll20EventText(event),
        JSON.stringify(eventPayload),
        event.rawLine || null,
        sourceEventId,
        raw.receivedAt || raw.received_at || null
      ]
    );
    rows.push(result.rows[0]);
  }

  await db.query(
    `
insert into processing_jobs (id, session_id, job_type, status, attempts, input, output, created_at, started_at, finished_at)
values (gen_random_uuid(), $1::uuid, 'roll20_chat_import', 'succeeded', 1, $2::jsonb, $3::jsonb, now(), now(), now());`,
    [
      session.id,
      JSON.stringify({
        source: payload.source,
        sourceSessionId,
        prefix: payload.prefix,
        actor: payload.actor,
        totalEvents: payload.events.length,
        includeInvalid
      }),
      JSON.stringify({
        persisted: rows.length,
        skippedInvalid,
        dryRun: false,
        paidAiCostUsd: 0
      })
    ]
  );

  return {
    session: sessionResponse(session),
    persisted: rows.length,
    skippedInvalid,
    eventIds: rows.map(row => ({
      id: row.id,
      sourceEventId: row.source_event_id,
      eventType: row.event_type,
      speaker: row.roll20_who,
      characterName: row.character_name,
      text: row.text
    }))
  };
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
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
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest)
  ].join('\n');
  const signature = hmac(r2SigningKey(config.secretKey, dateStamp), stringToSign, 'hex');
  return `${endpoint.protocol}//${endpoint.host}${canonicalUri}?${query}&X-Amz-Signature=${signature}`;
}

async function audioUrlPayload(campaign, sourceSessionId, trackKey, expiresRaw) {
  const normalizedTrackKey = String(trackKey || '').trim();
  if (!normalizedTrackKey) throw httpError(400, 'trackKey obrigatorio.');
  const expiresSeconds = Math.max(60, Math.min(3600, Number(expiresRaw || 900)));
  const sourceFileRole = normalizedTrackKey.startsWith('craig_track_')
    ? normalizedTrackKey
    : `craig_track_${normalizedTrackKey}`;
  const file = await data(
    `
with target as (
  select s.id session_id
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = $1 and s.source_session_id = $2
)
select row_to_json(file_row) data from (
  select rf.id, rf.source_file_role, rf.storage_bucket, rf.storage_path, rf.original_filename,
         rf.mime_type, rf.size_bytes, rf.duration_ms
  from recording_files rf
  join target t on t.session_id = rf.session_id
  where rf.source_file_role = $3
    and rf.file_type = 'craig_track'
    and rf.storage_path is not null
  limit 1
) file_row;`,
    [campaign, sourceSessionId, sourceFileRole]
  );
  if (!file) throw httpError(404, `Audio nao encontrado para trackKey ${normalizedTrackKey}.`);
  return {
    ok: true,
    trackKey: normalizedTrackKey.replace(/^craig_track_/, ''),
    sourceFileRole: file.source_file_role,
    expiresSeconds,
    file: {
      originalFilename: file.original_filename,
      mimeType: file.mime_type || 'audio/flac',
      sizeBytes: file.size_bytes,
      durationMs: file.duration_ms
    },
    url: createR2SignedUrl(file.storage_path, expiresSeconds, file.storage_bucket)
  };
}

function safeUploadFilename(value) {
  const fallback = 'craig-session.zip';
  const raw = cleanText(value || fallback, 240).replace(/[\\/]+/g, '-');
  const safe = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._ -]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 180);
  return safe || fallback;
}

function normalizeUploadSize(value) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) throw httpError(400, 'sizeBytes obrigatorio para upload Craig.');
  if (size > CRAIG_UPLOAD_MAX_BYTES) {
    throw httpError(400, `ZIP Craig muito grande para esta etapa (${Math.round(size / 1024 / 1024)} MiB).`);
  }
  return Math.round(size);
}

function normalizeUploadOptions(raw) {
  const chunkSeconds = Math.max(60, Math.min(1800, Number(raw.chunkSeconds || raw.chunk_seconds || 600)));
  const sampleRaw = raw.sampleSeconds || raw.sample_seconds || '';
  const sampleSeconds = sampleRaw === '' || sampleRaw === null || sampleRaw === undefined
    ? null
    : Math.max(0, Math.min(24 * 60 * 60, Number(sampleRaw || 0)));
  return {
    chunkSeconds,
    sampleSeconds,
    skipChunks: Boolean(raw.skipChunks || raw.skip_chunks)
  };
}

function jobResponse(row) {
  return {
    id: row.id,
    type: row.job_type,
    status: row.status,
    attempts: row.attempts,
    input: row.input || null,
    output: row.output || null,
    error: row.error || null,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    session: row.source_session_id ? {
      sourceSessionId: row.source_session_id,
      title: row.session_title || null,
      status: row.session_status || null
    } : null
  };
}

async function listJobs(campaign, sourceSessionId = '') {
  const params = [campaign];
  const sourceFilter = sourceSessionId ? 'and s.source_session_id = $2' : '';
  if (sourceSessionId) params.push(sourceSessionId);
  const result = await getPool().query(
    `
select pj.id, pj.job_type, pj.status, pj.attempts, pj.input, pj.output, pj.error,
       pj.started_at, pj.finished_at, pj.created_at,
       s.source_session_id, s.title session_title, s.status session_status
from processing_jobs pj
left join sessions s on s.id = pj.session_id
left join campaigns c on c.id = s.campaign_id
where c.slug = $1 ${sourceFilter}
order by pj.created_at desc
limit 50;`,
    params
  );
  return result.rows.map(jobResponse);
}

function loadCraigMapConfig() {
  const mapPath = path.join(process.cwd(), 'config', 'craig_user_map.json');
  try {
    return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  } catch (error) {
    throw httpError(500, `Mapa Craig nao encontrado no deploy: ${error.message}`);
  }
}

async function ensureCraigUploadSession(db, campaign, raw) {
  const sourceSessionId = cleanText(raw.sourceSessionId || raw.source_session_id, 180);
  if (sourceSessionId) {
    const existing = await data(
      `
select row_to_json(s) data
from sessions s
join campaigns c on c.id = s.campaign_id
where c.slug = $1 and s.source_session_id = $2
limit 1;`,
      [campaign, sourceSessionId],
      db
    );
    if (!existing) throw httpError(404, `Sessao nao encontrada para upload Craig: ${sourceSessionId}`);
    return sessionResponse(existing);
  }

  const fileName = safeUploadFilename(raw.fileName || raw.file_name || 'craig-session.zip');
  const inferredTitle = cleanText(raw.title, 180) || fileName.replace(/(\.flac)?\.zip$/i, '');
  const sessionDate = normalizeDate(raw.sessionDate || raw.session_date);
  const generatedSourceId = generatedSourceSessionId(inferredTitle, sessionDate);
  const slug = slugify(`${sessionDate || 'sem-data'}-${inferredTitle}`);
  const result = await db.query(
    `
with campaign_row as (
  select id from campaigns where slug = $1
), inserted as (
  insert into sessions (
    id, campaign_id, title, slug, session_date, arc, status, summary_short,
    source_system, source_session_id, metadata, created_at, updated_at
  )
  select gen_random_uuid(), campaign_row.id, $2, $3, $4::date, $5, 'uploaded', $6,
         'craig', $7, $8::jsonb, now(), now()
  from campaign_row
  returning *
)
select * from inserted;`,
    [
      campaign,
      inferredTitle,
      slug,
      sessionDate,
      cleanText(raw.arc, 120) || null,
      cleanText(raw.summary || raw.summaryShort || raw.summary_short, 2000) || null,
      generatedSourceId,
      JSON.stringify({ created_by: 'api/vercel', created_from: 'craig_direct_upload', auth_required: true })
    ]
  );
  if (!result.rows.length) throw httpError(404, `Campanha nao encontrada: ${campaign}`);
  return sessionResponse(result.rows[0]);
}

async function createCraigUpload(db, campaign, raw) {
  const fileName = safeUploadFilename(raw.fileName || raw.file_name);
  const sizeBytes = normalizeUploadSize(raw.sizeBytes || raw.size_bytes);
  const contentType = cleanText(raw.contentType || raw.content_type || 'application/zip', 120) || 'application/zip';
  const options = normalizeUploadOptions(raw);
  const session = await ensureCraigUploadSession(db, campaign, raw);
  const random = crypto.randomBytes(6).toString('hex');
  const objectKey = [
    'campaigns',
    campaign,
    'sessions',
    session.sourceSessionId,
    'uploads',
    'craig',
    `${Date.now()}-${random}-${fileName}`
  ].join('/');
  const bucket = r2Config().bucket;
  if (!bucket) throw httpError(500, 'R2_BUCKET ausente no ambiente.');

  const recordingResult = await db.query(
    `
insert into recording_files (
  id, session_id, file_type, storage_bucket, storage_path, original_filename,
  mime_type, size_bytes, source_system, source_file_role, metadata, created_at
)
values (
  gen_random_uuid(), $1::uuid, 'other', $2, $3, $4,
  $5, $6::bigint, 'craig', 'craig_zip_upload', $7::jsonb, now()
)
returning *;`,
    [
      session.id,
      bucket,
      objectKey,
      fileName,
      contentType,
      sizeBytes,
      JSON.stringify({
        upload_state: 'awaiting_direct_upload',
        upload_strategy: 'r2_presigned_put',
        upload_expires_seconds: CRAIG_UPLOAD_EXPIRES_SECONDS,
        processing_options: options
      })
    ]
  );
  const recordingFile = recordingResult.rows[0];
  const jobResult = await db.query(
    `
insert into processing_jobs (id, session_id, job_type, status, attempts, input, output, created_at)
values (gen_random_uuid(), $1::uuid, 'craig_direct_upload', 'queued', 0, $2::jsonb, $3::jsonb, now())
returning *;`,
    [
      session.id,
      JSON.stringify({
        recordingFileId: recordingFile.id,
        storageBucket: bucket,
        storagePath: objectKey,
        originalFilename: fileName,
        sizeBytes,
        contentType,
        processingOptions: options
      }),
      JSON.stringify({
        uploadStatus: 'awaiting_direct_upload',
        nextAction: 'PUT file to signedUrl, then call /api/uploads/craig-complete',
        paidAiCostUsd: 0
      })
    ]
  );

  return {
    ok: true,
    mode: 'prod_direct_r2_upload',
    session,
    upload: {
      recordingFileId: recordingFile.id,
      storageBucket: bucket,
      storagePath: objectKey,
      originalFilename: fileName,
      sizeBytes,
      contentType,
      expiresSeconds: CRAIG_UPLOAD_EXPIRES_SECONDS,
      signedUrl: createR2SignedUrl(objectKey, CRAIG_UPLOAD_EXPIRES_SECONDS, bucket, 'PUT')
    },
    job: jobResponse(jobResult.rows[0]),
    cost: {
      paidAiCostUsd: 0,
      note: 'Esta etapa so grava o ZIP no R2 e cria jobs. Transcricao paga exige aprovacao separada.'
    }
  };
}

async function completeCraigUpload(db, campaign, raw) {
  const jobId = cleanText(raw.jobId || raw.job_id, 80);
  const recordingFileId = cleanText(raw.recordingFileId || raw.recording_file_id, 80);
  const sourceSessionId = cleanText(raw.sourceSessionId || raw.source_session_id, 180);
  if (!jobId || !recordingFileId || !sourceSessionId) {
    throw httpError(400, 'jobId, recordingFileId e sourceSessionId sao obrigatorios.');
  }

  const context = await data(
    `
select row_to_json(context_row) data
from (
  select c.id campaign_id, s.id session_id, s.source_session_id, s.title session_title,
         rf.storage_bucket, rf.storage_path, rf.original_filename, rf.size_bytes, rf.mime_type
  from campaigns c
  join sessions s on s.campaign_id = c.id
  join recording_files rf on rf.session_id = s.id
  where c.slug = $1
    and s.source_session_id = $2
    and rf.id = $3::uuid
  limit 1
) context_row;`,
    [campaign, sourceSessionId, recordingFileId],
    db
  );
  if (!context) throw httpError(404, 'Upload Craig nao encontrado para confirmar.');

  await db.query(
    `
update recording_files
set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
where id = $1::uuid;`,
    [
      recordingFileId,
      JSON.stringify({
        upload_state: 'uploaded',
        uploaded_at: new Date().toISOString(),
        confirmed_by: 'api/vercel',
        confirmed_size_bytes: raw.sizeBytes || context.size_bytes || null
      })
    ]
  );
  await db.query(
    `
update processing_jobs
set status = 'succeeded',
    output = coalesce(output, '{}'::jsonb) || $3::jsonb,
    finished_at = now()
where id = $1::uuid and session_id = $2::uuid;`,
    [
      jobId,
      context.session_id,
      JSON.stringify({
        uploadStatus: 'uploaded',
        completedAt: new Date().toISOString(),
        paidAiCostUsd: 0
      })
    ]
  );
  const ingestJobResult = await db.query(
    `
insert into processing_jobs (id, session_id, job_type, status, attempts, input, output, created_at)
values (gen_random_uuid(), $1::uuid, 'cloud_ingest_craig', 'queued', 0, $2::jsonb, $3::jsonb, now())
returning *;`,
    [
      context.session_id,
      JSON.stringify({
        recordingFileId,
        storageBucket: context.storage_bucket,
        storagePath: context.storage_path,
        originalFilename: context.original_filename,
        contentType: context.mime_type,
        source: 'r2_direct_upload'
      }),
      JSON.stringify({
        workerStatus: 'pending_worker_implementation',
        nextAction: 'Implementar executor cloud para extrair ZIP, gerar chunks/slices e atualizar Supabase.',
        paidAiCostUsd: 0
      })
    ]
  );
  await db.query(
    `
update sessions
set status = 'uploaded',
    metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
    updated_at = now()
where id = $1::uuid;`,
    [
      context.session_id,
      JSON.stringify({
        last_craig_upload: {
          recordingFileId,
          storageBucket: context.storage_bucket,
          storagePath: context.storage_path,
          confirmedAt: new Date().toISOString()
        }
      })
    ]
  );

  return {
    ok: true,
    mode: 'prod_upload_confirmed',
    upload: {
      recordingFileId,
      storageBucket: context.storage_bucket,
      storagePath: context.storage_path,
      originalFilename: context.original_filename
    },
    job: jobResponse(ingestJobResult.rows[0]),
    cost: {
      paidAiCostUsd: 0,
      note: 'Upload confirmado. O job cloud_ingest_craig ainda nao executa IA paga.'
    }
  };
}

function sessionResponse(row) {
  return {
    id: row.id,
    title: row.title,
    sourceSessionId: row.source_session_id,
    sourceSystem: row.source_system,
    sessionDate: row.session_date,
    startedAt: row.started_at,
    arc: row.arc,
    status: row.status,
    durationMs: row.duration_ms,
    summary: row.summary_short,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function createSession(db, campaign, raw) {
  const title = cleanText(raw.title, 180);
  if (!title) throw httpError(400, 'title obrigatorio.');
  const sessionDate = normalizeDate(raw.sessionDate || raw.session_date);
  const status = normalizeStatus(raw.status, 'planned');
  const arc = cleanText(raw.arc, 120) || null;
  const summary = cleanText(raw.summary || raw.summaryShort || raw.summary_short, 2000) || null;
  const requestedSourceId = cleanText(raw.sourceSessionId || raw.source_session_id, 180);
  const sourceSessionId = requestedSourceId ? slugify(requestedSourceId) : generatedSourceSessionId(title, sessionDate);
  const slug = slugify(`${sessionDate || 'sem-data'}-${title}`);
  const metadata = {
    created_by: 'api/vercel',
    created_from: 'session_manager',
    auth_required: true
  };
  const result = await db.query(
    `
with campaign_row as (
  select id from campaigns where slug = $1
), inserted as (
  insert into sessions (
    id, campaign_id, title, slug, session_date, arc, status, summary_short,
    source_system, source_session_id, metadata, created_at, updated_at
  )
  select gen_random_uuid(), campaign_row.id, $2, $3, $4::date, $5, $6, $7,
         'manual', $8, $9::jsonb, now(), now()
  from campaign_row
  returning *
)
select * from inserted;`,
    [campaign, title, slug, sessionDate, arc, status, summary, sourceSessionId, JSON.stringify(metadata)]
  );
  if (!result.rows.length) throw httpError(404, `Campanha nao encontrada: ${campaign}`);
  return sessionResponse(result.rows[0]);
}

async function updateSession(db, campaign, sourceSessionId, raw) {
  const sourceId = cleanText(sourceSessionId || raw.sourceSessionId || raw.source_session_id, 180);
  if (!sourceId) throw httpError(400, 'sourceSessionId obrigatorio.');
  const title = cleanText(raw.title, 180);
  if (!title) throw httpError(400, 'title obrigatorio.');
  const sessionDate = normalizeDate(raw.sessionDate || raw.session_date);
  const status = normalizeStatus(raw.status, 'planned');
  const arc = cleanText(raw.arc, 120) || null;
  const summary = cleanText(raw.summary || raw.summaryShort || raw.summary_short, 2000) || null;
  const metadataPatch = {
    updated_by: 'api/vercel',
    updated_from: 'session_manager',
    auth_required: true
  };
  const result = await db.query(
    `
update sessions s
set title = $3,
    session_date = $4::date,
    arc = $5,
    status = $6,
    summary_short = $7,
    metadata = coalesce(s.metadata, '{}'::jsonb) || $8::jsonb,
    updated_at = now()
from campaigns c
where c.id = s.campaign_id
  and c.slug = $1
  and s.source_session_id = $2
returning s.*;`,
    [campaign, sourceId, title, sessionDate, arc, status, summary, JSON.stringify(metadataPatch)]
  );
  if (!result.rows.length) throw httpError(404, `Sessao nao encontrada: ${sourceId}`);
  return sessionResponse(result.rows[0]);
}

function targetCte() {
  return `
with target as (
  select c.id campaign_id, c.slug campaign_slug, c.name campaign_name,
         s.id session_id, s.title session_title, s.source_session_id,
         s.session_date, s.arc, s.status, s.duration_ms, s.summary_short, s.started_at
  from sessions s join campaigns c on c.id = s.campaign_id
  where c.slug = $1 and s.source_session_id = $2
)`;
}

async function listSessions(campaign, runId) {
  return await data(
    `
select coalesce(json_agg(item order by item->>'sessionDate' desc nulls last, item->>'sourceSessionId'), '[]'::json) data from (
  select json_build_object(
    'id', s.id,
    'title', s.title,
    'sourceSessionId', s.source_session_id,
    'sourceSystem', s.source_system,
    'sessionDate', s.session_date,
    'startedAt', s.started_at,
    'arc', s.arc,
    'status', s.status,
    'durationMs', s.duration_ms,
    'summary', s.summary_short,
    'createdAt', s.created_at,
    'updatedAt', s.updated_at,
    'segments', (select count(*) from transcript_segments ts where ts.session_id = s.id and ts.is_empty = false),
    'participants', (select count(*) from participants p where p.session_id = s.id),
    'recordingFiles', (select count(*) from recording_files rf where rf.session_id = s.id),
    'roll20Events', (select count(*) from roll20_events re where re.session_id = s.id),
    'aiCandidates', (
      (select count(*) from canon_candidates cc where cc.session_id = s.id and cc.source_run_id = $2) +
      (select count(*) from quote_candidates qc where qc.session_id = s.id and qc.source_run_id = $2) +
      (select count(*) from outtake_candidates oc where oc.session_id = s.id and oc.source_run_id = $2)
    ),
    'reviewDecisions', (select count(*) from review_decisions rd where rd.session_id = s.id and rd.source_run_id = $2),
    'publications', (select count(*) from publications p where p.session_id = s.id and p.source_run_id = $2),
    'approvedPublications', (
      select count(*) from publications p
      where p.session_id = s.id and p.source_run_id = $2 and p.visibility <> 'review_only'
    )
  ) item
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = $1
) rows;
`,
    [campaign, runId]
  ) || [];
}

async function responseSummary(campaign, sourceSessionId, runId, db = getPool()) {
  return await data(
    `
with target as (
  select s.id session_id
  from sessions s join campaigns c on c.id = s.campaign_id
  where c.slug = $1 and s.source_session_id = $2
),
publication_rows as (
  select visibility, status, count(*) count from publications p join target t on t.session_id = p.session_id
  where p.source_run_id = $3
  group by visibility, status
)
select json_build_object(
  'reviewDecisions', (
    select count(*) from review_decisions rd join target t on t.session_id = rd.session_id
    where rd.source_run_id = $3
  ),
  'canonApproved', (
    select count(*) from canon_candidates cc join target t on t.session_id = cc.session_id
    where cc.source_run_id = $3 and cc.status = 'approved_canon'
  ),
  'quoteApproved', (
    select count(*) from quote_candidates qc join target t on t.session_id = qc.session_id
    where qc.source_run_id = $3 and qc.status = 'approved'
  ),
  'outtakeApprovedAll', (
    select count(*) from outtake_candidates oc join target t on t.session_id = oc.session_id
    where oc.source_run_id = $3 and oc.status = 'approved_by_all'
  ),
  'approvedPublications', (
    select count(*) from publications p join target t on t.session_id = p.session_id
    where p.source_run_id = $3 and p.visibility <> 'review_only'
  ),
  'publications', coalesce((
    select json_agg(json_build_object('visibility', visibility, 'status', status, 'count', count) order by visibility, status)
    from publication_rows
  ), '[]'::json)
) data from target;
`,
    [campaign, sourceSessionId, runId],
    db
  ) || {};
}

async function buildReviewPayload(campaign, sourceSessionId, runId, db = getPool()) {
  const common = targetCte();
  const baseParams = [campaign, sourceSessionId];
  const runParams = [campaign, sourceSessionId, runId];
  const session = await data(`${common} select row_to_json(target) data from target;`, baseParams, db);
  if (!session) throw new Error(`Session not found: ${campaign}/${sourceSessionId}`);

  const [
    participants,
    segments,
    recordingFiles,
    jobs,
    roll20Events,
    classifications,
    canonCandidates,
    quoteCandidates,
    outtakeCandidates,
    publications
  ] = await Promise.all([
    data(
      `${common}
select coalesce(json_agg(item order by item->>'track_key'), '[]'::json) data from (
  select json_build_object(
    'id', p.id,
    'track_key', p.source_track_key,
    'player_name', p.player_name,
    'character_name', p.character_name,
    'role', p.role,
    'audio_track_label', p.audio_track_label,
    'participant_status', p.participant_status,
    'needs_review', p.needs_review,
    'discord_handle', p.discord_handle
  ) item
  from participants p join target t on t.session_id = p.session_id
) rows;`,
      baseParams,
      db
    ),
    data(
      `${common}
select coalesce(json_agg(item order by (item->>'start_ms')::int, item->>'track_key', (item->>'chunk_index')::int), '[]'::json) data from (
  select json_build_object(
    'id', ts.source_segment_id,
    'db_id', ts.id,
    'source_sequence', ts.source_sequence,
    'track_key', ts.track_key,
    'speaker_name', ts.speaker_name,
    'speaker_role', ts.speaker_role,
    'character_name', ts.character_name,
    'start_ms', ts.start_ms,
    'end_ms', ts.end_ms,
    'chunk_index', ts.chunk_index,
    'text', ts.text,
    'text_chars', ts.text_chars,
    'text_words', ts.text_words,
    'needs_review', ts.needs_review,
    'review_status', ts.review_status,
    'tags', ts.tags,
    'source_chunk_path', ts.source_chunk_path,
    'response_path', ts.response_path,
    'metadata', ts.metadata
  ) item
  from transcript_segments ts join target t on t.session_id = ts.session_id
  where ts.is_empty = false
) rows;`,
      baseParams,
      db
    ),
    data(
      `${common}
select coalesce(json_agg(item order by item->>'source_file_role'), '[]'::json) data from (
  select json_build_object(
    'source_file_role', rf.source_file_role,
    'file_type', rf.file_type,
    'storage_bucket', rf.storage_bucket,
    'storage_path', rf.storage_path,
    'original_filename', rf.original_filename,
    'mime_type', rf.mime_type,
    'size_bytes', rf.size_bytes,
    'duration_ms', rf.duration_ms
  ) item
  from recording_files rf join target t on t.session_id = rf.session_id
) rows;`,
      baseParams,
      db
    ),
    data(
      `${common}
select coalesce(json_agg(item order by item->>'job_type'), '[]'::json) data from (
  select json_build_object(
    'job_type', pj.job_type,
    'status', pj.status,
    'attempts', pj.attempts,
    'started_at', pj.started_at,
    'finished_at', pj.finished_at,
    'output', pj.output
  ) item
  from processing_jobs pj join target t on t.session_id = pj.session_id
) rows;`,
      baseParams,
      db
    ),
    data(
      `${common}
select coalesce(json_agg(item order by coalesce((item->>'approx_start_ms')::int, 2147483647), item->>'created_at'), '[]'::json) data from (
  select json_build_object(
    'id', re.id,
    'event_type', re.event_type,
    'roll20_who', re.roll20_who,
    'character_name', re.character_name,
    'approx_start_ms', re.approx_start_ms,
    'text', re.text,
    'source_system', re.source_system,
    'source_event_id', re.source_event_id,
    'created_at_roll20', re.created_at_roll20,
    'created_at', re.created_at,
    'payload', re.payload
  ) item
  from roll20_events re join target t on t.session_id = re.session_id
) rows;`,
      baseParams,
      db
    ),
    data(
      `${common}
select coalesce(json_agg(item order by item->>'segment_id'), '[]'::json) data from (
  select json_build_object(
    'segment_id', ts.source_segment_id,
    'segment_type', sc.segment_type,
    'canon_relevance', sc.canon_relevance,
    'confidence', sc.confidence,
    'needs_review', sc.needs_review,
    'reason', sc.reason,
    'source_run_id', sc.source_run_id,
    'metadata', sc.metadata
  ) item
  from segment_classifications sc
  join transcript_segments ts on ts.id = sc.segment_id
  join target t on t.session_id = ts.session_id
  where sc.source_run_id = $3
) rows;`,
      runParams,
      db
    ),
    data(
      `${common}
select coalesce(json_agg(item order by item->>'source_candidate_id'), '[]'::json) data from (
  select json_build_object(
    'id', cc.id,
    'source_candidate_id', cc.source_candidate_id,
    'title', cc.title,
    'claim', cc.claim,
    'candidate_type', cc.candidate_type,
    'status', cc.status,
    'confidence', cc.confidence,
    'source_segment_ids', array(select ts.source_segment_id from transcript_segments ts where ts.id = any(cc.source_segment_ids) order by ts.source_sequence),
    'metadata', cc.metadata
  ) item
  from canon_candidates cc join target t on t.session_id = cc.session_id
  where cc.source_run_id = $3
) rows;`,
      runParams,
      db
    ),
    data(
      `${common}
select coalesce(json_agg(item order by item->>'source_candidate_id'), '[]'::json) data from (
  select json_build_object(
    'id', qc.id,
    'source_candidate_id', qc.source_candidate_id,
    'quote_text', qc.quote_text,
    'character_name', qc.character_name,
    'context', qc.context,
    'status', qc.status,
    'approved_for_public', qc.approved_for_public,
    'source_segment_ids', array(select ts.source_segment_id from transcript_segments ts where ts.id = any(qc.source_segment_ids) order by ts.source_sequence),
    'metadata', qc.metadata
  ) item
  from quote_candidates qc join target t on t.session_id = qc.session_id
  where qc.source_run_id = $3
) rows;`,
      runParams,
      db
    ),
    data(
      `${common}
select coalesce(json_agg(item order by item->>'source_candidate_id'), '[]'::json) data from (
  select json_build_object(
    'id', oc.id,
    'source_candidate_id', oc.source_candidate_id,
    'title', oc.title,
    'description', oc.description,
    'start_ms', oc.start_ms,
    'end_ms', oc.end_ms,
    'sensitivity_level', oc.sensitivity_level,
    'status', oc.status,
    'source_segment_ids', array(select ts.source_segment_id from transcript_segments ts where ts.id = any(oc.source_segment_ids) order by ts.source_sequence),
    'metadata', oc.metadata
  ) item
  from outtake_candidates oc join target t on t.session_id = oc.session_id
  where oc.source_run_id = $3
) rows;`,
      runParams,
      db
    ),
    data(
      `${common}
select coalesce(json_agg(item order by item->>'source_publication_id'), '[]'::json) data from (
  select json_build_object(
    'id', p.id,
    'publication_type', p.publication_type,
    'source_publication_id', p.source_publication_id,
    'title', p.title,
    'content', p.content,
    'format', p.format,
    'visibility', p.visibility,
    'status', p.status,
    'source_run_id', p.source_run_id,
    'metadata', p.metadata,
    'updated_at', p.updated_at
  ) item
  from publications p join target t on t.session_id = p.session_id
  where p.source_run_id = $3
) rows;`,
      runParams,
      db
    )
  ]);

  const tracks = {};
  for (const participant of participants || []) {
    tracks[participant.track_key] = {
      track_key: participant.track_key,
      speaker_name: participant.player_name,
      character_name: participant.character_name,
      role: participant.role,
      participant_status: participant.participant_status,
      needs_review: participant.needs_review,
      segments: 0,
      words: 0
    };
  }
  for (const segment of segments || []) {
    segment.ai = null;
    const track = tracks[segment.track_key] || (tracks[segment.track_key] = {
      track_key: segment.track_key,
      speaker_name: segment.speaker_name,
      character_name: segment.character_name,
      role: segment.speaker_role,
      participant_status: 'unknown',
      needs_review: true,
      segments: 0,
      words: 0
    });
    track.segments += 1;
    track.words += Number(segment.text_words || 0);
  }
  const classificationBySegment = Object.fromEntries((classifications || []).map(item => [item.segment_id, item]));
  for (const segment of segments || []) {
    segment.ai = classificationBySegment[segment.id] || null;
  }

  const storage = {};
  for (const file of recordingFiles || []) {
    const bucket = file.storage_bucket || 'unknown';
    storage[bucket] ||= { files: 0, bytes: 0 };
    storage[bucket].files += 1;
    storage[bucket].bytes += Number(file.size_bytes || 0);
  }

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    campaign: { slug: session.campaign_slug, name: session.campaign_name },
    session: {
      id: session.session_id,
      sourceSessionId: session.source_session_id,
      title: session.session_title,
      date: session.session_date,
      arc: session.arc,
      status: session.status,
      durationMs: session.duration_ms,
      startedAt: session.started_at,
      summary: session.summary_short
    },
    participants: participants || [],
    tracks: Object.values(tracks).sort((a, b) => a.track_key.localeCompare(b.track_key)),
    segments: segments || [],
    recordingFiles: recordingFiles || [],
    jobs: jobs || [],
    roll20Events: roll20Events || [],
    ai: {
      runId,
      classifications: classifications || [],
      canonCandidates: canonCandidates || [],
      quoteCandidates: quoteCandidates || [],
      outtakeCandidates: outtakeCandidates || [],
      publications: publications || [],
      summary: {
        classifications: (classifications || []).length,
        canonCandidates: (canonCandidates || []).length,
        quoteCandidates: (quoteCandidates || []).length,
        outtakeCandidates: (outtakeCandidates || []).length,
        publications: (publications || []).length
      }
    },
    summary: {
      segments: (segments || []).length,
      participants: (participants || []).length,
      recordingFiles: (recordingFiles || []).length,
      roll20Events: (roll20Events || []).length,
      words: (segments || []).reduce((sum, segment) => sum + Number(segment.text_words || 0), 0),
      durationMs: session.duration_ms,
      needsReview: (segments || []).filter(segment => segment.needs_review).length,
      storage
    }
  };
}

async function buildDecisionTemplate(campaign, sourceSessionId, runId, actorTrackKey, includeAllSegments) {
  const common = `
with target as (
  select c.slug campaign_slug, c.name campaign_name, s.id session_id,
         s.source_session_id, s.title session_title, s.status session_status
  from sessions s join campaigns c on c.id = s.campaign_id
  where c.slug = $1 and s.source_session_id = $2
)`;
  const baseParams = [campaign, sourceSessionId];
  const runParams = [campaign, sourceSessionId, runId];
  const session = await data(`${common} select row_to_json(target) data from target;`, baseParams);
  if (!session) throw new Error(`Session not found: ${campaign}/${sourceSessionId}`);
  const segmentFilter = includeAllSegments ? 'true' : "(ts.needs_review = true or ts.review_status <> 'pending')";
  const [segments, canon, quotes, outtakes] = await Promise.all([
    data(
      `${common}
select coalesce(json_agg(item order by item->>'sourceSegmentId'), '[]'::json) data from (
  select json_build_object(
    'sourceSegmentId', ts.source_segment_id,
    'decision', case when ts.review_status is null or ts.review_status = 'pending' then 'needs_review' else ts.review_status end,
    'characterName', ts.character_name,
    'speakerName', ts.speaker_name,
    'trackKey', ts.track_key,
    'startMs', ts.start_ms,
    'endMs', ts.end_ms,
    'textPreview', left(ts.text, 600),
    'note', ''
  ) item
  from transcript_segments ts join target t on t.session_id = ts.session_id
  where ts.source_segment_id is not null and ${segmentFilter}
) rows;`,
      baseParams
    ),
    data(
      `${common}
select coalesce(json_agg(item order by item->>'sourceCandidateId'), '[]'::json) data from (
  select json_build_object(
    'targetType', 'canon_candidates',
    'sourceCandidateId', cc.source_candidate_id,
    'decision', cc.status,
    'currentStatus', cc.status,
    'title', cc.title,
    'bodyPreview', left(cc.claim, 1000),
    'confidence', cc.confidence,
    'sourceSegmentIds', array(select ts.source_segment_id from transcript_segments ts where ts.id = any(cc.source_segment_ids) order by ts.source_sequence),
    'note', ''
  ) item
  from canon_candidates cc join target t on t.session_id = cc.session_id
  where cc.source_run_id = $3
) rows;`,
      runParams
    ),
    data(
      `${common}
select coalesce(json_agg(item order by item->>'sourceCandidateId'), '[]'::json) data from (
  select json_build_object(
    'targetType', 'quote_candidates',
    'sourceCandidateId', qc.source_candidate_id,
    'decision', qc.status,
    'currentStatus', qc.status,
    'title', coalesce(qc.character_name, 'Fala candidata'),
    'bodyPreview', left(qc.quote_text, 1000),
    'context', qc.context,
    'approvedForPublic', qc.approved_for_public,
    'sourceSegmentIds', array(select ts.source_segment_id from transcript_segments ts where ts.id = any(qc.source_segment_ids) order by ts.source_sequence),
    'note', ''
  ) item
  from quote_candidates qc join target t on t.session_id = qc.session_id
  where qc.source_run_id = $3
) rows;`,
      runParams
    ),
    data(
      `${common}
select coalesce(json_agg(item order by item->>'sourceCandidateId'), '[]'::json) data from (
  select json_build_object(
    'targetType', 'outtake_candidates',
    'sourceCandidateId', oc.source_candidate_id,
    'decision', oc.status,
    'currentStatus', oc.status,
    'title', oc.title,
    'bodyPreview', left(oc.description, 1000),
    'sensitivityLevel', oc.sensitivity_level,
    'sourceSegmentIds', array(select ts.source_segment_id from transcript_segments ts where ts.id = any(oc.source_segment_ids) order by ts.source_sequence),
    'note', ''
  ) item
  from outtake_candidates oc join target t on t.session_id = oc.session_id
  where oc.source_run_id = $3
) rows;`,
      runParams
    )
  ]);
  const candidateDecisions = [...(canon || []), ...(quotes || []), ...(outtakes || [])]
    .sort((a, b) => `${a.targetType}:${a.sourceCandidateId}`.localeCompare(`${b.targetType}:${b.sourceCandidateId}`));
  return {
    schemaVersion: 1,
    sourceSessionId,
    aiRunId: runId,
    exportedAt: new Date().toISOString(),
    campaign: { slug: session.campaign_slug, name: session.campaign_name },
    session: {
      sourceSessionId: session.source_session_id,
      title: session.session_title,
      status: session.session_status
    },
    actor: {
      trackKey: actorTrackKey,
      role: 'dm',
      note: 'DM bate o martelo final de canon/publicacao.'
    },
    segmentDecisions: segments || [],
    candidateDecisions
  };
}

function normalizeSegmentDecision(raw) {
  const sourceSegmentId = String(raw.sourceSegmentId || raw.source_segment_id || raw.id || '').trim();
  const decision = String(raw.decision || raw.status || '').trim();
  if (!sourceSegmentId) throw new Error('segment decision missing sourceSegmentId');
  if (!SEGMENT_STATUSES.has(decision)) throw new Error(`invalid segment decision for ${sourceSegmentId}: ${decision}`);
  return {
    sourceSegmentId,
    decision,
    characterName: raw.characterName ?? raw.character_name,
    textOverride: raw.textOverride ?? raw.text_override,
    note: raw.note || raw.notes || '',
    updatedAt: raw.updatedAt || raw.updated_at || null,
    raw
  };
}

function normalizeCandidateDecision(raw) {
  const targetType = String(raw.targetType || raw.target_table || raw.targetTable || '').trim();
  const sourceCandidateId = String(raw.sourceCandidateId || raw.source_candidate_id || raw.id || '').trim();
  const decision = String(raw.decision || raw.status || '').trim();
  if (!CANDIDATE_STATUS[targetType]) throw new Error(`invalid candidate target table: ${targetType}`);
  if (!sourceCandidateId) throw new Error(`candidate decision missing sourceCandidateId for ${targetType}`);
  const status = CANDIDATE_STATUS[targetType][decision];
  if (!status) throw new Error(`invalid candidate decision for ${targetType}/${sourceCandidateId}: ${decision}`);
  return {
    targetType,
    sourceCandidateId,
    decision,
    status,
    note: raw.note || raw.notes || '',
    approvedForPublic: Boolean(raw.approvedForPublic || raw.approved_for_public),
    updatedAt: raw.updatedAt || raw.updated_at || null,
    raw
  };
}

async function resolveContext(db, campaign, sourceSessionId, runId, actorKey) {
  const session = await data(
    `
with target as (
  select c.id campaign_id, c.slug campaign_slug, s.id session_id, s.source_session_id
  from sessions s join campaigns c on c.id = s.campaign_id
  where c.slug = $1 and s.source_session_id = $2
)
select row_to_json(target) data from target;`,
    [campaign, sourceSessionId],
    db
  );
  if (!session) throw new Error(`Session not found: ${campaign}/${sourceSessionId}`);
  const actor = actorKey ? await data(
    `
with target as (
  select s.id session_id
  from sessions s join campaigns c on c.id = s.campaign_id
  where c.slug = $1 and s.source_session_id = $2
)
select row_to_json(actor_row) data from (
  select p.id, p.display_name, p.roll20_name, p.source_key, p.discord_id
  from profiles p
  left join participants pt on pt.profile_id = p.id
  left join target t on t.session_id = pt.session_id
  where pt.source_track_key = $3
     or p.roll20_name = $3
     or p.source_key = $3
     or p.discord_id = $3
     or lower(p.display_name) = lower($3)
  order by case when pt.source_track_key = $3 then 0 else 1 end
  limit 1
) actor_row;`,
    [campaign, sourceSessionId, actorKey],
    db
  ) : null;
  const segmentRows = await db.query(
    `
select ts.source_segment_id, ts.id, ts.character_name, ts.text, ts.review_status
from transcript_segments ts
join sessions s on s.id = ts.session_id
join campaigns c on c.id = s.campaign_id
where c.slug = $1 and s.source_session_id = $2 and ts.source_segment_id is not null;`,
    [campaign, sourceSessionId]
  );
  const segments = Object.fromEntries(segmentRows.rows.map(row => [row.source_segment_id, row]));
  const candidates = {};
  for (const table of Object.keys(CANDIDATE_STATUS)) {
    const result = await db.query(
      `
select item.source_candidate_id, item.id, item.status
from ${table} item
join sessions s on s.id = item.session_id
join campaigns c on c.id = s.campaign_id
where c.slug = $1 and s.source_session_id = $2 and item.source_run_id = $3 and item.source_candidate_id is not null;`,
      [campaign, sourceSessionId, runId]
    );
    candidates[table] = Object.fromEntries(result.rows.map(row => [row.source_candidate_id, row]));
  }
  return { session, actor, segments, candidates };
}

function reviewMetadata(kind, payload, previous) {
  return {
    kind,
    source_payload: payload,
    previous: previous || {},
    applied_by: 'api/vercel'
  };
}

async function insertReviewDecision(db, context, item, targetTable, targetId, targetSourceId, decision, note, metadataValue, runId) {
  const sourceDecisionId = `${targetTable}:${targetSourceId}`;
  await db.query(
    `
insert into review_decisions (
  id, session_id, target_table, target_id, decision, notes, decided_by,
  source_system, source_run_id, source_decision_id, target_source_id, metadata, updated_at
)
values (
  gen_random_uuid(), $1::uuid, $2, $3::uuid, $4, $5, $6::uuid,
  'vercel_review_board', $7, $8, $9, $10::jsonb, now()
)
on conflict (session_id, source_run_id, source_decision_id)
where source_run_id is not null and source_decision_id is not null
do update set
  target_table = excluded.target_table,
  target_id = excluded.target_id,
  decision = excluded.decision,
  notes = excluded.notes,
  decided_by = excluded.decided_by,
  source_system = excluded.source_system,
  target_source_id = excluded.target_source_id,
  metadata = excluded.metadata,
  updated_at = now();`,
    [
      context.session.session_id,
      targetTable,
      targetId,
      decision,
      note || null,
      context.actor?.id || null,
      runId,
      sourceDecisionId,
      targetSourceId,
      JSON.stringify(metadataValue)
    ]
  );
}

async function applyDecisionsToDb(db, payload, campaign, sourceSessionId, runId) {
  const actorPayload = payload.actor || {};
  const actorKey = actorPayload.trackKey || actorPayload.track_key || DEFAULT_ACTOR;
  const context = await resolveContext(db, campaign, sourceSessionId, runId, actorKey);
  const segmentDecisions = (payload.segmentDecisions || []).map(normalizeSegmentDecision);
  const candidateDecisions = (payload.candidateDecisions || []).map(normalizeCandidateDecision);
  const summary = {
    segment_decisions: 0,
    candidate_decisions: 0,
    missing_segments: [],
    missing_candidates: [],
    actor_resolved: Boolean(context.actor?.id)
  };

  for (const item of segmentDecisions) {
    const current = context.segments[item.sourceSegmentId];
    if (!current) {
      summary.missing_segments.push(item.sourceSegmentId);
      continue;
    }
    const meta = reviewMetadata('segment', item.raw, current);
    await insertReviewDecision(db, context, item, 'transcript_segments', current.id, item.sourceSegmentId, item.decision, item.note, meta, runId);

    const sets = ['review_status = $1', "metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb"];
    const params = [item.decision, JSON.stringify({ review: meta })];
    if (item.characterName !== undefined && String(item.characterName || '').trim()) {
      params.push(String(item.characterName).trim());
      sets.push(`character_name = $${params.length}`);
    }
    if (item.textOverride !== undefined && String(item.textOverride || '').trim() && String(item.textOverride).trim() !== current.text) {
      const text = String(item.textOverride).trim();
      params.push(text);
      sets.push(`text = $${params.length}`);
      params.push(text.length);
      sets.push(`text_chars = $${params.length}`);
      params.push(text.split(/\s+/).filter(Boolean).length);
      sets.push(`text_words = $${params.length}`);
    }
    params.push(current.id);
    await db.query(`update transcript_segments set ${sets.join(', ')} where id = $${params.length}::uuid`, params);
    summary.segment_decisions += 1;
  }

  for (const item of candidateDecisions) {
    const current = context.candidates[item.targetType]?.[item.sourceCandidateId];
    if (!current) {
      summary.missing_candidates.push(`${item.targetType}:${item.sourceCandidateId}`);
      continue;
    }
    const meta = reviewMetadata('candidate', item.raw, current);
    await insertReviewDecision(db, context, item, item.targetType, current.id, item.sourceCandidateId, item.decision, item.note, meta, runId);
    const metadataJson = JSON.stringify({ review: meta });
    const actorId = context.actor?.id || null;

    if (item.targetType === 'canon_candidates') {
      await db.query(
        `
update canon_candidates
set status = $1,
    reviewer_notes = coalesce($2, reviewer_notes),
    approved_by = case when $3::boolean then $4::uuid else approved_by end,
    approved_at = case when $3::boolean then now() else approved_at end,
    metadata = coalesce(metadata, '{}'::jsonb) || $5::jsonb,
    updated_at = now()
where id = $6::uuid;`,
        [item.status, item.note || null, Boolean(actorId && item.status === 'approved_canon'), actorId, metadataJson, current.id]
      );
    } else if (item.targetType === 'quote_candidates') {
      await db.query(
        `
update quote_candidates
set status = $1,
    approved_for_public = case when $2::boolean then $3::boolean else approved_for_public end,
    approved_by = case when $2::boolean then $4::uuid else approved_by end,
    approved_at = case when $2::boolean then now() else approved_at end,
    metadata = coalesce(metadata, '{}'::jsonb) || $5::jsonb
where id = $6::uuid;`,
        [item.status, Boolean(actorId && item.status === 'approved'), item.approvedForPublic, actorId, metadataJson, current.id]
      );
    } else if (item.targetType === 'outtake_candidates') {
      await db.query(
        `
update outtake_candidates
set status = $1,
    approved_by = case
      when $2::boolean then array(select distinct unnest(coalesce(approved_by, '{}'::uuid[]) || array[$3::uuid]))
      else approved_by
    end,
    metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb
where id = $5::uuid;`,
        [item.status, Boolean(actorId && ['approved_by_speaker', 'approved_by_all'].includes(item.status)), actorId, metadataJson, current.id]
      );
    }
    summary.candidate_decisions += 1;
  }

  await db.query(
    `
insert into processing_jobs (
  id, session_id, job_type, status, attempts, input, output, started_at, finished_at
)
values (
  gen_random_uuid(), $1::uuid, 'apply_review_decisions', 'succeeded', 1,
  $2::jsonb, $3::jsonb, now(), now()
);`,
    [
      context.session.session_id,
      JSON.stringify({ source_run_id: runId, actor: payload.actor || null, source: 'vercel' }),
      JSON.stringify(summary)
    ]
  );

  return summary;
}

function candidateLines(title, items, bodyKey) {
  const lines = [`## ${title}`, ''];
  if (!items.length) return [...lines, 'Nenhum item nesta categoria.', ''];
  for (const item of items) {
    const name = item.title || item.character_name || item.source_candidate_id;
    lines.push(`### ${name}`, '', `- Status: \`${item.status}\``);
    lines.push(`- Confiança IA: \`${item.confidence ?? item.metadata?.confidence ?? '-'}\``);
    lines.push(`- Fontes: \`${(item.source_segment_ids || []).join(', ')}\``);
    if (item.sensitivity_level) lines.push(`- Sensibilidade: \`${item.sensitivity_level}\``);
    lines.push('', String(item[bodyKey] || ''));
    if (item.metadata?.reason) lines.push('', `Motivo IA: ${item.metadata.reason}`);
    lines.push('');
  }
  return lines;
}

function buildReviewPacket(context) {
  const session = context.session;
  const lines = [
    `# Pacote de Revisão — ${session.session_title}`,
    '',
    '> Documento interno. Não publicar. Nada aqui é canon aprovado até decisão do DM.',
    '',
    '## Sessão',
    '',
    `- Campanha: \`${session.campaign_name}\``,
    `- Session source: \`${session.source_session_id}\``,
    `- Data: \`${session.session_date || 'sem data'}\``,
    `- Run IA: \`${context.source_run_id}\``,
    '',
    '## Trava de publicação',
    '',
    'Este pacote contém candidatos e material de revisão. Para gerar publicação final, primeiro aprove itens como canon, fala ou bastidor publicável.',
    ''
  ];
  return [
    ...lines,
    ...candidateLines('Canon candidato', context.canon, 'claim'),
    ...candidateLines('Falas candidatas', context.quotes, 'quote_text'),
    ...candidateLines('Bastidores candidatos', context.outtakes, 'description')
  ].join('\n').trimEnd() + '\n';
}

function buildApprovedPublications(context) {
  const approvedCanon = context.canon.filter(item => item.status === 'approved_canon');
  const approvedQuotes = context.quotes.filter(item => item.status === 'approved');
  const approvedOuttakes = context.outtakes.filter(item => item.status === 'approved_by_all');
  const publications = [];
  if (approvedCanon.length) {
    const content = ['# Mudanças de Canon', ''];
    for (const item of approvedCanon) {
      content.push(`## ${item.title}`, '', item.claim, '', `Fontes: \`${(item.source_segment_ids || []).join(', ')}\``, '');
    }
    publications.push({
      source_publication_id: 'canon_changes_approved',
      publication_type: 'canon_changes',
      title: 'Mudanças de canon aprovadas',
      content: content.join('\n').trimEnd() + '\n',
      visibility: 'private_players',
      status: 'draft',
      metadata: { approved_items: approvedCanon.length }
    });
    publications.push({
      source_publication_id: 'recap_short_approved',
      publication_type: 'recap_short',
      title: 'Recap curto aprovado',
      content: ['# Recap curto', '', 'Fatos aprovados desta sessão:', '', ...approvedCanon.map(item => `- ${item.claim}`)].join('\n').trimEnd() + '\n',
      visibility: 'private_players',
      status: 'draft',
      metadata: { approved_items: approvedCanon.length }
    });
  }
  if (approvedQuotes.length) {
    const content = ['# Falas aprovadas', ''];
    for (const item of approvedQuotes) {
      content.push(`- **${item.character_name || 'Mesa'}:** ${item.quote_text}`, `  - Fontes: \`${(item.source_segment_ids || []).join(', ')}\``);
    }
    publications.push({
      source_publication_id: 'quotes_approved',
      publication_type: 'quotes',
      title: 'Falas aprovadas',
      content: content.join('\n').trimEnd() + '\n',
      visibility: 'private_players',
      status: 'draft',
      metadata: { approved_items: approvedQuotes.length }
    });
  }
  if (approvedOuttakes.length) {
    const content = ['# Bastidores aprovados', ''];
    for (const item of approvedOuttakes) content.push(`## ${item.title}`, '', item.description, '');
    publications.push({
      source_publication_id: 'outtakes_approved',
      publication_type: 'outtakes_public',
      title: 'Bastidores aprovados',
      content: content.join('\n').trimEnd() + '\n',
      visibility: 'private_players',
      status: 'draft',
      metadata: { approved_items: approvedOuttakes.length }
    });
  }
  return publications;
}

async function publicationContext(db, campaign, sourceSessionId, runId) {
  const review = await buildReviewPayload(campaign, sourceSessionId, runId, db);
  return {
    session: {
      campaign_slug: review.campaign.slug,
      campaign_name: review.campaign.name,
      session_id: review.session.id,
      session_title: review.session.title,
      source_session_id: review.session.sourceSessionId,
      session_date: review.session.date,
      status: review.session.status,
      duration_ms: review.session.durationMs,
      summary_short: review.session.summary
    },
    source_run_id: runId,
    canon: review.ai.canonCandidates,
    quotes: review.ai.quoteCandidates,
    outtakes: review.ai.outtakeCandidates
  };
}

async function rebuildPublications(db, campaign, sourceSessionId, runId) {
  const context = await publicationContext(db, campaign, sourceSessionId, runId);
  const publications = [{
    source_publication_id: 'ai_review_packet',
    publication_type: 'master_notes',
    title: 'Pacote de revisão IA',
    content: buildReviewPacket(context),
    visibility: 'review_only',
    status: 'draft',
    metadata: {
      warning: 'review_only_not_public',
      canon_candidates: context.canon.length,
      quote_candidates: context.quotes.length,
      outtake_candidates: context.outtakes.length
    }
  }, ...buildApprovedPublications(context)];

  for (const item of publications) {
    await db.query(
      `
insert into publications (
  id, session_id, publication_type, title, content, format, visibility, status,
  source_system, source_run_id, source_publication_id, metadata, updated_at
)
values (
  gen_random_uuid(), $1::uuid, $2, $3, $4, 'markdown', $5, $6,
  'vercel_publication_pipeline', $7, $8, $9::jsonb, now()
)
on conflict (session_id, source_run_id, source_publication_id)
where source_run_id is not null and source_publication_id is not null
do update set
  publication_type = excluded.publication_type,
  title = excluded.title,
  content = excluded.content,
  format = excluded.format,
  visibility = excluded.visibility,
  status = excluded.status,
  source_system = excluded.source_system,
  metadata = excluded.metadata,
  updated_at = now();`,
      [
        context.session.session_id,
        item.publication_type,
        item.title,
        item.content,
        item.visibility,
        item.status,
        runId,
        item.source_publication_id,
        JSON.stringify({ ...item.metadata, generated_by: 'api/vercel' })
      ]
    );
  }
  await db.query(
    `
insert into processing_jobs (
  id, session_id, job_type, status, attempts, input, output, started_at, finished_at
)
values (
  gen_random_uuid(), $1::uuid, 'build_publications', 'succeeded', 1,
  $2::jsonb, $3::jsonb, now(), now()
);`,
    [
      context.session.session_id,
      JSON.stringify({ source_run_id: runId, source: 'vercel' }),
      JSON.stringify({
        source_run_id: runId,
        publication_count: publications.length,
        review_only: publications.filter(item => item.visibility === 'review_only').length,
        private_players: publications.filter(item => item.visibility === 'private_players').length,
        public_campaign: publications.filter(item => item.visibility === 'public_campaign').length,
        public_web: publications.filter(item => item.visibility === 'public_web').length
      })
    ]
  );
  return {
    outDir: null,
    publications: publications.length,
    reviewOnly: publications.filter(item => item.visibility === 'review_only').length,
    approvedPublications: publications.filter(item => item.visibility !== 'review_only').length
  };
}

async function handleGet(req, res, path, query) {
  const campaign = query.get('campaignSlug') || DEFAULT_CAMPAIGN;
  const sourceSessionId = query.get('sourceSessionId') || DEFAULT_SOURCE_SESSION;
  const runId = query.get('runId') || DEFAULT_RUN;
  if (path === '/api/auth-config') {
    const config = authPublicConfig();
    return sendJson(res, 200, {
      ok: true,
      mode: 'auth_required',
      primaryProvider: 'discord',
      providers: ['discord', 'google'],
      supabaseUrl: config.supabaseUrl,
      publishableKey: config.publishableKey
    });
  }
  if (path === '/api/auth/me') {
    return sendJson(res, 200, await authMePayload(req, campaign));
  }
  if (path === '/api/audio-url') {
    await requireCampaignAccess(req, campaign);
    const trackKey = query.get('trackKey') || query.get('sourceFileRole') || '';
    const expires = query.get('expires') || '900';
    return sendJson(res, 200, await audioUrlPayload(campaign, sourceSessionId, trackKey, expires));
  }
  if (path === '/api/health') {
    return sendJson(res, 200, { ok: true, app: 'dnd-scribe-vercel', campaignSlug: campaign });
  }
  if (path === '/api/jobs') {
    await requireCampaignAccess(req, campaign);
    return sendJson(res, 200, {
      ok: true,
      jobs: await listJobs(campaign, query.get('sourceSessionId') || ''),
      mode: 'supabase_prod_jobs',
      note: 'Jobs de producao sao persistidos no Supabase; execucao pesada ainda depende do worker cloud.'
    });
  }
  if (path === '/api/craig-map') {
    await requireCampaignAccess(req, campaign);
    return sendJson(res, 200, {
      ok: true,
      mode: 'deploy_config_readonly',
      map: loadCraigMapConfig(),
      editable: false,
      note: 'Mapa Craig carregado do deploy. Edicao em producao entra em etapa propria.'
    });
  }
  if (path === '/api/sessions') {
    await requireCampaignAccess(req, campaign);
    return sendJson(res, 200, { ok: true, sessions: await listSessions(campaign, runId) });
  }
  if (path === '/api/session') {
    await requireCampaignAccess(req, campaign);
    const [review, summary] = await Promise.all([
      buildReviewPayload(campaign, sourceSessionId, runId),
      responseSummary(campaign, sourceSessionId, runId)
    ]);
    return sendJson(res, 200, { ok: true, review, summary });
  }
  if (path === '/api/review-template') {
    await requireCampaignAccess(req, campaign);
    const actor = query.get('actorTrackKey') || DEFAULT_ACTOR;
    const includeAll = query.get('includeAllSegments') === 'true';
    const template = await buildDecisionTemplate(campaign, sourceSessionId, runId, actor, includeAll);
    return sendJson(res, 200, { ok: true, template });
  }
  return sendJson(res, 404, { ok: false, error: 'Unknown API route' });
}

async function handlePost(req, res, path) {
  if (path === '/api/ingest/craig') {
    return sendJson(res, 409, {
      ok: false,
      error: 'Upload Craig em producao usa /api/uploads/craig-url para enviar direto ao R2 sem passar o ZIP pela Vercel.'
    });
  }
  const body = await readBody(req);
  const campaign = body.campaignSlug || DEFAULT_CAMPAIGN;
  const decisions = body.decisions || body;
  const sourceSessionId = body.sourceSessionId || decisions.sourceSessionId || DEFAULT_SOURCE_SESSION;
  const runId = body.runId || decisions.aiRunId || DEFAULT_RUN;
  const dryRun = Boolean(body.dryRun);
  if (path === '/api/roll20/ingest' || path === '/api/roll20-ingest') {
    const payload = await roll20IngestPreviewPayload(req, campaign, body);
    if (body.dryRun === false) {
      const client = await getPool().connect();
      try {
        await client.query('begin');
        const persisted = await persistRoll20Events(client, campaign, payload, body);
        await client.query('commit');
        return sendJson(res, 200, {
          ...payload,
          mode: 'persisted',
          dryRun: false,
          persisted
        });
      } catch (error) {
        await client.query('rollback').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    }
    return sendJson(res, 200, payload);
  }
  if (path === '/api/uploads/craig-url') {
    await requireCampaignAccess(req, campaign, ['owner', 'master']);
    const client = await getPool().connect();
    try {
      await client.query('begin');
      const payload = await createCraigUpload(client, campaign, body);
      await client.query('commit');
      return sendJson(res, 200, { ...payload, sessions: await listSessions(campaign, runId) });
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  if (path === '/api/uploads/craig-complete') {
    await requireCampaignAccess(req, campaign, ['owner', 'master']);
    const client = await getPool().connect();
    try {
      await client.query('begin');
      const payload = await completeCraigUpload(client, campaign, body);
      await client.query('commit');
      return sendJson(res, 200, { ...payload, jobs: await listJobs(campaign), sessions: await listSessions(campaign, runId) });
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  if (path === '/api/craig-map/update') {
    await requireCampaignAccess(req, campaign, ['owner', 'master']);
    return sendJson(res, 409, {
      ok: false,
      error: 'Edicao do mapa Craig em producao ainda esta bloqueada; leitura ja funciona pelo deploy.'
    });
  }
  if (path === '/api/sessions/create') {
    await requireCampaignAccess(req, campaign, ['owner', 'master']);
    const session = await createSession(getPool(), campaign, body);
    return sendJson(res, 200, { ok: true, session, sessions: await listSessions(campaign, runId) });
  }
  if (path === '/api/sessions/update') {
    await requireCampaignAccess(req, campaign, ['owner', 'master']);
    const session = await updateSession(getPool(), campaign, body.sourceSessionId || body.source_session_id || '', body);
    return sendJson(res, 200, { ok: true, session, sessions: await listSessions(campaign, runId) });
  }
  if (path === '/api/review-decisions/apply') {
    await requireCampaignAccess(req, campaign, ['owner', 'master']);
    const client = await getPool().connect();
    let decisionSummary = null;
    let publicationResult = null;
    try {
      await client.query('begin');
      if (!dryRun) {
        decisionSummary = await applyDecisionsToDb(client, decisions, campaign, sourceSessionId, runId);
        if (body.rebuildPublications !== false) {
          publicationResult = await rebuildPublications(client, campaign, sourceSessionId, runId);
        }
      } else {
        decisionSummary = { dry_run: true };
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    const [review, summary] = await Promise.all([
      buildReviewPayload(campaign, sourceSessionId, runId),
      responseSummary(campaign, sourceSessionId, runId)
    ]);
    return sendJson(res, 200, { ok: true, dryRun, decisionSummary, publicationResult, summary, review });
  }
  if (path === '/api/publications/rebuild') {
    await requireCampaignAccess(req, campaign, ['owner', 'master']);
    const client = await getPool().connect();
    let publicationResult = null;
    try {
      await client.query('begin');
      if (!dryRun) publicationResult = await rebuildPublications(client, campaign, sourceSessionId, runId);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    const [review, summary] = await Promise.all([
      buildReviewPayload(campaign, sourceSessionId, runId),
      responseSummary(campaign, sourceSessionId, runId)
    ]);
    return sendJson(res, 200, { ok: true, dryRun, publicationResult, summary, review });
  }
  return sendJson(res, 404, { ok: false, error: 'Unknown API route' });
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  try {
    if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
    if (req.method === 'GET') return await handleGet(req, res, path, url.searchParams);
    if (req.method === 'POST') return await handlePost(req, res, path);
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};
