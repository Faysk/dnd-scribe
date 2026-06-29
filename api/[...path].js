const crypto = require('crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const {
  parseRoll20ChatText,
  parseRoll20DiceRoll,
  normalizeRoll20Events,
  summarizeRoll20Events
} = require('../lib/roll20-commands');
const { buildMonitoringPayload } = require('../lib/monitoring');
const { notifyDiscord } = require('../lib/discord');
const { markJobStep } = require('../lib/job-steps');

const DEFAULT_CAMPAIGN = 'yuhara-main';
const DEFAULT_SOURCE_SESSION = 'craig-AdabEqbzngmT-stage1-full';
const DEFAULT_RUN = 'classify_candidates_v2_gpt-4o';
const DEFAULT_ACTOR = 'renanyuhara';
const PROJECT_SCOPE_ID = 'dnd-scribe';
const CRAIG_UPLOAD_MAX_BYTES = 2 * 1024 * 1024 * 1024;
const CRAIG_UPLOAD_EXPIRES_SECONDS = 900;
const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_SYNC_MAX_MESSAGES = 100;
const DISCORD_SYNC_MAX_PAGES = 10;
const ROLL20_BRIDGE_MAX_EVENTS = 100;
const SESSION_TIME_ZONE = process.env.DND_SESSION_TIME_ZONE || 'Europe/London';
const DEFAULT_CHUNK_SECONDS = 600;
const PIPELINE_RUNNABLE_JOB_TYPES = [
  'cloud_ingest_craig',
  'cloud_extract_craig_tracks',
  'cloud_plan_audio_chunks'
];
const PIPELINE_KNOWN_NEXT_JOB_TYPES = [
  ...PIPELINE_RUNNABLE_JOB_TYPES,
  'cloud_detect_speech_slices'
];
const GITHUB_WORKFLOW_REPO = process.env.GITHUB_WORKFLOW_REPOSITORY || process.env.GITHUB_REPOSITORY || 'Faysk/dnd-scribe';
const GITHUB_WORKFLOW_REF = process.env.GITHUB_WORKFLOW_REF || 'main';
const GITHUB_WORKFLOW_TOKEN_NAMES = ['GITHUB_WORKFLOW_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN'];
const TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';
const TRANSCRIPTION_PROMPT_VERSION = 'transcribe_v1';
const DEFAULT_TRANSCRIPTION_LIMIT = 50;
const DEFAULT_TRANSCRIPTION_COST_USD_PER_MINUTE = Number(process.env.DND_COST_TRANSCRIPTION_AUDIO_MINUTE_USD || 0.003);
const DEFAULT_TRANSCRIPTION_APPROVAL_USD = 0.08;
const REVIEW_GENERATION_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-4o';
const DEFAULT_REVIEW_BATCH_SIZE = 80;
const DEFAULT_REVIEW_MAX_BATCHES = 1;

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
let cloudIngestRunner;
let cloudExtractRunner;

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

function getCloudIngestRunner() {
  if (!cloudIngestRunner) {
    cloudIngestRunner = require('./jobs/run-cloud-ingest').runCloudIngest;
  }
  if (typeof cloudIngestRunner !== 'function') {
    throw httpError(500, 'Worker cloud_ingest_craig indisponivel neste deploy.');
  }
  return cloudIngestRunner;
}

function getCloudExtractRunner() {
  if (!cloudExtractRunner) {
    cloudExtractRunner = require('./jobs/run-cloud-extract').runCloudExtract;
  }
  if (typeof cloudExtractRunner !== 'function') {
    throw httpError(500, 'Worker cloud_extract_craig_tracks indisponivel neste deploy.');
  }
  return cloudExtractRunner;
}

function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}

function isRoll20BridgePath(pathname) {
  return pathname === '/api/roll20-bridge' || pathname === '/api/roll20/bridge';
}

function roll20BridgeCorsOrigin(origin = '') {
  const text = cleanText(origin, 300);
  if (!text) return '';
  if (text === 'https://app.roll20.net') return text;
  if (text === 'https://roll20.net') return text;
  if (text === 'https://dnd.faysk.dev') return text;
  if (/^http:\/\/localhost:\d+$/.test(text)) return text;
  return '';
}

function applyRoll20BridgeCors(req, res, pathname) {
  if (!isRoll20BridgePath(pathname)) return;
  const allowedOrigin = roll20BridgeCorsOrigin(req.headers.origin || '');
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-DND-Roll20-Token, X-Roll20-Bridge-Token');
  res.setHeader('Access-Control-Max-Age', '600');
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

function dateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SESSION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function normalizeDateTime(value, fieldName = 'datetime') {
  const text = cleanText(value, 80);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw httpError(400, `${fieldName} precisa ser uma data/hora valida.`);
  return date.toISOString();
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

function craigRecordingIdFromFilename(fileName = '') {
  const match = String(fileName || '').match(/^craig-([a-zA-Z0-9]+)-/);
  return match ? match[1] : '';
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

function permissionActionSet(rbac = null) {
  return new Set((rbac?.permissions || []).map(item => item.action || item.permission_action).filter(Boolean));
}

function capabilitiesForRole(role, rbac = null) {
  const isDm = role === 'owner' || role === 'master';
  const permissions = permissionActionSet(rbac);
  const rbacAvailable = Boolean(rbac?.available);
  return {
    openTestMode: false,
    canReadCampaign: Boolean(role) || permissions.has('campaign.read'),
    canReviewOwnMaterial: Boolean(role) || permissions.has('campaign.read'),
    canReviewTableMaterial: ['owner', 'master', 'reviewer'].includes(role) || permissions.has('narrative.review.manage'),
    canApproveCanon: isDm || permissions.has('narrative.canon.approve'),
    canManageCampaign: isDm,
    canManageAccess: isDm || permissions.has('campaign.access.manage') || permissions.has('project.rbac.manage'),
    canViewMonitoring: permissions.has('project.monitor.read') || (!rbacAvailable && isDm),
    canManageTechnical: permissions.has('project.rbac.manage'),
    canRunTechnicalJobs: permissions.has('project.jobs.run')
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

async function rbacTablesAvailable(db) {
  return Boolean(await data(
    `
select (
  to_regclass('public.role_assignments') is not null
  and to_regclass('public.role_permissions') is not null
  and to_regclass('public.role_definitions') is not null
  and to_regclass('public.permission_catalog') is not null
) data;`,
    [],
    db
  ));
}

async function rbacForProfile(db, profileId) {
  if (!profileId) return { available: await rbacTablesAvailable(db), assignments: [], permissions: [] };
  const available = await rbacTablesAvailable(db);
  if (!available) return { available: false, assignments: [], permissions: [] };
  const assignments = await data(
    `
select coalesce(json_agg(item order by item->>'scopeType', item->>'roleSlug'), '[]'::json) data
from (
  select json_build_object(
    'id', ra.id,
    'roleSlug', rd.slug,
    'roleName', rd.name,
    'plane', rd.plane,
    'scopeType', ra.scope_type,
    'scopeId', ra.scope_id,
    'status', ra.status,
    'startsAt', ra.starts_at,
    'endsAt', ra.ends_at
  ) item
  from role_assignments ra
  join role_definitions rd on rd.id = ra.role_id
  where ra.profile_id = $1::uuid
    and ra.status = 'active'
    and now() >= ra.starts_at
    and (ra.ends_at is null or ra.ends_at > now())
) rows;`,
    [profileId],
    db
  ) || [];
  const permissions = await data(
    `
select coalesce(json_agg(row_to_json(permission_row) order by permission_row.action, permission_row.scope_type, permission_row.scope_id), '[]'::json) data
from (
  select distinct pc.action, pc.plane, pc.description,
         rd.slug role_slug, rd.name role_name,
         ra.scope_type, ra.scope_id
  from role_assignments ra
  join role_definitions rd on rd.id = ra.role_id
  join role_permissions rp on rp.role_id = rd.id
  join permission_catalog pc on pc.action = rp.permission_action
  where ra.profile_id = $1::uuid
    and ra.status = 'active'
    and now() >= ra.starts_at
    and (ra.ends_at is null or ra.ends_at > now())
) permission_row;`,
    [profileId],
    db
  ) || [];
  return { available: true, assignments, permissions };
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
      rbac: { available: false, assignments: [], permissions: [] },
      capabilities: capabilitiesForRole(null, { available: false, assignments: [], permissions: [] }),
      note: 'Login Discord ou Google obrigatorio para acessar dados da mesa.'
    };
  }
  const db = getPool();
  await syncAuthProfile(db, user);
  const linked = await linkedProfileForUser(db, user.id, campaignSlug);
  const rbac = await rbacForProfile(db, linked.profile?.id || null);
  const capabilities = capabilitiesForRole(linked.campaignRole || null, rbac);
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
    rbac,
    capabilities,
    note: linked.campaignRole
      ? 'Perfil autenticado e aprovado na campanha.'
      : capabilities.canViewMonitoring
        ? 'Perfil autenticado com acesso tecnico ao projeto.'
        : 'Perfil autenticado; vinculo com a campanha ainda depende de aprovacao do DM.'
  };
}

async function profileHasPermission(db, profileId, action, scopeType, scopeId) {
  const available = await rbacTablesAvailable(db);
  if (!available) return { available: false, allowed: false };
  if (!profileId) return { available: true, allowed: false };
  const allowed = Boolean(await data(
    `
select exists (
  select 1
  from role_assignments ra
  join role_permissions rp on rp.role_id = ra.role_id
  where ra.profile_id = $1::uuid
    and rp.permission_action = $2
    and ra.status = 'active'
    and now() >= ra.starts_at
    and (ra.ends_at is null or ra.ends_at > now())
    and (
      (ra.scope_type = $3 and ra.scope_id = $4)
      or (ra.scope_type = 'project' and ra.scope_id = $5)
    )
) data;`,
    [profileId, action, scopeType, scopeId, PROJECT_SCOPE_ID],
    db
  ));
  return { available: true, allowed };
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

async function requirePermission(req, campaignSlug, options) {
  const payload = await authMePayload(req, campaignSlug);
  if (!payload.authenticated) throw httpError(401, 'Login Discord ou Google obrigatorio.');
  const db = getPool();
  const profileId = payload.profile?.id || null;
  const check = await profileHasPermission(
    db,
    profileId,
    options.action,
    options.scopeType,
    options.scopeId
  );
  if (check.allowed) return payload;
  if (!check.available && options.legacyRoles?.includes(payload.campaignRole || '')) return payload;
  throw httpError(403, options.error || 'Sem permissao tecnica para esta acao.');
}

async function rbacAdminAccess(req, campaignSlug) {
  const payload = await authMePayload(req, campaignSlug);
  if (!payload.authenticated) throw httpError(401, 'Login Discord ou Google obrigatorio.');
  const db = getPool();
  const profileId = payload.profile?.id || null;
  const [projectCheck, campaignCheck] = await Promise.all([
    profileHasPermission(db, profileId, 'project.rbac.manage', 'project', PROJECT_SCOPE_ID),
    profileHasPermission(db, profileId, 'campaign.access.manage', 'campaign', campaignSlug)
  ]);
  const legacyAdmin = !projectCheck.available && ['owner', 'master'].includes(payload.campaignRole || '');
  const canManageTechnical = Boolean(projectCheck.allowed || legacyAdmin);
  const canManageCampaignAccess = Boolean(projectCheck.allowed || campaignCheck.allowed || legacyAdmin);
  if (!canManageTechnical && !canManageCampaignAccess) {
    throw httpError(403, 'Administracao de funcoes exige project.rbac.manage ou campaign.access.manage.');
  }
  return {
    payload,
    profileId,
    canManageTechnical,
    canManageCampaignAccess,
    rbacAvailable: projectCheck.available && campaignCheck.available
  };
}

function legacyRoleForRoleSlug(roleSlug) {
  return {
    campaign_owner: 'owner',
    campaign_reviewer: 'reviewer',
    player: 'player',
    viewer: 'viewer'
  }[roleSlug] || null;
}

function normalizeRbacScope(raw, campaignSlug, role) {
  const scopeType = cleanText(raw.scopeType || raw.scope_type || 'campaign', 30) || 'campaign';
  if (!['project', 'campaign'].includes(scopeType)) {
    throw httpError(400, 'scopeType precisa ser project ou campaign nesta etapa.');
  }
  const defaultScopeId = scopeType === 'project' ? PROJECT_SCOPE_ID : campaignSlug;
  const scopeId = cleanText(raw.scopeId || raw.scope_id || defaultScopeId, 120) || defaultScopeId;
  if (scopeType === 'project' && scopeId !== PROJECT_SCOPE_ID) {
    throw httpError(400, `Projeto invalido para RBAC: ${scopeId}`);
  }
  if (scopeType === 'campaign' && scopeId !== campaignSlug) {
    throw httpError(400, `Campanha fora do escopo atual: ${scopeId}`);
  }
  if (role?.plane === 'technical' && scopeType !== 'project') {
    throw httpError(400, 'Funcoes tecnicas so podem ser atribuidas no escopo do projeto.');
  }
  if (role?.plane !== 'technical' && scopeType !== 'campaign') {
    throw httpError(400, 'Funcoes narrativas/mistas desta etapa usam escopo da campanha.');
  }
  return { scopeType, scopeId };
}

async function campaignIdForSlug(db, campaignSlug) {
  const row = await data('select id data from campaigns where slug = $1 limit 1;', [campaignSlug], db);
  if (!row) throw httpError(404, `Campanha nao encontrada: ${campaignSlug}`);
  return row;
}

async function roleDefinitionBySlug(db, roleSlug) {
  const role = await data(
    `
select row_to_json(rd) data
from role_definitions rd
where rd.slug = $1
limit 1;`,
    [roleSlug],
    db
  );
  if (!role) throw httpError(404, `Funcao nao encontrada: ${roleSlug}`);
  return role;
}

async function profileExists(db, profileId) {
  if (!profileId) return false;
  return Boolean(await data('select exists(select 1 from profiles where id = $1::uuid) data;', [profileId], db));
}

async function syncLegacyCampaignMembership(db, campaignSlug, profileId, legacyRole) {
  if (!legacyRole) return false;
  const campaignId = await campaignIdForSlug(db, campaignSlug);
  await db.query(
    `
insert into campaign_members (campaign_id, profile_id, role)
values ($1::uuid, $2::uuid, $3)
on conflict (campaign_id, profile_id)
do update set role = excluded.role;`,
    [campaignId, profileId, legacyRole]
  );
  return true;
}

async function rbacAdminPayload(db, access, campaignSlug) {
  const roles = await data(
    `
select coalesce(json_agg(role_item order by role_item->>'plane', role_item->>'slug'), '[]'::json) data
from (
  select json_build_object(
    'id', rd.id,
    'slug', rd.slug,
    'name', rd.name,
    'plane', rd.plane,
    'description', rd.description,
    'isSystem', rd.is_system,
    'permissions', coalesce((
      select json_agg(json_build_object(
        'action', pc.action,
        'plane', pc.plane,
        'description', pc.description
      ) order by pc.action)
      from role_permissions rp
      join permission_catalog pc on pc.action = rp.permission_action
      where rp.role_id = rd.id
    ), '[]'::json)
  ) role_item
  from role_definitions rd
  where ($1::boolean or rd.plane <> 'technical')
) rows;`,
    [access.canManageTechnical],
    db
  ) || [];
  const profiles = await data(
    `
select coalesce(json_agg(profile_item order by lower(profile_item->>'displayName')), '[]'::json) data
from (
  select json_build_object(
    'id', p.id,
    'displayName', p.display_name,
    'roll20Name', p.roll20_name,
    'discordId', p.discord_id,
    'discordHandle', p.discord_handle,
    'email', p.email,
    'avatarUrl', p.avatar_url,
    'linked', p.auth_user_id is not null,
    'legacyCampaignRole', cm.role
  ) profile_item
  from profiles p
  left join campaigns c on c.slug = $1
  left join campaign_members cm on cm.profile_id = p.id and cm.campaign_id = c.id
) rows;`,
    [campaignSlug],
    db
  ) || [];
  const assignments = await data(
    `
select coalesce(json_agg(assignment_item order by assignment_item->>'scopeType', assignment_item->>'roleSlug', assignment_item->>'displayName'), '[]'::json) data
from (
  select json_build_object(
    'id', ra.id,
    'profileId', p.id,
    'displayName', p.display_name,
    'roll20Name', p.roll20_name,
    'discordHandle', p.discord_handle,
    'roleSlug', rd.slug,
    'roleName', rd.name,
    'plane', rd.plane,
    'scopeType', ra.scope_type,
    'scopeId', ra.scope_id,
    'status', ra.status,
    'startsAt', ra.starts_at,
    'endsAt', ra.ends_at,
    'reason', ra.reason,
    'assignedBy', assigner.display_name,
    'revokedBy', revoker.display_name,
    'createdAt', ra.created_at,
    'updatedAt', ra.updated_at
  ) assignment_item
  from role_assignments ra
  join role_definitions rd on rd.id = ra.role_id
  join profiles p on p.id = ra.profile_id
  left join profiles assigner on assigner.id = ra.assigned_by
  left join profiles revoker on revoker.id = ra.revoked_by
  where (
    $1::boolean
    or (ra.scope_type = 'campaign' and ra.scope_id = $2 and rd.plane <> 'technical')
  )
) rows;`,
    [access.canManageTechnical, campaignSlug],
    db
  ) || [];
  const dmTenures = await data(
    `
select coalesce(json_agg(tenure_item order by tenure_item->>'startedAt' desc), '[]'::json) data
from (
  select json_build_object(
    'id', dt.id,
    'campaignSlug', c.slug,
    'profileId', p.id,
    'displayName', p.display_name,
    'roll20Name', p.roll20_name,
    'discordHandle', p.discord_handle,
    'roleAssignmentId', dt.role_assignment_id,
    'tenureType', dt.tenure_type,
    'status', dt.status,
    'startedAt', dt.started_at,
    'endedAt', dt.ended_at,
    'appointedBy', appointed.display_name,
    'endedBy', ended.display_name,
    'reason', dt.reason
  ) tenure_item
  from dm_tenures dt
  join campaigns c on c.id = dt.campaign_id
  join profiles p on p.id = dt.profile_id
  left join profiles appointed on appointed.id = dt.appointed_by
  left join profiles ended on ended.id = dt.ended_by
  where c.slug = $1
) rows;`,
    [campaignSlug],
    db
  ) || [];
  return {
    ok: true,
    campaignSlug,
    projectScopeId: PROJECT_SCOPE_ID,
    viewer: {
      profileId: access.profileId,
      canManageTechnical: access.canManageTechnical,
      canManageCampaignAccess: access.canManageCampaignAccess
    },
    roles,
    profiles,
    assignments,
    dmTenures
  };
}

async function assignRbacRole(db, req, campaignSlug, raw) {
  const access = await rbacAdminAccess(req, campaignSlug);
  const profileId = cleanText(raw.profileId || raw.profile_id, 80);
  const roleSlug = cleanText(raw.roleSlug || raw.role_slug, 80);
  if (!profileId || !roleSlug) throw httpError(400, 'profileId e roleSlug sao obrigatorios.');
  if (roleSlug === 'campaign_dm') throw httpError(400, 'Use a transferencia de DM para atribuir campaign_dm.');
  if (!(await profileExists(db, profileId))) throw httpError(404, 'Perfil alvo nao encontrado.');
  const role = await roleDefinitionBySlug(db, roleSlug);
  const { scopeType, scopeId } = normalizeRbacScope(raw, campaignSlug, role);
  const isTechnicalAssignment = role.plane === 'technical' || scopeType === 'project';
  if (isTechnicalAssignment && !access.canManageTechnical) {
    throw httpError(403, 'Funcoes tecnicas exigem project.rbac.manage.');
  }
  if (!isTechnicalAssignment && !access.canManageCampaignAccess) {
    throw httpError(403, 'Funcoes da campanha exigem campaign.access.manage.');
  }
  const reason = cleanText(raw.reason, 1000) || 'Atribuicao feita pela administracao de funcoes.';
  const result = await db.query(
    `
insert into role_assignments (
  profile_id, role_id, scope_type, scope_id, status, starts_at, assigned_by, reason, metadata
)
values ($1::uuid, $2::uuid, $3, $4, 'active', now(), $5::uuid, $6, $7::jsonb)
on conflict (profile_id, role_id, scope_type, scope_id)
where status in ('active', 'eligible') and ends_at is null
do update set
  status = 'active',
  starts_at = least(role_assignments.starts_at, excluded.starts_at),
  assigned_by = excluded.assigned_by,
  reason = excluded.reason,
  metadata = coalesce(role_assignments.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now()
returning id;`,
    [
      profileId,
      role.id,
      scopeType,
      scopeId,
      access.profileId,
      reason,
      JSON.stringify({ source: 'rbac_admin_ui', action: 'assign_role' })
    ]
  );
  const legacyRole = scopeType === 'campaign' ? legacyRoleForRoleSlug(roleSlug) : null;
  const legacyMembershipUpdated = await syncLegacyCampaignMembership(db, campaignSlug, profileId, legacyRole);
  return {
    ok: true,
    assignmentId: result.rows[0].id,
    legacyMembershipUpdated,
    rbac: await rbacAdminPayload(db, access, campaignSlug)
  };
}

async function revokeRbacAssignment(db, req, campaignSlug, raw) {
  const access = await rbacAdminAccess(req, campaignSlug);
  const assignmentId = cleanText(raw.assignmentId || raw.assignment_id || raw.id, 80);
  if (!assignmentId) throw httpError(400, 'assignmentId obrigatorio.');
  const assignment = await data(
    `
select row_to_json(assignment_row) data
from (
  select ra.*, rd.slug role_slug, rd.plane role_plane
  from role_assignments ra
  join role_definitions rd on rd.id = ra.role_id
  where ra.id = $1::uuid
  limit 1
) assignment_row;`,
    [assignmentId],
    db
  );
  if (!assignment) throw httpError(404, 'Atribuicao nao encontrada.');
  if (assignment.role_slug === 'campaign_dm') {
    throw httpError(400, 'Use a transferencia de DM para encerrar campaign_dm ativo.');
  }
  const isTechnicalAssignment = assignment.role_plane === 'technical' || assignment.scope_type === 'project';
  if (isTechnicalAssignment && !access.canManageTechnical) {
    throw httpError(403, 'Revogar funcao tecnica exige project.rbac.manage.');
  }
  if (!isTechnicalAssignment && (assignment.scope_type !== 'campaign' || assignment.scope_id !== campaignSlug)) {
    throw httpError(403, 'Atribuicao fora do escopo desta campanha.');
  }
  if (!isTechnicalAssignment && !access.canManageCampaignAccess) {
    throw httpError(403, 'Revogar funcao da campanha exige campaign.access.manage.');
  }
  const reason = cleanText(raw.reason, 1000) || 'Revogacao feita pela administracao de funcoes.';
  await db.query(
    `
update role_assignments
set status = 'revoked',
    ends_at = greatest(coalesce(ends_at, now()), starts_at + interval '1 second'),
    revoked_by = $2::uuid,
    reason = $3,
    metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb,
    updated_at = now()
where id = $1::uuid;`,
    [
      assignmentId,
      access.profileId,
      reason,
      JSON.stringify({ source: 'rbac_admin_ui', action: 'revoke_role' })
    ]
  );
  return {
    ok: true,
    assignmentId,
    rbac: await rbacAdminPayload(db, access, campaignSlug)
  };
}

async function transferCampaignDm(db, req, campaignSlug, raw) {
  const access = await rbacAdminAccess(req, campaignSlug);
  if (!access.canManageCampaignAccess) {
    throw httpError(403, 'Transferir DM exige campaign.access.manage ou project.rbac.manage.');
  }
  const newProfileId = cleanText(raw.newProfileId || raw.new_profile_id || raw.profileId || raw.profile_id, 80);
  if (!newProfileId) throw httpError(400, 'newProfileId obrigatorio.');
  if (!(await profileExists(db, newProfileId))) throw httpError(404, 'Novo DM nao encontrado.');
  const reason = cleanText(raw.reason, 1000) || 'Transferencia de DM feita pela administracao de funcoes.';
  const campaignId = await campaignIdForSlug(db, campaignSlug);
  const role = await roleDefinitionBySlug(db, 'campaign_dm');

  await db.query(
    `
update dm_tenures
set status = 'ended',
    ended_at = greatest(coalesce(ended_at, now()), started_at + interval '1 second'),
    ended_by = $2::uuid,
    reason = $3,
    metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb,
    updated_at = now()
where campaign_id = $1::uuid
  and tenure_type = 'primary'
  and status = 'active'
  and ended_at is null;`,
    [
      campaignId,
      access.profileId,
      reason,
      JSON.stringify({ source: 'rbac_admin_ui', action: 'transfer_dm_end_previous' })
    ]
  );
  await db.query(
    `
update role_assignments
set status = 'ended',
    ends_at = greatest(coalesce(ends_at, now()), starts_at + interval '1 second'),
    revoked_by = $4::uuid,
    reason = $5,
    metadata = coalesce(metadata, '{}'::jsonb) || $6::jsonb,
    updated_at = now()
where role_id = $1::uuid
  and scope_type = 'campaign'
  and scope_id = $2
  and profile_id <> $3::uuid
  and status = 'active'
  and ends_at is null;`,
    [
      role.id,
      campaignSlug,
      newProfileId,
      access.profileId,
      reason,
      JSON.stringify({ source: 'rbac_admin_ui', action: 'transfer_dm_end_role' })
    ]
  );
  const assignmentResult = await db.query(
    `
insert into role_assignments (
  profile_id, role_id, scope_type, scope_id, status, starts_at, assigned_by, reason, metadata
)
values ($1::uuid, $2::uuid, 'campaign', $3, 'active', now(), $4::uuid, $5, $6::jsonb)
on conflict (profile_id, role_id, scope_type, scope_id)
where status in ('active', 'eligible') and ends_at is null
do update set
  status = 'active',
  assigned_by = excluded.assigned_by,
  reason = excluded.reason,
  metadata = coalesce(role_assignments.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now()
returning id;`,
    [
      newProfileId,
      role.id,
      campaignSlug,
      access.profileId,
      reason,
      JSON.stringify({ source: 'rbac_admin_ui', action: 'transfer_dm_assign_role' })
    ]
  );
  await db.query(
    `
insert into dm_tenures (
  campaign_id, profile_id, role_assignment_id, tenure_type, status, started_at, appointed_by, reason, metadata
)
values ($1::uuid, $2::uuid, $3::uuid, 'primary', 'active', now(), $4::uuid, $5, $6::jsonb);`,
    [
      campaignId,
      newProfileId,
      assignmentResult.rows[0].id,
      access.profileId,
      reason,
      JSON.stringify({ source: 'rbac_admin_ui', action: 'transfer_dm_start_tenure' })
    ]
  );
  await db.query(
    `
update campaign_members
set role = 'player'
where campaign_id = $1::uuid
  and profile_id <> $2::uuid
  and role = 'master';`,
    [campaignId, newProfileId]
  );
  await db.query(
    `
insert into campaign_members (campaign_id, profile_id, role)
values ($1::uuid, $2::uuid, 'master')
on conflict (campaign_id, profile_id)
do update set role = 'master';`,
    [campaignId, newProfileId]
  );
  return {
    ok: true,
    newProfileId,
    roleAssignmentId: assignmentResult.rows[0].id,
    rbac: await rbacAdminPayload(db, access, campaignSlug)
  };
}

function roll20BridgeToken() {
  return cleanText(process.env.ROLL20_BRIDGE_TOKEN || process.env.DND_ROLL20_BRIDGE_TOKEN || '', 500);
}

function timingSafeEqualText(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function roll20BridgeRequestToken(req, raw = {}) {
  const auth = cleanText(req.headers.authorization || req.headers.Authorization || '', 700);
  if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();
  return cleanText(
    req.headers['x-dnd-roll20-token']
      || req.headers['x-roll20-bridge-token']
      || raw.bridgeToken
      || raw.bridge_token
      || '',
    700
  );
}

function requireRoll20BridgeAccess(req, raw = {}) {
  const expected = roll20BridgeToken();
  if (!expected) throw httpError(409, 'ROLL20_BRIDGE_TOKEN ausente no ambiente de producao.');
  const supplied = roll20BridgeRequestToken(req, raw);
  if (!timingSafeEqualText(supplied, expected)) throw httpError(401, 'Token da ponte Roll20 invalido.');
  return {
    source: 'roll20_bridge',
    displayName: 'Roll20 Bridge',
    role: 'integration'
  };
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function textFromRoll20Html(value, max = 4000) {
  return cleanText(
    decodeHtmlEntities(String(value || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')),
    max
  );
}

function roll20InlineRollTotal(roll) {
  const candidates = [
    roll?.results?.total,
    roll?.result?.total,
    roll?.total,
    roll?.value
  ];
  for (const candidate of candidates) {
    const number = Number(candidate);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function roll20BridgeDiceRoll(message = {}, text = '') {
  const inline = Array.isArray(message.inlinerolls) ? message.inlinerolls : [];
  const formula = cleanText(
    message.origRoll
      || message.orig_roll
      || message.formula
      || inline.find(item => cleanText(item.expression, 240))?.expression
      || '',
    240
  );
  const total = roll20InlineRollTotal(inline[0]);
  const source = [
    formula || text,
    total !== null ? `= ${total}` : ''
  ].filter(Boolean).join(' ');
  const parsed = parseRoll20DiceRoll(source || text);
  if (!parsed && !formula && total === null) return null;
  return {
    ...(parsed || {}),
    raw: text || parsed?.raw || '',
    formula: formula || parsed?.formula || null,
    result: total !== null ? total : (parsed?.result ?? null),
    roll20Type: cleanText(message.type, 40) || null,
    inlineRollCount: inline.length
  };
}

function roll20BridgeRawMessages(raw = {}) {
  const events = Array.isArray(raw.events) ? raw.events : null;
  const messages = Array.isArray(raw.messages) ? raw.messages : null;
  const payload = events || messages || [];
  return payload.slice(0, ROLL20_BRIDGE_MAX_EVENTS);
}

function roll20BridgeEventId(packet = {}, message = {}, index = 0) {
  const explicit = cleanText(
    packet.sourceEventId
      || packet.source_event_id
      || packet.id
      || message.sourceEventId
      || message.source_event_id
      || message.id
      || '',
    180
  );
  if (explicit) return explicit.startsWith('roll20-') ? explicit : `roll20-bridge-${explicit}`;
  const seed = JSON.stringify({
    seq: packet.seq ?? message.seq ?? null,
    emittedAt: packet.emittedAt || packet.receivedAt || message.timestamp || null,
    who: message.who || null,
    playerid: message.playerid || null,
    type: message.type || null,
    content: String(message.content || '').slice(0, 500),
    index
  });
  const hash = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 18);
  return `roll20-bridge-${hash}`;
}

function roll20BridgeParsedEvent(packet = {}, index = 0, options = {}) {
  const message = packet.message || packet.msg || packet;
  const type = cleanText(message.type || packet.type || 'general', 40).toLowerCase();
  const speaker = cleanText(message.who || message.speaker || packet.who || packet.speaker || '', 160) || null;
  const playerId = cleanText(message.playerid || message.playerId || packet.playerid || packet.playerId || '', 100) || null;
  const text = textFromRoll20Html(message.content ?? packet.content ?? packet.text ?? '', 4000);
  const rawLine = cleanText(packet.rawLine || `${speaker ? `${speaker}: ` : ''}${text}`, 5000);
  const receivedAt = cleanText(packet.emittedAt || packet.receivedAt || packet.createdAt || packet.timestamp || new Date().toISOString(), 80);
  const sourceEventId = roll20BridgeEventId(packet, message, index);
  const isCommand = text.startsWith(options.prefix || '!dnd');
  const diceRoll = ['rollresult', 'gmrollresult'].includes(type) || Array.isArray(message.inlinerolls) || /\b\d+d\d+\b|\[\[/.test(text)
    ? roll20BridgeDiceRoll(message, text)
    : null;

  let parsed = null;
  if (isCommand) {
    parsed = parseRoll20ChatText(rawLine, {
      prefix: options.prefix,
      includePlain: true,
      includeRolls: true,
      syncStartClock: options.syncStartClock
    })[0] || null;
  }
  if (!parsed) {
    parsed = {
      sourceKind: diceRoll ? 'dice_roll' : 'chat_message',
      speaker,
      command: diceRoll ? 'roll' : 'chat',
      args: {},
      positional: [],
      rawCommand: '',
      rawLine,
      rawMessage: text,
      lineClock: null,
      lineClockSeconds: null,
      approxStartMs: null,
      diceRoll,
      valid: true,
      error: null
    };
  }

  return {
    ...parsed,
    sourceEventId,
    createdAtRoll20: receivedAt,
    playerId,
    roll20MessageType: type,
    roll20BridgePacket: {
      version: cleanText(packet.version || options.version || '', 40) || null,
      seq: packet.seq ?? message.seq ?? null,
      playerId,
      type,
      rolltemplate: cleanText(message.rolltemplate || message.rollTemplate || '', 120) || null,
      target: cleanText(message.target || '', 120) || null,
      targetName: cleanText(message.target_name || message.targetName || '', 180) || null,
      inlineRollCount: Array.isArray(message.inlinerolls) ? message.inlinerolls.length : 0
    }
  };
}

function roll20BridgeNormalizeEvents(raw = {}, options = {}) {
  const parsed = roll20BridgeRawMessages(raw).map((packet, index) => roll20BridgeParsedEvent(packet, index, options));
  return normalizeRoll20Events(parsed, {
    campaignSlug: options.campaignSlug,
    receivedAt: raw.receivedAt || raw.received_at || undefined
  }).map((event, index) => {
    const parsedEvent = parsed[index] || {};
    return {
      ...event,
      sourceEventId: parsedEvent.sourceEventId,
      createdAtRoll20: parsedEvent.createdAtRoll20,
      playerId: parsedEvent.playerId || null,
      payload: {
        ...(event.payload || {}),
        bridge: parsedEvent.roll20BridgePacket || null
      }
    };
  });
}

async function roll20IngestPreviewPayload(req, campaign, raw) {
  const access = await requireCampaignAccess(req, campaign, ['owner', 'master']);
  const prefix = cleanText(raw.prefix || process.env.ROLL20_COMMAND_PREFIX || '!dnd', 20) || '!dnd';
  const source = cleanText(raw.source || 'copy-paste', 80) || 'copy-paste';
  const sourceSessionId = cleanText(raw.sourceSessionId || raw.source_session_id, 180) || null;
  const text = String(raw.text || raw.chatText || raw.chat_text || '').slice(0, 1024 * 1024);
  const includePlain = Boolean(raw.includePlain || raw.include_plain || raw.capturePlain || raw.capture_plain);
  const includeRolls = Boolean(raw.includeRolls || raw.include_rolls || raw.captureRolls || raw.capture_rolls);
  const syncStartClock = cleanText(raw.syncStartClock || raw.sync_start_clock || raw.sessionStartClock || raw.session_start_clock, 40);

  if (!text.trim()) throw httpError(400, 'text obrigatorio com chat copiado/exportado do Roll20.');

  const parsed = parseRoll20ChatText(text, { prefix, includePlain, includeRolls, syncStartClock });
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
    includePlain,
    includeRolls,
    syncStartClock: syncStartClock || null,
    actor: {
      profileId: access.profile?.id || null,
      displayName: access.profile?.displayName || access.user?.displayName || null,
      role: access.campaignRole || null
    },
    summary: summarizeRoll20Events(events),
    events
  };
}

async function roll20BridgePayload(req, campaign, raw) {
  const actor = requireRoll20BridgeAccess(req, raw);
  const prefix = cleanText(raw.prefix || process.env.ROLL20_COMMAND_PREFIX || '!dnd', 20) || '!dnd';
  const sourceSessionId = cleanText(raw.sourceSessionId || raw.source_session_id, 180) || null;
  const syncStartClock = cleanText(raw.syncStartClock || raw.sync_start_clock || raw.sessionStartClock || raw.session_start_clock, 40);
  const events = roll20BridgeNormalizeEvents(raw, {
    campaignSlug: campaign,
    prefix,
    syncStartClock,
    version: raw.version || raw.bridgeVersion || raw.bridge_version
  });

  if (!sourceSessionId) throw httpError(400, 'sourceSessionId obrigatorio para ponte Roll20.');
  if (!events.length) throw httpError(400, 'events obrigatorio com ao menos um pacote Roll20.');

  return {
    ok: true,
    mode: 'roll20_bridge',
    dryRun: raw.dryRun === true,
    campaignSlug: campaign,
    sourceSessionId,
    source: 'roll20-bridge',
    prefix,
    includePlain: true,
    includeRolls: true,
    syncStartClock: syncStartClock || null,
    actor,
    bridge: {
      version: cleanText(raw.version || raw.bridgeVersion || raw.bridge_version || '', 40) || null,
      batchId: cleanText(raw.batchId || raw.batch_id || '', 120) || null,
      receivedAt: new Date().toISOString(),
      eventLimit: ROLL20_BRIDGE_MAX_EVENTS
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
  const dice = event.diceRoll || event.dice_roll || event.payload?.diceRoll || null;
  if (dice?.formula || (dice?.result !== null && dice?.result !== undefined)) {
    return cleanText([
      event.speaker ? `${event.speaker}:` : '',
      'rolagem',
      dice.formula || '',
      dice.result !== null && dice.result !== undefined ? `= ${dice.result}` : '',
      event.text || event.rawMessage || ''
    ].filter(Boolean).join(' '), 3000);
  }
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

function roll20DiceTimelineTitle(event = {}) {
  const dice = event.payload?.diceRoll || event.diceRoll || null;
  if (!dice) return null;
  return [dice.formula || 'dados', dice.result !== null && dice.result !== undefined ? `= ${dice.result}` : ''].filter(Boolean).join(' ');
}

function roll20CreatedAt(event = {}, session = {}, raw = {}) {
  const explicit = cleanText(event.createdAtRoll20 || event.created_at_roll20 || raw.receivedAt || raw.received_at, 80);
  if (explicit) return explicit;
  const started = dateMs(session.started_at || session.startedAt);
  const offset = event.approxStartMs ?? event.approx_start_ms;
  if (started !== null && offset !== null && offset !== undefined && Number.isFinite(Number(offset))) {
    return new Date(started + Number(offset)).toISOString();
  }
  return null;
}

function roll20ApproxStartMs(event = {}, session = {}, createdAt = null) {
  const explicit = event.approxStartMs ?? event.approx_start_ms;
  if (explicit !== null && explicit !== undefined && Number.isFinite(Number(explicit))) return Number(explicit);
  const started = dateMs(session.started_at || session.startedAt);
  const created = dateMs(createdAt);
  if (started !== null && created !== null && created >= started) return Math.round(created - started);
  return null;
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
    const estimatedCreatedAt = roll20CreatedAt(event, session, raw);
    const approxStartMs = roll20ApproxStartMs(event, session, estimatedCreatedAt);
    const eventPayload = {
      ...event,
      timeline: {
        approxStartMs,
        estimatedCreatedAt,
        timingMode: approxStartMs !== null && approxStartMs !== undefined
          ? 'roll20_clock_from_session_start'
          : 'roll20_unsynced'
      },
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
  gen_random_uuid(), $1::uuid, $2, $3, $4, $10::integer,
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
  approx_start_ms = excluded.approx_start_ms,
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
        estimatedCreatedAt,
        approxStartMs
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
        includeInvalid,
        includePlain: Boolean(payload.includePlain),
        includeRolls: Boolean(payload.includeRolls),
        syncStartClock: payload.syncStartClock || null
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

function roll20NoteDefaults(event) {
  const type = event.event_type || '';
  if (type === 'canon_candidate') return { noteType: 'canon', visibility: 'dm_review' };
  if (type === 'dm_backstage_note') return { noteType: 'backstage', visibility: 'dm_review' };
  if (type === 'character_action_candidate') return { noteType: 'note', visibility: 'table_private' };
  if (type === 'audio_processing_hint') return { noteType: 'note', visibility: 'dm_review' };
  return { noteType: 'note', visibility: 'dm_review' };
}

function roll20NoteContent(event, raw) {
  return cleanText(
    raw.content
      || event.text
      || event.payload?.text
      || event.payload?.args?.motivo
      || event.payload?.args?.titulo
      || event.payload?.rawCommand
      || event.raw_line,
    5000
  );
}

async function convertRoll20EventToNote(db, req, campaign, raw) {
  const access = await requireCampaignAccess(req, campaign, ['owner', 'master', 'reviewer']);
  const eventId = cleanText(raw.eventId || raw.event_id || raw.id, 120);
  if (!eventId) throw httpError(400, 'eventId obrigatorio.');

  const event = await data(
    `
select row_to_json(event_row) data from (
  select re.*, s.source_session_id, c.slug campaign_slug
  from roll20_events re
  join sessions s on s.id = re.session_id
  join campaigns c on c.id = s.campaign_id
  where c.slug = $1 and re.id = $2::uuid
  limit 1
) event_row;`,
    [campaign, eventId],
    db
  );
  if (!event) throw httpError(404, 'Evento Roll20 nao encontrado nesta campanha.');

  const defaults = roll20NoteDefaults(event);
  const noteType = cleanText(raw.noteType || raw.note_type || defaults.noteType, 40) || defaults.noteType;
  const visibility = cleanText(raw.visibility || defaults.visibility, 40) || defaults.visibility;
  const content = roll20NoteContent(event, raw);
  if (!content) throw httpError(400, 'Evento Roll20 sem conteudo para nota.');

  const sourceId = `roll20-note:${event.id}`;
  const tags = Array.from(new Set([
    'roll20',
    noteType,
    event.event_type || '',
    ...(Array.isArray(raw.tags) ? raw.tags : [])
  ].map(item => cleanText(item, 40)).filter(Boolean)));
  const result = await db.query(
    `
insert into table_notes (
  campaign_id, session_id, source_system, source_id, note_type, visibility,
  author_profile_id, author_discord_id, author_name, content, tags, metadata
)
select c.id, re.session_id, 'roll20', $3, $4, $5,
       $6::uuid, $7, $8, $9, $10::text[], $11::jsonb
from roll20_events re
join sessions s on s.id = re.session_id
join campaigns c on c.id = s.campaign_id
where c.slug = $1 and re.id = $2::uuid
on conflict (source_system, source_id)
do update set
  note_type = excluded.note_type,
  visibility = excluded.visibility,
  content = excluded.content,
  tags = excluded.tags,
  metadata = excluded.metadata
returning id, note_type, visibility, review_status, content;`,
    [
      campaign,
      event.id,
      sourceId,
      noteType,
      visibility,
      access.profile?.id || null,
      access.user?.discord?.id || null,
      access.profile?.displayName || access.user?.displayName || null,
      content,
      tags,
      JSON.stringify({
        source: 'roll20_event_conversion',
        roll20EventId: event.id,
        sourceEventId: event.source_event_id,
        eventType: event.event_type,
        sourceSessionId: event.source_session_id,
        convertedBy: {
          profileId: access.profile?.id || null,
          displayName: access.profile?.displayName || access.user?.displayName || null,
          role: access.campaignRole || null
        },
        raw: raw || null
      })
    ]
  );

  return {
    ok: true,
    mode: 'roll20_event_note',
    campaignSlug: campaign,
    sourceSessionId: event.source_session_id,
    event: {
      id: event.id,
      sourceEventId: event.source_event_id,
      eventType: event.event_type,
      speaker: event.roll20_who,
      characterName: event.character_name
    },
    note: result.rows[0]
  };
}

function discordBotToken() {
  return cleanText(process.env.DISCORD_BOT_TOKEN || '', 500);
}

function discordApiUserAgent() {
  return cleanText(process.env.DISCORD_USER_AGENT || 'DnD-Scribe (https://dnd.faysk.dev, 0.1)', 240);
}

function discordChannelIdForTarget(target = 'dnd') {
  const normalized = cleanText(target, 40).toLowerCase();
  if (normalized === 'recording' || normalized === 'recordings' || normalized === 'gravacoes') {
    return cleanText(process.env.DISCORD_RECORDINGS_CHANNEL_ID || '', 80);
  }
  if (normalized === 'ops' || normalized === 'logs' || normalized === 'admin') {
    return cleanText(process.env.DISCORD_OPS_CHANNEL_ID || '', 80);
  }
  return cleanText(process.env.DISCORD_DND_CHANNEL_ID || '', 80);
}

function limitedInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

function dateMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function discordAttachmentSummary(message = {}) {
  return (message.attachments || [])
    .map(item => [item.filename || item.id || 'anexo', item.url || item.proxy_url || ''].filter(Boolean).join(' '))
    .filter(Boolean)
    .join('\n');
}

function discordCursorOptions(body = {}) {
  const around = cleanText(body.around || body.aroundMessageId || body.around_message_id, 80);
  const before = cleanText(body.before || body.beforeMessageId || body.before_message_id, 80);
  const after = cleanText(body.after || body.afterMessageId || body.after_message_id, 80);
  if (around) return { mode: 'around', messageId: around, query: { around } };
  if (before) return { mode: 'before', messageId: before, query: { before } };
  if (after) return { mode: 'after', messageId: after, query: { after } };
  return { mode: 'latest', messageId: null, query: {} };
}

function discordMessageRefs(messages = []) {
  return messages
    .map(message => ({
      id: cleanText(message.id, 80),
      createdAt: cleanText(message.timestamp || message.created_at || message.createdAt, 80),
      hasContent: Boolean(cleanText(message.content || message.text || '', 20)),
      attachmentCount: Array.isArray(message.attachments) ? message.attachments.length : 0
    }))
    .filter(message => message.id)
    .sort((a, b) => {
      const aTime = dateMs(a.createdAt) || 0;
      const bTime = dateMs(b.createdAt) || 0;
      if (aTime !== bTime) return aTime - bTime;
      return String(a.id).localeCompare(String(b.id));
    });
}

function discordSyncWindow(rawMessages = [], acceptedMessages = [], { channelId = '', limit = 50, cursor = {} } = {}) {
  const rawRefs = discordMessageRefs(rawMessages);
  const acceptedRefs = discordMessageRefs(acceptedMessages.map(message => ({
    id: message.id,
    createdAt: message.createdAt,
    content: message.content,
    attachments: message.metadata?.discord?.attachments || []
  })));
  const oldest = rawRefs[0] || null;
  const newest = rawRefs[rawRefs.length - 1] || null;
  const acceptedOldest = acceptedRefs[0] || null;
  const acceptedNewest = acceptedRefs[acceptedRefs.length - 1] || null;
  const contentVisible = rawRefs.filter(message => message.hasContent || message.attachmentCount > 0).length;
  const attachmentCount = rawRefs.reduce((total, message) => total + message.attachmentCount, 0);
  return {
    channelId,
    limit,
    cursorMode: cursor.mode || 'latest',
    cursorMessageId: cursor.messageId || null,
    fetched: rawMessages.length,
    contentVisible,
    attachmentCount,
    oldestMessageId: oldest?.id || null,
    newestMessageId: newest?.id || null,
    oldestCreatedAt: oldest?.createdAt || null,
    newestCreatedAt: newest?.createdAt || null,
    acceptedOldestMessageId: acceptedOldest?.id || null,
    acceptedNewestMessageId: acceptedNewest?.id || null,
    acceptedOldestCreatedAt: acceptedOldest?.createdAt || null,
    acceptedNewestCreatedAt: acceptedNewest?.createdAt || null,
    canLoadOlder: Boolean(oldest?.id && rawMessages.length >= limit),
    canCheckNewer: Boolean(newest?.id)
  };
}

function normalizedDiscordMessage(message = {}, { sessionStartedAt = null, sessionEndedAt = null, includeBeforeStart = false, includeAfterEnd = false } = {}) {
  const id = cleanText(message.id, 80);
  const createdAt = cleanText(message.timestamp || message.created_at || message.createdAt, 80);
  const author = message.author || {};
  const authorName = cleanText(author.global_name || author.username || author.name || message.author_name || message.authorName, 180);
  const authorId = cleanText(author.id || message.author_discord_id || message.authorDiscordId, 80);
  const text = cleanText(message.content || message.text || '', 1800);
  const attachmentText = discordAttachmentSummary(message);
  const content = cleanText([text, attachmentText].filter(Boolean).join('\n'), 1800);
  if (!id || !createdAt || !content) return null;

  const createdMs = dateMs(createdAt);
  const offsetMs = createdMs !== null && sessionStartedAt !== null
    ? Math.round(createdMs - sessionStartedAt)
    : null;
  if (offsetMs !== null && offsetMs < 0 && !includeBeforeStart) return null;
  if (createdMs !== null && sessionEndedAt !== null && createdMs > sessionEndedAt && !includeAfterEnd) return null;
  const startMs = offsetMs !== null && offsetMs >= 0 ? offsetMs : null;

  return {
    id,
    sourceId: `discord-message:${id}`,
    createdAt,
    authorId,
    authorName,
    content,
    startMs,
    metadata: {
      discord: {
        messageId: id,
        channelId: cleanText(message.channel_id || message.channelId, 80),
        guildId: cleanText(message.guild_id || message.guildId, 80),
        authorId,
        authorName,
        createdAt,
        editedAt: cleanText(message.edited_timestamp || message.editedAt, 80) || null,
        attachments: (message.attachments || []).map(item => ({
          id: item.id || null,
          filename: item.filename || null,
          contentType: item.content_type || item.contentType || null,
          size: item.size || null,
          url: item.url || null
        }))
      },
      timeline: {
        startMs,
        timingMode: startMs === null
          ? (offsetMs !== null && offsetMs < 0 ? 'discord_timestamp_before_session_start' : 'discord_timestamp_unsynced')
          : 'discord_timestamp_from_session_start'
      },
      source: 'discord_channel_sync'
    }
  };
}

function sessionEndMs(session = {}, fallbackStartedMs = null) {
  const explicitEnd = dateMs(session.ended_at || session.endedAt);
  if (explicitEnd !== null) return explicitEnd;
  const started = fallbackStartedMs ?? dateMs(session.started_at || session.startedAt);
  const duration = Number(session.duration_ms || session.durationMs || 0);
  if (started !== null && Number.isFinite(duration) && duration > 0) return started + duration;
  return null;
}

async function fetchDiscordChannelMessages(channelId, options = {}) {
  const token = discordBotToken();
  if (!token) throw httpError(409, 'DISCORD_BOT_TOKEN ausente no ambiente de producao.');
  if (!channelId) throw httpError(400, 'Canal Discord nao configurado.');

  const query = new URLSearchParams({ limit: String(options.limit || 50) });
  for (const key of ['before', 'after', 'around']) {
    const value = cleanText(options[key] || '', 80);
    if (value) query.set(key, value);
  }

  const response = await fetch(`${DISCORD_API}/channels/${channelId}/messages?${query.toString()}`, {
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': discordApiUserAgent()
    }
  });
  const body = await response.text().catch(() => '');
  if (!response.ok) {
    const detail = cleanText(body, 260);
    if (response.status === 401) throw httpError(401, 'Token do bot Discord recusado pela API.');
    if (response.status === 403) throw httpError(403, 'Bot sem permissao para ler historico deste canal Discord.');
    throw httpError(response.status, `Falha ao buscar mensagens do Discord: ${detail || response.status}`);
  }
  let parsed;
  try {
    parsed = body ? JSON.parse(body) : [];
  } catch (_error) {
    throw httpError(502, 'Resposta invalida da API do Discord.');
  }
  if (!Array.isArray(parsed)) throw httpError(502, 'Resposta inesperada da API do Discord.');
  return parsed;
}

async function fetchDiscordChannelMessagePages(channelId, options = {}) {
  const limit = limitedInteger(options.limit, 50, 1, DISCORD_SYNC_MAX_MESSAGES);
  const maxPages = limitedInteger(options.maxPages, 1, 1, DISCORD_SYNC_MAX_PAGES);
  const raw = [];
  const seen = new Set();
  const pages = [];
  let before = cleanText(options.before || '', 80);
  for (let index = 0; index < maxPages; index += 1) {
    const page = await fetchDiscordChannelMessages(channelId, {
      limit,
      before: before || undefined
    });
    const refs = discordMessageRefs(page);
    pages.push(discordSyncWindow(page, page, {
      channelId,
      limit,
      cursor: { mode: before ? 'before' : 'latest', messageId: before || null }
    }));
    for (const message of page) {
      const id = cleanText(message.id, 80);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      raw.push(message);
    }
    const oldest = refs[0] || null;
    before = oldest?.id || '';
    const oldestMs = dateMs(oldest?.createdAt);
    if (!before || page.length < limit) break;
    if (options.sessionStartedAt !== null && oldestMs !== null && oldestMs < options.sessionStartedAt) break;
  }
  return { messages: raw, pages };
}

async function persistDiscordMessages(db, campaign, sourceSessionId, body, access) {
  const channelId = cleanText(body.channelId || body.channel_id || discordChannelIdForTarget(body.channel || body.target || 'dnd'), 80);
  const limit = limitedInteger(body.limit, 50, 1, DISCORD_SYNC_MAX_MESSAGES);
  const maxPages = limitedInteger(body.maxPages || body.max_pages, 1, 1, DISCORD_SYNC_MAX_PAGES);
  const syncMode = cleanText(body.syncMode || body.sync_mode || body.mode || 'page', 40).toLowerCase();
  const cursor = discordCursorOptions(body);
  const session = await data(`${targetCte()} select row_to_json(target) data from target;`, [campaign, sourceSessionId], db);
  if (!session) throw httpError(404, `Sessao nao encontrada: ${sourceSessionId}`);

  const suppliedMessages = Array.isArray(body.messages) ? body.messages : null;
  const sessionStartedAt = dateMs(body.sessionStartedAt || body.session_started_at || session.started_at);
  const sessionEndedAt = sessionEndMs(session, sessionStartedAt);
  let pages = [];
  let rawMessages = suppliedMessages || null;
  if (!rawMessages) {
    if (['session', 'session_window', 'full_session'].includes(syncMode) && cursor.mode === 'latest') {
      const paged = await fetchDiscordChannelMessagePages(channelId, {
        limit,
        maxPages,
        sessionStartedAt
      });
      rawMessages = paged.messages;
      pages = paged.pages;
    } else {
      rawMessages = await fetchDiscordChannelMessages(channelId, {
        limit,
        ...cursor.query
      });
    }
  }

  const includeBeforeStart = body.includeBeforeStart === true || body.include_before_start === true;
  const includeAfterEnd = body.includeAfterEnd === true || body.include_after_end === true;
  const visibleRawMessages = rawMessages.filter(message => {
    const text = cleanText(message.content || message.text || '', 20);
    const attachments = Array.isArray(message.attachments) ? message.attachments.length : 0;
    return Boolean(text || attachments);
  }).length;
  const messages = rawMessages
    .map(message => normalizedDiscordMessage({ ...message, channel_id: message.channel_id || channelId }, {
      sessionStartedAt,
      sessionEndedAt,
      includeBeforeStart,
      includeAfterEnd
    }))
    .filter(Boolean)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  const dryRun = body.dryRun === true;
  const visibility = cleanText(body.visibility || 'dm_review', 40) || 'dm_review';
  const noteType = cleanText(body.noteType || body.note_type || 'discord_message', 40) || 'discord_message';
  const result = {
    ok: true,
    mode: dryRun ? 'discord_sync_preview' : 'discord_sync_persisted',
    dryRun,
    campaignSlug: campaign,
    sourceSessionId,
    channelId,
    syncMode,
    maxPages,
    fetched: rawMessages.length,
    accepted: messages.length,
    skipped: rawMessages.length - messages.length,
    persisted: 0,
    updated: 0,
    sessionStartedAt: session.started_at || null,
    sessionEndedAt: session.ended_at || (sessionEndedAt ? new Date(sessionEndedAt).toISOString() : null),
    includeBeforeStart,
    includeAfterEnd,
    cursor: {
      mode: cursor.mode,
      messageId: cursor.messageId
    },
    pages,
    window: discordSyncWindow(rawMessages, messages, { channelId, limit, cursor }),
    timing: sessionStartedAt === null ? 'unsynced' : 'synced_from_session_started_at',
    warning: rawMessages.length && !messages.length
      ? (visibleRawMessages
        ? 'Discord retornou mensagens com conteudo, mas nenhuma ficou dentro da janela temporal da sessao. Use Janela da sessao, incluir antes/depois, ou um cursor mais antigo.'
        : 'Discord retornou mensagens sem texto/anexo. Valide Message Content Intent ou use o comando de contexto para salvar mensagens importantes.')
      : null
  };
  if (dryRun || !messages.length) return { ...result, messages: messages.slice(0, 10) };

  for (const message of messages) {
    const metadata = {
      ...message.metadata,
      sync: {
        syncedByProfileId: access.profile?.id || null,
        syncedByDisplayName: access.profile?.displayName || access.user?.displayName || null,
        syncedAt: new Date().toISOString(),
        syncMode,
        channelId,
        maxPages,
        sessionStartedAt: session.started_at || null,
        sessionEndedAt: session.ended_at || (sessionEndedAt ? new Date(sessionEndedAt).toISOString() : null)
      }
    };
    const upsert = await db.query(
      `
insert into table_notes (
  campaign_id, session_id, source_system, source_id, note_type, visibility,
  author_profile_id, author_discord_id, author_name, content, tags, metadata
)
select $1::uuid, $2::uuid, 'discord', $3, $4, $5,
       p.id, nullif($6, ''), nullif($7, ''), $8, $9::text[], $10::jsonb
from (select 1) seed
left join profiles p on p.discord_id = nullif($6, '')
on conflict (source_system, source_id)
do update set
  session_id = excluded.session_id,
  note_type = excluded.note_type,
  content = excluded.content,
  tags = excluded.tags,
  metadata = excluded.metadata
returning (xmax = 0) inserted;`,
      [
        session.campaign_id,
        session.session_id,
        message.sourceId,
        noteType,
        visibility,
        message.authorId,
        message.authorName,
        message.content,
        ['discord', 'channel-sync', noteType],
        JSON.stringify(metadata)
      ]
    );
    if (upsert.rows[0]?.inserted) result.persisted += 1;
    else result.updated += 1;
  }
  return result;
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

async function deleteR2Object(bucket, key) {
  const response = await fetch(createR2SignedUrl(key, 300, bucket, 'DELETE'), {
    method: 'DELETE'
  });
  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw httpError(502, `Falha ao deletar objeto R2 (${response.status}): ${message.slice(0, 200)}`);
  }
  return {
    ok: true,
    status: response.status
  };
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

function normalizeCleanupLimit(value) {
  const limit = Number(value || 5);
  if (!Number.isFinite(limit) || limit <= 0) return 5;
  return Math.max(1, Math.min(20, Math.floor(limit)));
}

async function selectCleanupCandidates(db, campaign, limit, requireLifecycleReady = true, sourceSessionId = '') {
  const result = await db.query(
    `
select cleanup.*
from audio_storage_cleanup_candidates cleanup
join sessions s on s.id = cleanup.session_id
join campaigns c on c.id = s.campaign_id
where c.slug = $1
  and cleanup.readiness_status = 'delete_ready'
  and ($3::boolean is false or cleanup.lifecycle_status = 'delete_ready')
  and ($4::text = '' or cleanup.source_session_id = $4::text)
order by cleanup.reclaimable_bytes desc, cleanup.updated_at asc
limit $2::integer;`,
    [campaign, limit, requireLifecycleReady, cleanText(sourceSessionId || '', 180)]
  );
  return result.rows;
}

async function refreshCleanupReadiness(db, campaign, actor, sourceSessionId = '') {
  const result = await db.query(
    `
with ready as (
  select cleanup.artifact_id, cleanup.reclaimable_bytes
  from audio_storage_cleanup_candidates cleanup
  join sessions s on s.id = cleanup.session_id
  join campaigns c on c.id = s.campaign_id
  where c.slug = $1
    and cleanup.readiness_status = 'delete_ready'
    and cleanup.lifecycle_status in ('active', 'superseded')
    and ($3::text = '' or cleanup.source_session_id = $3::text)
), updated as (
  update audio_artifacts aa
  set lifecycle_status = 'delete_ready',
      delete_reason = coalesce(aa.delete_reason, 'cleanup_readiness_policy'),
      metadata = coalesce(aa.metadata, '{}'::jsonb) || jsonb_build_object(
        'marked_delete_ready_by', 'api/storage/cleanup-run',
        'marked_delete_ready_at', now(),
        'marked_delete_ready_actor', $2::text
      ),
      updated_at = now()
  from ready
  where aa.id = ready.artifact_id
  returning aa.id, ready.reclaimable_bytes
), event_rows as (
  insert into audio_artifact_events (artifact_id, event_type, note, payload)
  select
    updated.id,
    'marked_delete_ready',
    'Marked delete_ready by cleanup runner refresh; no R2 object was deleted.',
    jsonb_build_object(
      'source', 'api/storage/cleanup-run',
      'actor', $2::text,
      'reclaimable_bytes', updated.reclaimable_bytes
    )
  from updated
  returning artifact_id
)
select count(*)::int objects, coalesce(sum(reclaimable_bytes), 0)::bigint bytes
from updated;`,
    [campaign, String(actor || 'unknown'), cleanText(sourceSessionId || '', 180)]
  );
  const row = result.rows[0] || {};
  return {
    objects: Number(row.objects || 0),
    bytes: Number(row.bytes || 0)
  };
}

async function runStorageCleanup(req, campaign, body) {
  const access = await requirePermission(req, campaign, {
    action: 'project.jobs.run',
    scopeType: 'project',
    scopeId: PROJECT_SCOPE_ID,
    legacyRoles: ['owner', 'master'],
    error: 'Limpeza de storage exige permissao project.jobs.run.'
  });
  const dryRun = body.dryRun !== false;
  const limit = normalizeCleanupLimit(body.limit || body.maxObjects);
  const sourceSessionId = cleanText(body.sourceSessionId || body.source_session_id || '', 180);
  if (!dryRun && body.confirm !== 'DELETE_READY_R2') {
    throw httpError(400, 'Execucao real exige confirm="DELETE_READY_R2".');
  }
  const db = getPool();
  const actorId = String(access.profile?.id || access.user?.id || access.user?.email || 'unknown');
  const readinessRefresh = dryRun
    ? { objects: 0, bytes: 0, dryRunSkipped: true }
    : await refreshCleanupReadiness(db, campaign, actorId, sourceSessionId);
  const candidates = await selectCleanupCandidates(db, campaign, limit, !dryRun, sourceSessionId);
  const summary = {
    ok: true,
    mode: 'storage_cleanup_delete_ready',
    dryRun,
    limit,
    sourceSessionId: sourceSessionId || null,
    candidateObjects: candidates.length,
    candidateBytes: candidates.reduce((total, item) => total + Number(item.reclaimable_bytes || item.size_bytes || 0), 0),
    readinessRefresh,
    deletedObjects: 0,
    deletedBytes: 0,
    failedObjects: 0,
    actor: {
      profileId: access.profile?.id || null,
      displayName: access.profile?.displayName || access.user?.displayName || null
    },
    objects: candidates.map(item => ({
      artifactId: item.artifact_id,
      sourceSessionId: item.source_session_id,
      artifactType: item.artifact_type,
      storageBucket: item.storage_bucket,
      storagePath: item.storage_path,
      sizeBytes: item.size_bytes,
      reclaimableBytes: item.reclaimable_bytes,
      readinessStatus: item.readiness_status
    })),
    failures: []
  };
  if (dryRun || !candidates.length) return summary;

  for (const item of candidates) {
    const claimed = await db.query(
      `
update audio_artifacts
set lifecycle_status = 'delete_queued',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'delete_queued_by', $2::text,
      'delete_queued_at', now()
    ),
    updated_at = now()
where id = $1::uuid
  and lifecycle_status = 'delete_ready'
returning id;`,
      [item.artifact_id, actorId]
    );
    if (!claimed.rows.length) continue;
    await db.query(
      `
insert into audio_artifact_events (artifact_id, event_type, actor_profile_id, note, payload)
values ($1::uuid, 'delete_queued', $2::uuid, 'Queued for R2 deletion by storage cleanup runner.', $3::jsonb);`,
      [
        item.artifact_id,
        access.profile?.id || null,
        JSON.stringify({ source: 'api/storage/cleanup-run', storage_path: item.storage_path })
      ]
    );
    try {
      await deleteR2Object(item.storage_bucket, item.storage_path);
      await db.query(
        `
update audio_artifacts
set lifecycle_status = 'deleted',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'deleted_by', $2::text,
      'deleted_at', now(),
      'delete_runner', 'api/storage/cleanup-run'
    ),
    updated_at = now()
where id = $1::uuid;`,
        [item.artifact_id, actorId]
      );
      await db.query(
        `
insert into audio_artifact_events (artifact_id, event_type, actor_profile_id, note, payload)
values ($1::uuid, 'deleted', $2::uuid, 'Deleted R2 object through safe cleanup runner.', $3::jsonb);`,
        [
          item.artifact_id,
          access.profile?.id || null,
          JSON.stringify({
            source: 'api/storage/cleanup-run',
            storage_bucket: item.storage_bucket,
            storage_path: item.storage_path,
            size_bytes: item.size_bytes
          })
        ]
      );
      summary.deletedObjects += 1;
      summary.deletedBytes += Number(item.reclaimable_bytes || item.size_bytes || 0);
    } catch (error) {
      summary.failedObjects += 1;
      summary.failures.push({
        artifactId: item.artifact_id,
        storagePath: item.storage_path,
        error: error.message || String(error)
      });
      await db.query(
        `
update audio_artifacts
set lifecycle_status = 'failed',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'delete_failed_at', now(),
      'delete_error', $2::text
    ),
    updated_at = now()
where id = $1::uuid;`,
        [item.artifact_id, String(error.message || error).slice(0, 1000)]
      );
      await db.query(
        `
insert into audio_artifact_events (artifact_id, event_type, actor_profile_id, note, payload)
values ($1::uuid, 'note', $2::uuid, 'R2 deletion failed; artifact moved to failed lifecycle.', $3::jsonb);`,
        [
          item.artifact_id,
          access.profile?.id || null,
          JSON.stringify({ source: 'api/storage/cleanup-run', error: error.message || String(error) })
        ]
      );
    }
  }
  return summary;
}

function githubWorkflowToken() {
  for (const name of GITHUB_WORKFLOW_TOKEN_NAMES) {
    const value = process.env[name];
    if (value) return { name, value };
  }
  return { name: null, value: '' };
}

function workflowDispatchStatus() {
  const token = githubWorkflowToken();
  return {
    configured: Boolean(token.value),
    tokenEnv: token.name,
    missingEnv: token.value ? null : 'GITHUB_WORKFLOW_TOKEN',
    repository: GITHUB_WORKFLOW_REPO,
    ref: GITHUB_WORKFLOW_REF
  };
}

function normalizeWorkflowLimit(value, fallback, min, max) {
  const number = Number(value || fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function normalizeMoney(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Number(number.toFixed(6));
}

async function githubApi(pathname, options = {}) {
  const token = githubWorkflowToken();
  if (!token.value) {
    throw httpError(409, 'Automacao GitHub Actions indisponivel: configure GITHUB_WORKFLOW_TOKEN na Vercel com permissao Actions: write.');
  }
  const response = await fetch(`https://api.github.com${pathname}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.value}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(response.status, payload.message || `GitHub API falhou (${response.status}).`);
  }
  return payload;
}

async function dispatchGithubWorkflow(workflowFile, inputs) {
  const repo = GITHUB_WORKFLOW_REPO;
  const encodedWorkflow = encodeURIComponent(workflowFile);
  const startedAt = new Date();
  await githubApi(`/repos/${repo}/actions/workflows/${encodedWorkflow}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({
      ref: GITHUB_WORKFLOW_REF,
      inputs
    })
  });
  let run = null;
  try {
    await new Promise(resolve => setTimeout(resolve, 1200));
    const runs = await githubApi(`/repos/${repo}/actions/workflows/${encodedWorkflow}/runs?event=workflow_dispatch&per_page=5`);
    run = (runs.workflow_runs || []).find(item => {
      const created = new Date(item.created_at || 0);
      return created.getTime() >= startedAt.getTime() - 5000;
    }) || (runs.workflow_runs || [])[0] || null;
  } catch (_error) {
    run = null;
  }
  return {
    workflow: workflowFile,
    repository: repo,
    ref: GITHUB_WORKFLOW_REF,
    requestedAt: startedAt.toISOString(),
    run: run ? {
      id: run.id,
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      createdAt: run.created_at,
      url: run.html_url
    } : null
  };
}


function extractWorkflowDispatch(output = {}) {
  return output.githubWorkflow || output.dispatch || output.workflowDispatch || null;
}

function workflowRunSummary(row, dispatch, live = null, refreshError = '') {
  const run = live || dispatch?.run || {};
  const runId = run.id || dispatch?.runId || null;
  const repository = dispatch?.repository || GITHUB_WORKFLOW_REPO;
  return {
    jobId: row.id,
    jobType: row.job_type,
    jobStatus: row.status,
    jobCreatedAt: row.created_at,
    workflow: dispatch?.workflow || run.name || '',
    repository,
    ref: dispatch?.ref || GITHUB_WORKFLOW_REF,
    requestedAt: dispatch?.requestedAt || row.created_at,
    runId,
    name: run.name || dispatch?.workflow || row.job_type,
    status: run.status || null,
    conclusion: run.conclusion || null,
    createdAt: run.created_at || run.createdAt || null,
    updatedAt: run.updated_at || null,
    url: run.html_url || run.url || (runId ? `https://github.com/${repository}/actions/runs/${runId}` : ''),
    live: Boolean(live),
    refreshError: refreshError || null
  };
}

async function workflowRunsForSession(db, campaign, sourceSessionId, options = {}) {
  const limit = normalizeWorkflowLimit(options.workflowRunLimit || options.limit, 5, 1, 10);
  const status = workflowDispatchStatus();
  const result = await db.query(
    `
select pj.id::text, pj.job_type, pj.status, pj.output, pj.created_at
from processing_jobs pj
join sessions s on s.id = pj.session_id
join campaigns c on c.id = s.campaign_id
where c.slug = $1
  and s.source_session_id = $2
  and (
    pj.output ? 'dispatch'
    or pj.output ? 'githubWorkflow'
    or pj.output ? 'workflowDispatch'
    or pj.job_type in (
      'transcription_workflow_dispatch',
      'review_generation_workflow_dispatch',
      'storage_cleanup_workflow_dispatch'
    )
  )
order by pj.created_at desc
limit $3::int;`,
    [campaign, sourceSessionId, limit]
  );
  const rows = result.rows || [];
  const runs = [];
  for (const row of rows) {
    const dispatch = extractWorkflowDispatch(row.output || {});
    if (!dispatch) continue;
    const runId = dispatch.run?.id || dispatch.runId || null;
    let live = null;
    let refreshError = '';
    if (status.configured && runId) {
      try {
        live = await githubApi(`/repos/${dispatch.repository || GITHUB_WORKFLOW_REPO}/actions/runs/${runId}`);
      } catch (error) {
        refreshError = error.message || String(error);
      }
    }
    runs.push(workflowRunSummary(row, dispatch, live, refreshError));
  }
  return {
    configured: status.configured,
    repository: status.repository,
    ref: status.ref,
    refreshedAt: new Date().toISOString(),
    runs
  };
}


async function notifyPipelineOps(event = {}) {
  try {
    return await notifyDiscord({
      target: 'ops',
      fallbackWebhook: true,
      ...event
    });
  } catch (error) {
    console.warn('pipeline_ops_notification_failed', error.message || String(error));
    return { sent: false, error: error.message || String(error) };
  }
}

function workflowRunField(dispatch = {}) {
  const run = dispatch.run || {};
  if (!run.id && !run.url) return 'run ainda nao localizado';
  return [
    run.id ? `#${run.id}` : '',
    run.status || '',
    run.conclusion || '',
    run.url || ''
  ].filter(Boolean).join(' | ');
}

async function notifyWorkflowDispatch(action, sourceSessionId, dispatch, actorId, extra = {}) {
  return notifyPipelineOps({
    title: 'Worker GitHub Actions disparado',
    status: 'ok',
    sourceSessionId,
    description: cleanText(`Acao: ${action}. Workflow: ${dispatch?.workflow || 'desconhecido'}.`, 500),
    costUsd: extra.costUsd,
    fields: [
      { name: 'workflow', value: dispatch?.workflow || 'desconhecido', inline: true },
      { name: 'run', value: workflowRunField(dispatch), inline: false },
      { name: 'ator', value: actorId || 'unknown', inline: true }
    ]
  });
}

async function recordWorkflowDispatch(db, campaign, sourceSessionId, jobType, input, dispatch, actorId) {
  if (!sourceSessionId) return null;
  const result = await db.query(
    `
with target as (
  select s.id session_id
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = $1 and s.source_session_id = $2
  limit 1
), inserted as (
  insert into processing_jobs (session_id, job_type, status, attempts, input, output, started_at, finished_at, created_at)
  select target.session_id, $3, 'succeeded', 1, $4::jsonb, $5::jsonb, now(), now(), now()
  from target
  returning id
)
select id::text from inserted;`,
    [
      campaign,
      sourceSessionId,
      jobType,
      JSON.stringify(input),
      JSON.stringify({
        workerStatus: 'workflow_dispatched',
        dispatchedBy: actorId || 'unknown',
        dispatch
      })
    ]
  );
  return result.rows[0]?.id || null;
}

async function markSpeechWorkflowDispatched(db, campaign, sourceSessionId, dispatch, actorId) {
  const result = await db.query(
    `
with target as (
  select pj.id
  from processing_jobs pj
  join sessions s on s.id = pj.session_id
  join campaigns c on c.id = s.campaign_id
  where c.slug = $1
    and s.source_session_id = $2
    and pj.job_type = 'cloud_detect_speech_slices'
    and pj.status in ('queued','retrying','running')
  order by pj.created_at desc
  limit 1
)
update processing_jobs pj
set output = coalesce(pj.output, '{}'::jsonb) || jsonb_build_object(
      'workerStatus', 'workflow_dispatched',
      'githubWorkflow', $3::jsonb,
      'workflowDispatchedBy', $4::text,
      'workflowDispatchedAt', now()
    )
from target
where pj.id = target.id
returning pj.id::text;`,
    [campaign, sourceSessionId, JSON.stringify(dispatch), actorId || 'unknown']
  );
  return result.rows[0]?.id || null;
}

async function pipelineControlMetrics(db, campaign, sourceSessionId, limit = DEFAULT_TRANSCRIPTION_LIMIT) {
  const model = TRANSCRIPTION_MODEL;
  const promptVersion = TRANSCRIPTION_PROMPT_VERSION;
  const result = await db.query(
    `
with target_session as (
  select s.id, s.campaign_id, s.source_session_id, s.title, s.status, s.started_at, s.ended_at, c.slug campaign_slug
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = $1
    and s.source_session_id = $2
  limit 1
), candidates as (
  select
    wu.*,
    tc.id cache_id,
    coalesce(wu.duration_ms, greatest(0, coalesce(wu.end_ms, 0) - coalesce(wu.start_ms, 0)), 0)::int effective_duration_ms
  from audio_transcription_work_units wu
  left join transcription_cache tc
    on tc.audio_sha256 = wu.sha256
   and tc.provider = 'openai'
   and tc.model = $3
   and tc.prompt_version = $4
   and tc.status = 'succeeded'
  where wu.session_id = (select id from target_session)
    and nullif(wu.sha256, '') is not null
    and nullif(wu.storage_path, '') is not null
    and coalesce(wu.probably_silent, false) is false
    and coalesce(wu.transcription_status, 'pending') not in ('skipped_silence', 'transcribed', 'cached')
), limited as (
  select *
  from candidates
  order by (cache_id is not null) desc, track_key, start_ms, unit_type, unit_index
  limit $5::int
), by_track as (
  select
    track_key,
    count(*)::int objects,
    round((coalesce(sum(effective_duration_ms) filter (where cache_id is null), 0) / 60000.0)::numeric, 3) minutes
  from limited
  group by track_key
  order by track_key
), work_stats as (
  select
    count(*)::int total_candidates,
    count(*) filter (where unit_type = 'speech_slice')::int speech_slice_candidates,
    count(*) filter (where unit_type = 'chunk')::int chunk_fallback_candidates,
    count(*) filter (where cache_id is not null)::int cache_hit_candidates,
    count(*) filter (where cache_id is null)::int transcribe_candidates,
    round((coalesce(sum(effective_duration_ms) filter (where cache_id is null), 0) / 60000.0)::numeric, 3) candidate_audio_minutes
  from candidates
), limited_stats as (
  select
    count(*)::int objects,
    count(*) filter (where cache_id is not null)::int cache_hit_objects,
    count(*) filter (where cache_id is null)::int billable_objects,
    round((coalesce(sum(effective_duration_ms) filter (where cache_id is null), 0) / 60000.0)::numeric, 3) billable_minutes
  from limited
), speech_stats as (
  select
    count(*)::int objects,
    count(*) filter (where transcription_status = 'pending')::int pending,
    count(*) filter (where transcription_status = 'transcribed')::int transcribed,
    count(*) filter (where transcription_status = 'cached')::int cached,
    count(*) filter (where transcription_status = 'skipped_silence')::int skipped_silence,
    round((coalesce(sum(duration_ms), 0) / 60000.0)::numeric, 3) minutes
  from audio_speech_slices
  where session_id = (select id from target_session)
), chunk_stats as (
  select
    count(*)::int objects,
    count(*) filter (where transcription_status = 'pending')::int pending,
    count(*) filter (where transcription_status = 'transcribed')::int transcribed,
    count(*) filter (where transcription_status = 'cached')::int cached,
    count(*) filter (where transcription_status = 'skipped_silence')::int skipped_silence
  from audio_chunks
  where session_id = (select id from target_session)
), cleanup_stats as (
  select
    count(*)::int objects,
    count(*) filter (where readiness_status = 'delete_ready')::int delete_ready_objects,
    coalesce(sum(reclaimable_bytes) filter (where readiness_status = 'delete_ready'), 0)::bigint delete_ready_bytes,
    coalesce(sum(reclaimable_bytes) filter (where readiness_status = 'blocked'), 0)::bigint blocked_bytes,
    coalesce(sum(reclaimable_bytes) filter (where readiness_status = 'hold'), 0)::bigint hold_bytes
  from audio_storage_cleanup_candidates
  where session_id = (select id from target_session)
), storage_stats as (
  select
    count(*) filter (where lifecycle_status = 'active')::int active_objects,
    coalesce(sum(size_bytes) filter (where lifecycle_status = 'active'), 0)::bigint active_bytes,
    count(*) filter (where lifecycle_status = 'delete_ready')::int delete_ready_objects,
    coalesce(sum(size_bytes) filter (where lifecycle_status = 'delete_ready'), 0)::bigint delete_ready_bytes,
    count(*) filter (where lifecycle_status = 'deleted')::int deleted_objects,
    coalesce(sum(size_bytes) filter (where lifecycle_status = 'deleted'), 0)::bigint deleted_bytes
  from audio_artifacts
  where session_id = (select id from target_session)
), ledger_stats as (
  select
    count(*)::int entries,
    round(coalesce(sum(input_audio_minutes), 0)::numeric, 3) minutes,
    round(coalesce(sum(estimated_cost_usd), 0)::numeric, 6) cost
  from ai_usage_ledger
  where session_id = (select id from target_session)
    and operation_type = 'transcription'
), segment_stats as (
  select
    count(*)::int segments,
    count(*) filter (where ts.is_empty is false)::int non_empty,
    count(*) filter (where ts.is_empty is true)::int empty,
    count(distinct sc.segment_id) filter (where ts.is_empty is false)::int classified,
    greatest(
      (count(*) filter (where ts.is_empty is false))::int
        - (count(distinct sc.segment_id) filter (where ts.is_empty is false))::int,
      0
    )::int pending_review
  from transcript_segments ts
  left join segment_classifications sc
    on sc.segment_id = ts.id
   and sc.source_run_id = $6
  where ts.session_id = (select id from target_session)
), review_candidate_stats as (
  select
    (select count(*)::int from canon_candidates cc where cc.session_id = (select id from target_session) and cc.source_run_id = $6) canon_candidates,
    (select count(*)::int from quote_candidates qc where qc.session_id = (select id from target_session) and qc.source_run_id = $6) quote_candidates,
    (select count(*)::int from outtake_candidates oc where oc.session_id = (select id from target_session) and oc.source_run_id = $6) outtake_candidates,
    (select count(*)::int from publications p where p.session_id = (select id from target_session) and p.source_run_id = $6) publications,
    (select count(*)::int from publications p where p.session_id = (select id from target_session) and p.source_run_id = $6 and p.source_publication_id = 'ai_review_packet') review_packets
)
select jsonb_build_object(
  'session', (select to_jsonb(target_session) from target_session),
  'workUnits', (select to_jsonb(work_stats) from work_stats),
  'limitedTranscription', (select to_jsonb(limited_stats) from limited_stats),
  'limitedByTrack', coalesce((select jsonb_agg(to_jsonb(by_track)) from by_track), '[]'::jsonb),
  'speechSlices', (select to_jsonb(speech_stats) from speech_stats),
  'chunks', (select to_jsonb(chunk_stats) from chunk_stats),
  'cleanup', (select to_jsonb(cleanup_stats) from cleanup_stats),
  'storage', (select to_jsonb(storage_stats) from storage_stats),
  'ledger', (select to_jsonb(ledger_stats) from ledger_stats),
  'segments', (select to_jsonb(segment_stats) from segment_stats),
  'reviewGeneration', (select to_jsonb(review_candidate_stats) from review_candidate_stats)
) data;`,
    [campaign, sourceSessionId, model, promptVersion, limit, DEFAULT_RUN]
  );
  const data = result.rows[0]?.data || {};
  if (!data.session) throw httpError(404, `Sessao nao encontrada: ${sourceSessionId}`);
  return data;
}

function derivePipelineControl(campaign, sourceSessionId, jobs, metrics) {
  const failed = jobs.filter(job => job.status === 'failed');
  const running = jobs.filter(job => job.status === 'running');
  const zeroCostNext = jobs.find(job => PIPELINE_RUNNABLE_JOB_TYPES.includes(job.type) && ['queued', 'retrying'].includes(job.status));
  const speechJob = jobs.find(job => job.type === 'cloud_detect_speech_slices' && ['queued', 'retrying', 'running', 'failed'].includes(job.status));
  const pendingTranscription = Number(metrics.workUnits?.total_candidates || 0);
  const reviewPending = Number(metrics.segments?.pending_review || 0);
  const reviewSegments = Number(metrics.segments?.non_empty || metrics.segments?.segments || 0);
  const reviewClassified = Number(metrics.segments?.classified || 0);
  const reviewPublications = Number(metrics.reviewGeneration?.publications || 0);
  const limitedMinutes = Number(metrics.limitedTranscription?.billable_minutes || 0);
  const estimatedCostUsd = Number((limitedMinutes * DEFAULT_TRANSCRIPTION_COST_USD_PER_MINUTE).toFixed(6));
  const cleanupBytes = Number(metrics.cleanup?.delete_ready_bytes || 0);
  let stage = 'complete';
  let tone = 'green';
  let title = 'Esteira concluida';
  let detail = 'Nao ha etapa pendente para esta sessao.';

  if (failed.length) {
    stage = 'needs_attention';
    tone = 'red';
    title = 'Falha exige acao';
    detail = 'Reenfileire ou investigue o job falho antes de continuar.';
  } else if (running.length) {
    stage = 'running';
    tone = 'orange';
    title = 'Etapa em execucao';
    detail = 'Aguarde o worker terminar ou atualize a tela para acompanhar.';
  } else if (zeroCostNext) {
    stage = 'zero_cost_ready';
    tone = 'blue';
    title = `Proxima etapa: ${zeroCostNext.type}`;
    detail = 'Pode continuar pela Function sem custo OpenAI.';
  } else if (speechJob && ['queued', 'retrying'].includes(speechJob.status)) {
    stage = 'speech_ready';
    tone = 'blue';
    title = 'Detectar fala e gerar Opus';
    detail = 'Dispara worker GitHub Actions para slices e audio compacto.';
  } else if (speechJob?.status === 'failed') {
    stage = 'speech_failed';
    tone = 'red';
    title = 'Speech worker falhou';
    detail = 'Use retry ou rode novamente com lote menor.';
  } else if (pendingTranscription > 0) {
    stage = 'transcription_ready';
    tone = 'gold';
    title = 'Transcricao pronta para lote';
    detail = `${pendingTranscription} unidade(s) pendente(s); lote atual estimado em US$ ${estimatedCostUsd.toFixed(6)}.`;
  } else if (reviewPending > 0) {
    stage = 'review_generation_ready';
    tone = 'gold';
    title = 'Review IA pendente';
    detail = `${reviewPending} segmento(s) ainda precisam de classificacao e candidatos revisaveis.`;
  } else if (reviewSegments > 0 && reviewClassified >= reviewSegments && reviewPublications === 0) {
    stage = 'review_publication_ready';
    tone = 'blue';
    title = 'Gerar pacote de review';
    detail = 'Todos os segmentos foram classificados; falta publicar o pacote revisavel no banco.';
  } else if (cleanupBytes > 0) {
    stage = 'cleanup_ready';
    tone = 'green';
    title = 'Limpeza segura disponivel';
    detail = 'Ha artefatos delete_ready que podem sair do R2.';
  }

  const actions = [];
  if (zeroCostNext) {
    actions.push({ id: 'continue_zero_cost_dry', label: 'Simular zero-cost', action: 'continue_zero_cost', dryRun: true, tone: '' });
    actions.push({ id: 'continue_zero_cost', label: 'Continuar zero-cost', action: 'continue_zero_cost', dryRun: false, tone: 'primary' });
  }
  if (speechJob && ['queued', 'retrying', 'failed'].includes(speechJob.status)) {
    actions.push({ id: 'dispatch_speech_dry', label: 'Simular fala', action: 'dispatch_speech_slices', write: false, tone: '' });
    actions.push({ id: 'dispatch_speech', label: 'Rodar fala', action: 'dispatch_speech_slices', write: true, tone: 'primary' });
  }
  if (pendingTranscription > 0) {
    actions.push({
      id: 'dispatch_transcription_dry',
      label: 'Simular transcricao',
      action: 'dispatch_transcription',
      execute: false,
      estimatedCostUsd,
      tone: ''
    });
    actions.push({
      id: 'dispatch_transcription',
      label: `Transcrever lote US$ ${estimatedCostUsd.toFixed(4)}`,
      action: 'dispatch_transcription',
      execute: true,
      estimatedCostUsd,
      tone: 'primary'
    });
  }
  if (pendingTranscription === 0 && reviewSegments > 0 && (reviewPending > 0 || reviewPublications === 0)) {
    const selectedReviewSegments = Math.min(
      reviewPending || reviewSegments,
      DEFAULT_REVIEW_BATCH_SIZE * DEFAULT_REVIEW_MAX_BATCHES
    );
    actions.push({
      id: 'dispatch_review_generation_dry',
      label: 'Simular review IA',
      action: 'dispatch_review_generation',
      execute: false,
      selectedReviewSegments,
      tone: ''
    });
    actions.push({
      id: 'dispatch_review_generation',
      label: `Gerar review IA ${selectedReviewSegments} seg`,
      action: 'dispatch_review_generation',
      execute: true,
      selectedReviewSegments,
      tone: 'primary'
    });
  }
  if (cleanupBytes > 0) {
    actions.push({ id: 'dispatch_cleanup_dry', label: 'Simular limpeza', action: 'dispatch_storage_cleanup', execute: false, tone: '' });
    actions.push({ id: 'dispatch_cleanup', label: 'Limpar R2', action: 'dispatch_storage_cleanup', execute: true, tone: 'danger' });
  }

  return {
    ok: true,
    mode: 'pipeline_control',
    campaign,
    sourceSessionId,
    stage,
    tone,
    title,
    detail,
    workflowDispatch: workflowDispatchStatus(),
    model: TRANSCRIPTION_MODEL,
    promptVersion: TRANSCRIPTION_PROMPT_VERSION,
    reviewModel: REVIEW_GENERATION_MODEL,
    reviewRunId: DEFAULT_RUN,
    transcriptionCostUsdPerMinute: DEFAULT_TRANSCRIPTION_COST_USD_PER_MINUTE,
    estimatedBatchCostUsd: estimatedCostUsd,
    jobs,
    metrics,
    actions
  };
}

async function buildPipelineControlPayload(campaign, sourceSessionId, options = {}) {
  const cleanSource = cleanText(sourceSessionId || '', 180);
  if (!cleanSource) throw httpError(400, 'sourceSessionId obrigatorio para controle de pipeline.');
  const limit = normalizeWorkflowLimit(options.limit || options.transcriptionLimit, DEFAULT_TRANSCRIPTION_LIMIT, 1, 100);
  const db = getPool();
  const [jobs, metrics, workflowRuns] = await Promise.all([
    listJobs(campaign, cleanSource),
    pipelineControlMetrics(db, campaign, cleanSource, limit),
    workflowRunsForSession(db, campaign, cleanSource, { workflowRunLimit: options.workflowRunLimit || 5 })
  ]);
  return {
    ...derivePipelineControl(campaign, cleanSource, jobs, metrics),
    workflowRuns
  };
}

async function runPipelineControlAction(req, campaign, body) {
  const action = cleanText(body.action || 'inspect', 80);
  const sourceSessionId = cleanText(body.sourceSessionId || body.source_session_id || '', 180);
  if (action === 'inspect') {
    await requireCampaignAccess(req, campaign);
    return buildPipelineControlPayload(campaign, sourceSessionId, body);
  }
  const access = await requirePermission(req, campaign, {
    action: 'project.jobs.run',
    scopeType: 'project',
    scopeId: PROJECT_SCOPE_ID,
    legacyRoles: ['owner', 'master'],
    error: 'Controlar a esteira exige permissao project.jobs.run.'
  });
  const actorId = String(access.profile?.id || access.user?.id || access.user?.email || 'unknown');

  if (action === 'continue_zero_cost') {
    const payload = await runPipelineContinue(req, campaign, {
      ...body,
      sourceSessionId,
      dryRun: body.dryRun === true
    });
    return {
      ...payload,
      pipeline: await buildPipelineControlPayload(campaign, payload.sourceSessionId || sourceSessionId, body)
    };
  }

  if (action === 'dispatch_speech_slices') {
    const write = body.write === true || body.execute === true;
    const maxChunks = normalizeWorkflowLimit(body.maxChunks || body.max_chunks, 12, 1, 80);
    const maxTracks = normalizeWorkflowLimit(body.maxTracks || body.max_tracks, 1, 1, 4);
    const inputs = {
      source_session_id: sourceSessionId,
      campaign,
      max_chunks: String(maxChunks),
      max_tracks: String(maxTracks),
      write: String(write),
      make_compact: String(body.makeCompact !== false && body.make_compact !== false),
      replace: String(body.replace === true)
    };
    const dispatch = await dispatchGithubWorkflow('speech-slices-worker.yml', inputs);
    const db = getPool();
    await markSpeechWorkflowDispatched(db, campaign, sourceSessionId, dispatch, actorId);
    if (write) await notifyWorkflowDispatch(action, sourceSessionId, dispatch, actorId);
    return {
      ok: true,
      action,
      dispatched: true,
      dryRun: !write,
      sourceSessionId,
      dispatch,
      pipeline: await buildPipelineControlPayload(campaign, sourceSessionId, body)
    };
  }

  if (action === 'dispatch_transcription') {
    const execute = body.execute === true;
    const limit = normalizeWorkflowLimit(body.limit || body.transcriptionLimit, DEFAULT_TRANSCRIPTION_LIMIT, 1, 100);
    const costPerMinute = normalizeMoney(body.transcriptionCostUsdPerMinute || body.costPerMinute, DEFAULT_TRANSCRIPTION_COST_USD_PER_MINUTE);
    const metrics = await pipelineControlMetrics(getPool(), campaign, sourceSessionId, limit);
    const minutes = Number(metrics.limitedTranscription?.billable_minutes || 0);
    const estimatedCostUsd = Number((minutes * costPerMinute).toFixed(6));
    const approveCostUsd = normalizeMoney(body.approveCostUsd || body.approve_cost_usd, execute ? Math.max(DEFAULT_TRANSCRIPTION_APPROVAL_USD, estimatedCostUsd) : DEFAULT_TRANSCRIPTION_APPROVAL_USD);
    const maxEstimatedCostUsd = normalizeMoney(body.maxEstimatedCostUsd || body.max_estimated_cost_usd, approveCostUsd);
    if (execute && estimatedCostUsd > approveCostUsd + 0.000001) {
      throw httpError(400, `Custo estimado US$ ${estimatedCostUsd.toFixed(6)} acima da aprovacao US$ ${approveCostUsd.toFixed(6)}.`);
    }
    const inputs = {
      source_session_id: sourceSessionId,
      campaign,
      limit: String(limit),
      execute: String(execute),
      transcription_cost_usd_per_minute: String(costPerMinute),
      max_estimated_cost_usd: String(maxEstimatedCostUsd),
      approve_cost_usd: String(approveCostUsd),
      model: cleanText(body.model || '', 80)
    };
    const dispatch = await dispatchGithubWorkflow('transcription-worker.yml', inputs);
    await recordWorkflowDispatch(getPool(), campaign, sourceSessionId, 'transcription_workflow_dispatch', inputs, dispatch, actorId);
    if (execute) await notifyWorkflowDispatch(action, sourceSessionId, dispatch, actorId, { costUsd: estimatedCostUsd });
    return {
      ok: true,
      action,
      dispatched: true,
      dryRun: !execute,
      sourceSessionId,
      estimatedCostUsd,
      billableMinutes: minutes,
      dispatch,
      pipeline: await buildPipelineControlPayload(campaign, sourceSessionId, { ...body, limit })
    };
  }

  if (action === 'dispatch_review_generation') {
    const execute = body.execute === true;
    if (execute && body.confirm !== 'RUN_REVIEW_AI') {
      throw httpError(400, 'Review IA real exige confirm="RUN_REVIEW_AI".');
    }
    const batchSize = normalizeWorkflowLimit(body.batchSize || body.batch_size, DEFAULT_REVIEW_BATCH_SIZE, 1, 200);
    const maxBatches = normalizeWorkflowLimit(body.maxBatches || body.max_batches, DEFAULT_REVIEW_MAX_BATCHES, 1, 20);
    const sourceRunId = cleanText(body.sourceRunId || body.source_run_id || DEFAULT_RUN, 140) || DEFAULT_RUN;
    const inputs = {
      source_session_id: sourceSessionId,
      campaign,
      batch_size: String(batchSize),
      max_batches: String(maxBatches),
      execute: String(execute),
      model: cleanText(body.model || REVIEW_GENERATION_MODEL, 80),
      source_run_id: sourceRunId,
      skip_publications: String(body.skipPublications === true || body.skip_publications === true)
    };
    const dispatch = await dispatchGithubWorkflow('review-generation-worker.yml', inputs);
    await recordWorkflowDispatch(getPool(), campaign, sourceSessionId, 'review_generation_workflow_dispatch', inputs, dispatch, actorId);
    if (execute) await notifyWorkflowDispatch(action, sourceSessionId, dispatch, actorId);
    return {
      ok: true,
      action,
      dispatched: true,
      dryRun: !execute,
      sourceSessionId,
      batchSize,
      maxBatches,
      sourceRunId,
      dispatch,
      pipeline: await buildPipelineControlPayload(campaign, sourceSessionId, body)
    };
  }

  if (action === 'dispatch_storage_cleanup') {
    const execute = body.execute === true;
    if (execute && body.confirm !== 'DELETE_READY_R2') {
      throw httpError(400, 'Limpeza real exige confirm="DELETE_READY_R2".');
    }
    const limit = normalizeWorkflowLimit(body.limit || body.maxObjects, 50, 1, 100);
    const inputs = {
      campaign,
      source_session_id: sourceSessionId,
      limit: String(limit),
      execute: String(execute),
      confirm: execute ? 'DELETE_READY_R2' : ''
    };
    const dispatch = await dispatchGithubWorkflow('storage-cleanup-worker.yml', inputs);
    await recordWorkflowDispatch(getPool(), campaign, sourceSessionId, 'storage_cleanup_workflow_dispatch', inputs, dispatch, actorId);
    if (execute) await notifyWorkflowDispatch(action, sourceSessionId, dispatch, actorId);
    return {
      ok: true,
      action,
      dispatched: true,
      dryRun: !execute,
      sourceSessionId,
      dispatch,
      pipeline: await buildPipelineControlPayload(campaign, sourceSessionId, body)
    };
  }

  throw httpError(400, `Acao de pipeline desconhecida: ${action}`);
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
    stepSummary: row.step_status ? {
      status: row.step_status,
      total: row.total_steps || 0,
      succeeded: row.succeeded_steps || 0,
      failed: row.failed_steps || 0,
      running: row.running_steps || 0,
      retrying: row.retrying_steps || 0,
      blocked: row.blocked_steps || 0
    } : null,
    steps: row.job_steps || [],
    trackSummary: row.extraction_status ? {
      status: row.extraction_status,
      total: row.extraction_total_tracks || 0,
      pending: row.extraction_pending_tracks || 0,
      running: row.extraction_running_tracks || 0,
      succeeded: row.extraction_succeeded_tracks || 0,
      failed: row.extraction_failed_tracks || 0,
      skipped: row.extraction_skipped_tracks || 0,
      extractedBytes: row.extraction_extracted_bytes || 0,
      sourceCompressedBytes: row.extraction_source_compressed_bytes || 0,
      tracks: row.extraction_tracks || []
    } : null,
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
       s.source_session_id, s.title session_title, s.status session_status,
       jss.step_status, jss.total_steps, jss.succeeded_steps, jss.failed_steps,
       jss.running_steps, jss.retrying_steps, jss.blocked_steps, jss.steps job_steps,
       ctes.extraction_status,
       ctes.total_tracks extraction_total_tracks,
       ctes.pending_tracks extraction_pending_tracks,
       ctes.running_tracks extraction_running_tracks,
       ctes.succeeded_tracks extraction_succeeded_tracks,
       ctes.failed_tracks extraction_failed_tracks,
       ctes.skipped_tracks extraction_skipped_tracks,
       ctes.extracted_bytes extraction_extracted_bytes,
       ctes.source_compressed_bytes extraction_source_compressed_bytes,
       ctes.tracks extraction_tracks
from processing_jobs pj
left join sessions s on s.id = pj.session_id
left join campaigns c on c.id = s.campaign_id
left join processing_job_step_summary jss on jss.job_id = pj.id
left join craig_track_extraction_summary ctes on ctes.job_id = pj.id
where c.slug = $1 ${sourceFilter}
order by pj.created_at desc
limit 50;`,
    params
  );
  return result.rows.map(jobResponse);
}

async function selectPipelineJobRows(db, campaign, options = {}) {
  const jobId = options.jobId || null;
  const sourceSessionId = cleanText(options.sourceSessionId || '', 180);
  const statuses = options.statuses?.length ? options.statuses : ['queued', 'retrying'];
  const types = options.types?.length ? options.types : PIPELINE_RUNNABLE_JOB_TYPES;
  const limit = Math.max(1, Math.min(50, Number(options.limit || 12)));
  const result = await db.query(
    `
select pj.id, pj.job_type, pj.status, pj.attempts, pj.input, pj.output, pj.error,
       pj.started_at, pj.finished_at, pj.created_at,
       s.source_session_id, s.title session_title, s.status session_status,
       jss.step_status, jss.total_steps, jss.succeeded_steps, jss.failed_steps,
       jss.running_steps, jss.retrying_steps, jss.blocked_steps, jss.steps job_steps,
       ctes.extraction_status,
       ctes.total_tracks extraction_total_tracks,
       ctes.pending_tracks extraction_pending_tracks,
       ctes.running_tracks extraction_running_tracks,
       ctes.succeeded_tracks extraction_succeeded_tracks,
       ctes.failed_tracks extraction_failed_tracks,
       ctes.skipped_tracks extraction_skipped_tracks,
       ctes.extracted_bytes extraction_extracted_bytes,
       ctes.source_compressed_bytes extraction_source_compressed_bytes,
       ctes.tracks extraction_tracks
from processing_jobs pj
left join sessions s on s.id = pj.session_id
left join campaigns c on c.id = s.campaign_id
left join processing_job_step_summary jss on jss.job_id = pj.id
left join craig_track_extraction_summary ctes on ctes.job_id = pj.id
where c.slug = $1
  and ($2::uuid is null or pj.id = $2::uuid)
  and ($3::text = '' or s.source_session_id = $3)
  and pj.status = any($4::text[])
  and pj.job_type = any($5::text[])
order by case pj.job_type
    when 'cloud_ingest_craig' then 10
    when 'cloud_extract_craig_tracks' then 20
    when 'cloud_plan_audio_chunks' then 30
    when 'cloud_detect_speech_slices' then 40
    else 99
  end,
  pj.created_at
limit $6::int;`,
    [campaign, jobId, sourceSessionId, statuses, types, limit]
  );
  return result.rows.map(jobResponse);
}

async function pipelineSnapshot(db, campaign, sourceSessionId = '') {
  const jobs = await selectPipelineJobRows(db, campaign, {
    sourceSessionId,
    statuses: ['queued', 'retrying', 'running', 'failed'],
    types: PIPELINE_KNOWN_NEXT_JOB_TYPES,
    limit: 20
  });
  const byStatus = jobs.reduce((summary, job) => {
    const status = job.status || 'unknown';
    summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {});
  return {
    sourceSessionId: cleanText(sourceSessionId || '', 180) || null,
    byStatus,
    jobs
  };
}

async function selectNextPipelineJob(db, campaign, options = {}) {
  const rows = await selectPipelineJobRows(db, campaign, {
    ...options,
    statuses: ['queued', 'retrying'],
    types: PIPELINE_RUNNABLE_JOB_TYPES,
    limit: 1
  });
  return rows[0] || null;
}

async function selectPipelineBlockedJob(db, campaign, sourceSessionId = '') {
  const rows = await selectPipelineJobRows(db, campaign, {
    sourceSessionId,
    statuses: ['queued', 'retrying', 'running', 'failed'],
    types: ['cloud_detect_speech_slices'],
    limit: 1
  });
  return rows[0] || null;
}

function normalizePipelineMaxTracks(value) {
  const maxTracks = Number(value || 1);
  if (!Number.isFinite(maxTracks) || maxTracks <= 0) return 1;
  return Math.max(1, Math.min(3, Math.floor(maxTracks)));
}

function pipelineBlockedMessage(job) {
  if (!job) return '';
  if (job.type === 'cloud_detect_speech_slices') {
    return 'Pipeline chegou na etapa de renderizar audio compacto e detectar fala. Esta etapa ainda precisa do worker cloud dedicado antes de transcrever.';
  }
  return `Pipeline aguardando etapa ${job.type}.`;
}

async function runPipelineContinue(req, campaign, body) {
  await requirePermission(req, campaign, {
    action: 'project.jobs.run',
    scopeType: 'project',
    scopeId: PROJECT_SCOPE_ID,
    legacyRoles: ['owner', 'master'],
    error: 'Continuar pipeline exige permissao project.jobs.run.'
  });
  const rawJobId = cleanText(body.jobId || body.job_id, 80);
  const jobId = rawJobId ? uuidOrNull(rawJobId) : null;
  if (rawJobId && !jobId) throw httpError(400, 'jobId invalido para continuar pipeline.');
  const sourceSessionId = cleanText(body.sourceSessionId || body.source_session_id, 180);
  const dryRun = body.dryRun === true || body.dry_run === true;
  const maxTracks = normalizePipelineMaxTracks(body.maxTracks || body.max_tracks);
  const chunkSeconds = normalizeChunkSeconds(body.chunkSeconds || body.chunk_seconds);
  const db = getPool();
  const nextJob = await selectNextPipelineJob(db, campaign, { jobId, sourceSessionId });
  const snapshot = await pipelineSnapshot(db, campaign, sourceSessionId);

  if (dryRun) {
    const blockedJob = nextJob ? null : await selectPipelineBlockedJob(db, campaign, sourceSessionId);
    return {
      ok: true,
      processed: false,
      dryRun: true,
      mode: 'pipeline_continue',
      sourceSessionId: nextJob?.session?.sourceSessionId || sourceSessionId || null,
      nextJob,
      blockedJob,
      continueRecommended: Boolean(nextJob),
      message: nextJob
        ? `Proxima etapa zero-cost: ${nextJob.type}.`
        : (blockedJob ? pipelineBlockedMessage(blockedJob) : 'Nenhuma etapa zero-cost pendente para continuar.'),
      snapshot
    };
  }

  if (!nextJob) {
    const blockedJob = await selectPipelineBlockedJob(db, campaign, sourceSessionId);
    return {
      ok: true,
      processed: false,
      dryRun: false,
      mode: 'pipeline_continue',
      sourceSessionId: sourceSessionId || blockedJob?.session?.sourceSessionId || null,
      blockedJob,
      continueRecommended: false,
      message: blockedJob ? pipelineBlockedMessage(blockedJob) : 'Nenhuma etapa zero-cost pendente para continuar.',
      snapshot
    };
  }

  let jobResult;
  if (nextJob.type === 'cloud_ingest_craig') {
    jobResult = await getCloudIngestRunner()({ jobId: nextJob.id, dryRun: false });
  } else if (nextJob.type === 'cloud_extract_craig_tracks') {
    jobResult = await getCloudExtractRunner()({ jobId: nextJob.id, dryRun: false, maxTracks });
  } else if (nextJob.type === 'cloud_plan_audio_chunks') {
    jobResult = await runCloudPlanChunks(req, campaign, {
      jobId: nextJob.id,
      dryRun: false,
      chunkSeconds
    });
  } else {
    throw httpError(409, `Worker ainda nao integrado ao continuador: ${nextJob.type}`);
  }

  const resolvedSourceSessionId = jobResult?.sourceSessionId || nextJob.session?.sourceSessionId || sourceSessionId || '';
  const nextRunnableJob = await selectNextPipelineJob(db, campaign, {
    sourceSessionId: resolvedSourceSessionId
  });
  const blockedJob = nextRunnableJob ? null : await selectPipelineBlockedJob(db, campaign, resolvedSourceSessionId);
  const nextSnapshot = await pipelineSnapshot(db, campaign, resolvedSourceSessionId);
  return {
    ok: true,
    processed: true,
    dryRun: false,
    mode: 'pipeline_continue',
    sourceSessionId: resolvedSourceSessionId || null,
    executedJob: nextJob,
    jobResult,
    nextJob: nextRunnableJob,
    blockedJob,
    continueRecommended: Boolean(nextRunnableJob),
    message: nextRunnableJob
      ? `Etapa ${nextJob.type} concluida. Proxima etapa: ${nextRunnableJob.type}.`
      : (blockedJob ? pipelineBlockedMessage(blockedJob) : `Etapa ${nextJob.type} concluida. Nao ha proxima etapa zero-cost pendente.`),
    snapshot: nextSnapshot,
    cost: { paidAiCostUsd: 0 }
  };
}


function normalizeJobControlAction(value) {
  const action = cleanText(value || '', 40);
  if (['pause', 'resume', 'discard'].includes(action)) return action;
  throw httpError(400, `Acao de job desconhecida: ${action || 'vazia'}`);
}

function jobControlLabel(action) {
  return {
    pause: 'Pausa solicitada',
    resume: 'Retomada solicitada',
    discard: 'Job descartado'
  }[action] || 'Controle de job';
}

function jobControlStepStatus(action) {
  if (action === 'resume') return 'retrying';
  if (action === 'discard') return 'skipped';
  return 'blocked';
}

async function controlProcessingJob(req, campaign, body) {
  const access = await requirePermission(req, campaign, {
    action: 'project.jobs.run',
    scopeType: 'project',
    scopeId: PROJECT_SCOPE_ID,
    legacyRoles: ['owner', 'master'],
    error: 'Controlar jobs exige permissao project.jobs.run.'
  });
  const action = normalizeJobControlAction(body.action || body.jobAction || body.job_action);
  const jobIdRaw = cleanText(body.jobId || body.job_id, 80);
  const jobId = uuidOrNull(jobIdRaw);
  if (!jobId) throw httpError(400, 'jobId invalido para controle de job.');
  if (action === 'discard' && body.confirm !== 'DISCARD_JOB') {
    throw httpError(400, 'Descartar job exige confirm="DISCARD_JOB".');
  }
  const reason = cleanText(body.reason || `${action}_requested_from_ui`, 500);
  const actor = String(access.profile?.id || access.user?.id || access.user?.email || 'unknown');
  const db = getPool();
  const client = await db.connect();
  try {
    await client.query('begin');
    const stateFilter = action === 'pause'
      ? "and pj.status in ('queued','retrying')"
      : action === 'resume'
        ? "and pj.status = 'cancelled' and coalesce(pj.output->>'operatorState', '') = 'paused'"
        : "and pj.status in ('queued','retrying','failed','cancelled')";
    const target = await client.query(
      `
select pj.id, pj.job_type, pj.status, pj.output, s.source_session_id
from processing_jobs pj
join sessions s on s.id = pj.session_id
join campaigns c on c.id = s.campaign_id
where c.slug = $1
  and pj.id = $2::uuid
  ${stateFilter}
for update;`,
      [campaign, jobId]
    );
    if (!target.rows.length) {
      const messages = {
        pause: 'Job nao encontrado ou nao esta em fila/retry para pausar.',
        resume: 'Job nao encontrado ou nao esta pausado pelo operador.',
        discard: 'Job nao encontrado ou nao pode ser descartado neste estado.'
      };
      throw httpError(409, messages[action]);
    }
    const job = target.rows[0];
    const nextStatus = action === 'resume' ? 'retrying' : 'cancelled';
    const workerStatus = action === 'pause'
      ? 'operator_paused'
      : action === 'resume'
        ? 'operator_resumed'
        : 'operator_discarded';
    const operatorState = action === 'pause'
      ? 'paused'
      : action === 'resume'
        ? 'active'
        : 'discarded';
    const outputPatch = {
      operatorState,
      operatorAction: action,
      operatorActionAt: new Date().toISOString(),
      operatorActionBy: actor,
      operatorActionReason: reason,
      operatorPreviousStatus: job.status,
      workerStatus,
      paidAiCostUsd: 0
    };
    if (action === 'pause') outputPatch.pausedAt = outputPatch.operatorActionAt;
    if (action === 'resume') outputPatch.resumedAt = outputPatch.operatorActionAt;
    if (action === 'discard') outputPatch.discardedAt = outputPatch.operatorActionAt;

    await client.query(
      `
update processing_jobs
set status = $2,
    error = case when $3::text = 'discard' then 'Descartado pelo operador' else null end,
    finished_at = case when $3::text in ('pause','discard') then now() else null end,
    output = coalesce(output, '{}'::jsonb) || $4::jsonb
where id = $1::uuid;`,
      [jobId, nextStatus, action, JSON.stringify(outputPatch)]
    );

    if (action === 'pause') {
      await client.query(
        `
update processing_job_steps
set status = 'blocked',
    retryable = true,
    finished_at = now(),
    progress = coalesce(progress, '{}'::jsonb) || $2::jsonb,
    updated_at = now()
where job_id = $1::uuid
  and status in ('pending','retrying');`,
        [jobId, JSON.stringify(outputPatch)]
      );
    } else if (action === 'resume') {
      await client.query(
        `
update processing_job_steps
set status = 'retrying',
    retryable = true,
    error = null,
    finished_at = null,
    progress = coalesce(progress, '{}'::jsonb) || $2::jsonb,
    updated_at = now()
where job_id = $1::uuid
  and status in ('blocked','failed');`,
        [jobId, JSON.stringify(outputPatch)]
      );
    } else if (action === 'discard') {
      await client.query(
        `
update processing_job_steps
set status = 'skipped',
    retryable = false,
    finished_at = now(),
    progress = coalesce(progress, '{}'::jsonb) || $2::jsonb,
    updated_at = now()
where job_id = $1::uuid
  and status <> 'succeeded';`,
        [jobId, JSON.stringify(outputPatch)]
      );
    }

    await markJobStep(client, { id: jobId, job_type: job.job_type }, jobControlStepStatus(action), {
      key: `operator_${action}`,
      label: jobControlLabel(action),
      orderIndex: action === 'pause' ? 6 : action === 'resume' ? 7 : 8,
      retryable: action !== 'discard',
      progress: outputPatch,
      error: action === 'discard' ? reason : null
    });

    await client.query('commit');
    await notifyPipelineOps({
      title: `Job ${jobControlLabel(action)}`,
      status: action === 'discard' ? 'warning' : 'ok',
      sourceSessionId: job.source_session_id || null,
      jobId,
      description: cleanText(`Job ${job.job_type} recebeu acao ${action}.`, 500),
      fields: [
        { name: 'acao', value: action, inline: true },
        { name: 'estado', value: operatorState, inline: true },
        { name: 'ator', value: actor, inline: true },
        { name: 'motivo', value: reason, inline: false }
      ]
    });
    return {
      ok: true,
      action,
      jobId,
      sourceSessionId: job.source_session_id || null,
      status: nextStatus,
      operatorState,
      reason
    };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function retryProcessingJob(req, campaign, body) {
  const access = await requirePermission(req, campaign, {
    action: 'project.jobs.run',
    scopeType: 'project',
    scopeId: PROJECT_SCOPE_ID,
    legacyRoles: ['owner', 'master'],
    error: 'Reprocessar jobs exige permissao project.jobs.run.'
  });
  const jobId = cleanText(body.jobId || body.job_id, 80);
  if (!jobId) throw httpError(400, 'jobId obrigatorio para retry.');
  const reason = cleanText(body.reason || 'retry_requested_from_ui', 500);
  const actor = access.profile?.id || access.user?.id || access.user?.email || 'unknown';
  const db = getPool();
  const result = await db.query(
    `
with target as (
  select pj.id
  from processing_jobs pj
  join sessions s on s.id = pj.session_id
  join campaigns c on c.id = s.campaign_id
  where c.slug = $1
    and pj.id = $2::uuid
    and pj.status in ('failed','cancelled')
    and coalesce(pj.output->>'operatorState', '') not in ('paused','discarded')
  for update
)
update processing_jobs pj
set status = 'retrying',
    error = null,
    finished_at = null,
    output = coalesce(pj.output, '{}'::jsonb) || jsonb_build_object(
      'retryRequestedAt', now(),
      'retryRequestedBy', $3::text,
      'retryReason', $4::text
    )
from target
where pj.id = target.id
returning pj.id;`,
    [campaign, jobId, String(actor), reason]
  );
  if (!result.rows.length) {
    throw httpError(409, 'Job nao encontrado ou nao esta em estado retryable.');
  }
  await db.query(
    `
update processing_job_steps
set status = 'retrying',
    error = null,
    retryable = true,
    finished_at = null,
    progress = coalesce(progress, '{}'::jsonb) || jsonb_build_object(
      'retryRequestedAt', now(),
      'retryRequestedBy', $2::text,
      'retryReason', $3::text
    ),
    updated_at = now()
where job_id = $1::uuid
  and status in ('failed','blocked');`,
    [jobId, String(actor), reason]
  );
  await db.query(
    `
insert into processing_job_steps (
  id, job_id, step_key, label, status, attempts, retryable, order_index,
  progress, created_at, updated_at
)
select gen_random_uuid(), $1::uuid, 'retry_request', 'Retry solicitado', 'retrying',
       0, true, 5,
       jsonb_build_object('retryRequestedAt', now(), 'retryRequestedBy', $2::text, 'retryReason', $3::text),
       now(), now()
where not exists (
  select 1 from processing_job_steps where job_id = $1::uuid and step_key = 'retry_request'
)
on conflict (job_id, step_key) do update set
  status = 'retrying',
  progress = coalesce(processing_job_steps.progress, '{}'::jsonb) || excluded.progress,
  updated_at = now();`,
    [jobId, String(actor), reason]
  );
  return {
    ok: true,
    retried: true,
    jobId,
    reason
  };
}

function normalizeChunkSeconds(value) {
  const seconds = Number(value || DEFAULT_CHUNK_SECONDS);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_CHUNK_SECONDS;
  return Math.max(60, Math.min(1800, Math.floor(seconds)));
}

function uuidOrNull(value) {
  const text = cleanText(value, 80);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

async function selectPlanChunksJob(db, campaign, jobId) {
  const params = [campaign, jobId || null];
  const result = await db.query(
    `
select pj.*, s.source_session_id, s.title session_title, c.slug campaign_slug
from processing_jobs pj
join sessions s on s.id = pj.session_id
join campaigns c on c.id = s.campaign_id
where c.slug = $1
  and pj.job_type = 'cloud_plan_audio_chunks'
  and ($2::uuid is null or pj.id = $2::uuid)
  and pj.status in ('queued','retrying','running','succeeded')
order by case when $2::uuid is not null and pj.id = $2::uuid then 0 else 1 end, pj.created_at asc
limit 1;`,
    params
  );
  return result.rows[0] || null;
}

async function claimPlanChunksJob(db, campaign, jobId) {
  const result = await db.query(
    `
with candidate as (
  select pj.id
  from processing_jobs pj
  join sessions s on s.id = pj.session_id
  join campaigns c on c.id = s.campaign_id
  where c.slug = $1
    and pj.job_type = 'cloud_plan_audio_chunks'
    and ($2::uuid is null or pj.id = $2::uuid)
    and pj.status in ('queued','retrying')
  order by case when $2::uuid is not null and pj.id = $2::uuid then 0 else 1 end, pj.created_at asc
  limit 1
  for update skip locked
), updated as (
  update processing_jobs pj
  set status = 'running',
      attempts = coalesce(pj.attempts, 0) + 1,
      started_at = now(),
      finished_at = null,
      error = null,
      output = coalesce(pj.output, '{}'::jsonb) || jsonb_build_object(
        'workerStatus', 'chunk_plan_running',
        'worker', 'vercel_cloud_plan_chunks',
        'paidAiCostUsd', 0
      )
  from candidate
  where pj.id = candidate.id
  returning pj.*
)
select updated.*, s.source_session_id, s.title session_title, c.slug campaign_slug
from updated
join sessions s on s.id = updated.session_id
join campaigns c on c.id = s.campaign_id;`,
    [campaign, jobId || null]
  );
  return result.rows[0] || null;
}

async function failPlanChunksJob(db, job, error, extra = {}) {
  await db.query(
    `
update processing_jobs
set status = 'failed',
    output = coalesce(output, '{}'::jsonb) || $3::jsonb,
    finished_at = now(),
    error = $2
where id = $1::uuid;`,
    [
      job.id,
      String(error.message || error).slice(0, 4000),
      JSON.stringify({
        workerStatus: 'chunk_plan_failed',
        paidAiCostUsd: 0,
        failedAt: new Date().toISOString(),
        ...extra
      })
    ]
  );
  await markJobStep(db, job, 'failed', {
    error: error.message || String(error),
    progress: { workerStatus: 'chunk_plan_failed', paidAiCostUsd: 0 },
    retryable: true
  });
}

function trackKeyFromRecordingFile(file) {
  const metadata = file.metadata || {};
  const fromMetadata = cleanText(metadata.track_key || metadata.source_track_key, 120);
  if (fromMetadata) return fromMetadata;
  const fromRole = cleanText(file.source_file_role, 160).replace(/^craig_track_/, '');
  if (fromRole) return fromRole;
  return cleanText(file.original_filename, 160)
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/^\d+-/, '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase();
}

async function recordingFilesForChunkPlan(db, job) {
  const inputFiles = Array.isArray(job.input?.trackFiles) ? job.input.trackFiles : [];
  const ids = inputFiles.map(item => uuidOrNull(item.recordingFileId || item.recording_file_id)).filter(Boolean);
  const paths = inputFiles.map(item => cleanText(item.storagePath || item.storage_path, 1200)).filter(Boolean);
  const result = await db.query(
    `
select rf.id, rf.session_id, rf.storage_bucket, rf.storage_path, rf.original_filename,
       rf.mime_type, rf.size_bytes, rf.duration_ms, rf.source_file_role, rf.metadata
from recording_files rf
where rf.session_id = $1::uuid
  and rf.file_type = 'craig_track'
  and nullif(rf.storage_bucket, '') is not null
  and nullif(rf.storage_path, '') is not null
  and (
    (cardinality($2::uuid[]) = 0 and cardinality($3::text[]) = 0)
    or rf.id = any($2::uuid[])
    or rf.storage_path = any($3::text[])
  )
order by rf.source_file_role nulls last, rf.original_filename nulls last, rf.created_at asc;`,
    [job.session_id, ids, paths]
  );
  return result.rows.map(file => ({
    ...file,
    recordingFileId: file.id,
    trackKey: trackKeyFromRecordingFile(file)
  }));
}

async function fetchR2RangeBuffer(bucket, key, start, end) {
  const response = await fetch(createR2SignedUrl(key, 300, bucket, 'GET'), {
    headers: { Range: `bytes=${start}-${end}` }
  });
  if (response.status !== 206) {
    const message = await response.text().catch(() => '');
    throw httpError(502, `R2 range falhou (${response.status}) para ${key}: ${message.slice(0, 200)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function parseFlacStreamInfo(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 42) return null;
  if (buffer.subarray(0, 4).toString('ascii') !== 'fLaC') return null;
  let offset = 4;
  while (offset + 4 <= buffer.length) {
    const header = buffer[offset];
    const type = header & 0x7f;
    const length = buffer.readUIntBE(offset + 1, 3);
    const blockStart = offset + 4;
    const blockEnd = blockStart + length;
    if (blockEnd > buffer.length) return null;
    if (type === 0 && length >= 34) {
      const packedBytes = buffer.subarray(blockStart + 10, blockStart + 18);
      let packed = 0n;
      for (const byte of packedBytes) packed = (packed << 8n) | BigInt(byte);
      const sampleRateHz = Number((packed >> 44n) & 0xfffffn);
      const channels = Number((packed >> 41n) & 0x7n) + 1;
      const bitsPerSample = Number((packed >> 36n) & 0x1fn) + 1;
      const totalSamples = Number(packed & 0xfffffffffn);
      const durationMs = sampleRateHz > 0 && totalSamples > 0
        ? Math.round((totalSamples * 1000) / sampleRateHz)
        : null;
      return {
        sampleRateHz,
        channels,
        bitsPerSample,
        totalSamples,
        durationMs
      };
    }
    offset = blockEnd;
    if ((header & 0x80) !== 0) break;
  }
  return null;
}

async function enrichTrackDuration(track) {
  if (Number(track.duration_ms || 0) > 0) {
    return {
      ...track,
      durationMs: Number(track.duration_ms),
      streamInfo: null,
      durationSource: 'recording_files'
    };
  }
  const header = await fetchR2RangeBuffer(track.storage_bucket, track.storage_path, 0, 65535);
  const streamInfo = parseFlacStreamInfo(header);
  if (!streamInfo?.durationMs) {
    throw httpError(422, `Nao foi possivel ler duracao FLAC de ${track.storage_path}.`);
  }
  return {
    ...track,
    durationMs: streamInfo.durationMs,
    streamInfo,
    durationSource: 'flac_streaminfo'
  };
}

async function updateTrackAudioMetadata(db, track) {
  if (!track.streamInfo?.durationMs) return;
  const metadata = {
    duration_source: 'flac_streaminfo',
    duration_scanned_at: new Date().toISOString(),
    sample_rate_hz: track.streamInfo.sampleRateHz,
    channels: track.streamInfo.channels,
    bits_per_sample: track.streamInfo.bitsPerSample,
    total_samples: track.streamInfo.totalSamples
  };
  await db.query(
    `
update recording_files
set duration_ms = coalesce(duration_ms, $2::integer),
    metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb
where id = $1::uuid;`,
    [track.recordingFileId, track.durationMs, JSON.stringify(metadata)]
  );
  await db.query(
    `
update audio_artifacts
set duration_ms = coalesce(duration_ms, $2::integer),
    sample_rate_hz = coalesce(sample_rate_hz, $3::integer),
    channels = coalesce(channels, $4::integer),
    codec = coalesce(codec, 'flac'),
    metadata = coalesce(metadata, '{}'::jsonb) || $5::jsonb,
    updated_at = now()
where source_file_id = $1::uuid
   or (storage_bucket = $6 and storage_path = $7);`,
    [
      track.recordingFileId,
      track.durationMs,
      track.streamInfo.sampleRateHz,
      track.streamInfo.channels,
      JSON.stringify(metadata),
      track.storage_bucket,
      track.storage_path
    ]
  );
}

function buildTrackChunkRows(track, chunkSeconds) {
  const chunkMs = chunkSeconds * 1000;
  const durationMs = Number(track.durationMs || 0);
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw httpError(422, `Duracao invalida para track ${track.trackKey || track.recordingFileId}.`);
  }
  const rows = [];
  const count = Math.max(1, Math.ceil(durationMs / chunkMs));
  for (let index = 0; index < count; index += 1) {
    const startMs = index * chunkMs;
    const endMs = Math.min(durationMs, (index + 1) * chunkMs);
    rows.push({
      sourceFileId: track.recordingFileId,
      trackKey: track.trackKey,
      chunkIndex: index,
      startMs,
      endMs,
      durationMs: Math.max(0, endMs - startMs),
      sourceChunkName: `${track.trackKey || 'track'}_chunk_${String(index).padStart(3, '0')}`,
      metadata: {
        planned_from: 'cloud_plan_audio_chunks',
        planned_only: true,
        requires_render: true,
        source_track_bucket: track.storage_bucket,
        source_track_path: track.storage_path,
        source_track_size_bytes: track.size_bytes || null,
        chunk_seconds: chunkSeconds,
        duration_source: track.durationSource,
        stream_info: track.streamInfo || null
      }
    });
  }
  return rows;
}

async function upsertPlannedChunks(db, job, chunks) {
  if (!chunks.length) return 0;
  const rows = chunks.map(row => ({
    source_file_id: row.sourceFileId,
    chunk_index: row.chunkIndex,
    start_ms: row.startMs,
    end_ms: row.endMs,
    track_key: row.trackKey,
    source_chunk_name: row.sourceChunkName,
    duration_ms: row.durationMs,
    metadata: row.metadata
  }));
  const result = await db.query(
    `
with rows as (
  select *
  from jsonb_to_recordset($2::jsonb) as row_data(
    source_file_id uuid,
    chunk_index integer,
    start_ms integer,
    end_ms integer,
    track_key text,
    source_chunk_name text,
    duration_ms integer,
    metadata jsonb
  )
)
insert into audio_chunks (
  id, session_id, source_file_id, chunk_index, start_ms, end_ms,
  storage_bucket, storage_path, transcription_status, track_key, source_chunk_name,
  duration_ms, size_bytes, metadata, created_at, updated_at
)
select
  gen_random_uuid(), $1::uuid, rows.source_file_id, rows.chunk_index, rows.start_ms, rows.end_ms,
  null, null, 'planned_cloud_chunk', rows.track_key, rows.source_chunk_name,
  rows.duration_ms, null, rows.metadata, now(), now()
from rows
on conflict (session_id, track_key, chunk_index) where track_key is not null
do update set
  source_file_id = excluded.source_file_id,
  start_ms = excluded.start_ms,
  end_ms = excluded.end_ms,
  storage_bucket = null,
  storage_path = null,
  transcription_status = case
    when audio_chunks.transcription_status in ('transcribed','cached') then audio_chunks.transcription_status
    else excluded.transcription_status
  end,
  source_chunk_name = excluded.source_chunk_name,
  duration_ms = excluded.duration_ms,
  metadata = coalesce(audio_chunks.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now()
returning id;`,
    [job.session_id, JSON.stringify(rows)]
  );
  return result.rowCount || 0;
}

async function insertDetectSpeechJob(db, job, chunkSummary) {
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
        chunks: chunkSummary.chunks,
        chunkSeconds: chunkSummary.chunkSeconds
      }),
      JSON.stringify({
        workerStatus: 'pending_worker_implementation',
        nextAction: 'Renderizar audio compacto/chunks e detectar fala antes de qualquer transcricao paga.',
        paidAiCostUsd: 0
      }),
      job.id
    ]
  );
  return result.rows[0]?.id || null;
}

async function runCloudPlanChunks(req, campaign, body) {
  await requirePermission(req, campaign, {
    action: 'project.jobs.run',
    scopeType: 'project',
    scopeId: PROJECT_SCOPE_ID,
    legacyRoles: ['owner', 'master'],
    error: 'Planejar chunks exige permissao project.jobs.run.'
  });
  const dryRun = body.dryRun !== false;
  const jobId = uuidOrNull(body.jobId || body.job_id);
  const chunkSeconds = normalizeChunkSeconds(body.chunkSeconds || body.chunk_seconds);
  const db = getPool();
  const job = dryRun
    ? await selectPlanChunksJob(db, campaign, jobId)
    : await claimPlanChunksJob(db, campaign, jobId);
  if (!job) {
    return {
      ok: true,
      processed: false,
      dryRun,
      mode: 'cloud_plan_audio_chunks',
      message: jobId ? `Job nao encontrado ou nao elegivel: ${jobId}` : 'Nenhum job cloud_plan_audio_chunks pendente.'
    };
  }
  try {
    if (!dryRun) {
      await markJobStep(db, job, 'running', {
        progress: { workerStatus: 'chunk_plan_running', paidAiCostUsd: 0, chunkSeconds }
      });
    }
    const rawTracks = await recordingFilesForChunkPlan(db, job);
    if (!rawTracks.length) throw httpError(422, 'Nenhuma faixa craig_track encontrada para planejar chunks.');
    const tracks = [];
    const chunks = [];
    for (const rawTrack of rawTracks) {
      const track = await enrichTrackDuration(rawTrack);
      if (!dryRun) await updateTrackAudioMetadata(db, track);
      const trackChunks = buildTrackChunkRows(track, chunkSeconds);
      tracks.push({
        recordingFileId: track.recordingFileId,
        trackKey: track.trackKey,
        durationMs: track.durationMs,
        chunkCount: trackChunks.length,
        durationSource: track.durationSource,
        storagePath: track.storage_path
      });
      chunks.push(...trackChunks);
    }
    const summary = {
      workerStatus: 'chunk_plan_succeeded',
      paidAiCostUsd: 0,
      chunkSeconds,
      tracks: tracks.length,
      chunks: chunks.length,
      audioMinutes: Math.round((chunks.reduce((total, item) => total + item.durationMs, 0) / 60000) * 1000) / 1000,
      trackPlan: tracks
    };
    if (dryRun) {
      return {
        ok: true,
        processed: true,
        dryRun: true,
        mode: 'cloud_plan_audio_chunks',
        jobId: job.id,
        sourceSessionId: job.source_session_id,
        summary,
        cost: { paidAiCostUsd: 0 }
      };
    }
    const persistedChunks = await upsertPlannedChunks(db, job, chunks);
    const nextJobId = await insertDetectSpeechJob(db, job, {
      chunks: chunks.length,
      chunkSeconds
    });
    await db.query(
      `
update processing_jobs
set status = 'succeeded',
    output = coalesce(output, '{}'::jsonb) || $2::jsonb,
    finished_at = now(),
    error = null
where id = $1::uuid;`,
      [
        job.id,
        JSON.stringify({
          ...summary,
          persistedChunks,
          nextJobId,
          completedAt: new Date().toISOString()
        })
      ]
    );
    await markJobStep(db, job, 'succeeded', {
      retryable: false,
      progress: { ...summary, persistedChunks, nextJobId }
    });
    await db.query(
      `
update sessions
set status = case when status in ('uploaded','processing') then 'processing' else status end,
    metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
    updated_at = now()
where id = $1::uuid;`,
      [
        job.session_id,
        JSON.stringify({
          cloud_plan_audio_chunks: {
            source_job_id: job.id,
            completed_at: new Date().toISOString(),
            chunks: chunks.length,
            chunk_seconds: chunkSeconds
          }
        })
      ]
    );
    return {
      ok: true,
      processed: true,
      dryRun: false,
      mode: 'cloud_plan_audio_chunks',
      jobId: job.id,
      sourceSessionId: job.source_session_id,
      summary: { ...summary, persistedChunks, nextJobId },
      cost: { paidAiCostUsd: 0 }
    };
  } catch (error) {
    if (!dryRun) await failPlanChunksJob(db, job, error, { chunkSeconds });
    throw error;
  }
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
    const attachToExisting = raw.attachToExisting === true
      || raw.attach_to_existing === true
      || raw.confirmExistingSession === true
      || raw.confirm_existing_session === true;
    if (!attachToExisting) {
      throw httpError(409, 'Upload Craig em sessao existente exige confirmacao explicita. Deixe a sessao alvo vazia para criar uma sessao nova pelo ZIP.');
    }
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
  const recordingId = craigRecordingIdFromFilename(fileName);
  const inferredTitle = cleanText(raw.title, 180)
    || (recordingId ? `Sessao Craig ${recordingId}` : fileName.replace(/(\.flac)?\.zip$/i, ''));
  const sessionDate = normalizeDate(raw.sessionDate || raw.session_date);
  const generatedSourceId = recordingId ? `craig-${recordingId}` : generatedSourceSessionId(inferredTitle, sessionDate);
  const slug = slugify(`${sessionDate || 'sem-data'}-${inferredTitle}`);
  const result = await db.query(
    `
with campaign_row as (
  select id from campaigns where slug = $1
), upserted as (
  insert into sessions (
    id, campaign_id, title, slug, session_date, arc, status, summary_short,
    source_system, source_session_id, metadata, created_at, updated_at
  )
  select gen_random_uuid(), campaign_row.id, $2, $3, $4::date, $5, 'uploaded', $6,
         'craig', $7, $8::jsonb, now(), now()
  from campaign_row
  on conflict (campaign_id, source_system, source_session_id)
  where source_system is not null and source_session_id is not null
  do update set
    updated_at = now(),
    metadata = coalesce(sessions.metadata, '{}'::jsonb) || excluded.metadata
  returning *
)
select * from upserted;`,
    [
      campaign,
      inferredTitle,
      slug,
      sessionDate,
      cleanText(raw.arc, 120) || null,
      cleanText(raw.summary || raw.summaryShort || raw.summary_short, 2000) || null,
      generatedSourceId,
      JSON.stringify({
        created_by: 'api/vercel',
        created_from: 'craig_direct_upload',
        auth_required: true,
        inferred_recording_id: recordingId || null
      })
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
        workerStatus: 'ready_to_run',
        nextAction: 'Executar cloud_ingest_craig pela tela Operacao para ler o manifest do ZIP no R2.',
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
    session: {
      sourceSessionId: context.source_session_id,
      title: context.session_title
    },
    upload: {
      recordingFileId,
      storageBucket: context.storage_bucket,
      storagePath: context.storage_path,
      originalFilename: context.original_filename,
      sizeBytes: raw.sizeBytes || context.size_bytes || null
    },
    job: jobResponse(ingestJobResult.rows[0]),
    cost: {
      paidAiCostUsd: 0,
      note: 'Upload confirmado. O job cloud_ingest_craig esta pronto para execucao sem IA paga.'
    }
  };
}

function sessionResponse(row) {
  return {
    id: row.id,
    title: row.title,
    sourceSessionId: row.source_session_id,
    sourceSystem: row.source_system,
    sessionDate: dateOnly(row.session_date),
    startedAt: row.started_at,
    endedAt: row.ended_at,
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
  const startedAt = normalizeDateTime(raw.startedAt || raw.started_at, 'startedAt');
  const endedAt = normalizeDateTime(raw.endedAt || raw.ended_at, 'endedAt');
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
    id, campaign_id, title, slug, session_date, started_at, ended_at, duration_ms, arc, status, summary_short,
    source_system, source_session_id, metadata, created_at, updated_at
  )
  select gen_random_uuid(), campaign_row.id, $2, $3, $4::date, $5::timestamptz, $6::timestamptz,
         case
           when $5::timestamptz is not null and $6::timestamptz is not null and $6::timestamptz > $5::timestamptz
             then floor(extract(epoch from ($6::timestamptz - $5::timestamptz)) * 1000)::integer
           else null
         end,
         $7, $8, $9,
         'manual', $10, $11::jsonb, now(), now()
  from campaign_row
  returning *
)
select * from inserted;`,
    [campaign, title, slug, sessionDate, startedAt, endedAt, arc, status, summary, sourceSessionId, JSON.stringify(metadata)]
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
  const startedAt = normalizeDateTime(raw.startedAt || raw.started_at, 'startedAt');
  const endedAt = normalizeDateTime(raw.endedAt || raw.ended_at, 'endedAt');
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
    started_at = $5::timestamptz,
    ended_at = $6::timestamptz,
    duration_ms = case
      when $5::timestamptz is not null and $6::timestamptz is not null and $6::timestamptz > $5::timestamptz
        then floor(extract(epoch from ($6::timestamptz - $5::timestamptz)) * 1000)::integer
      when $6::timestamptz is null then null
      else null
    end,
    arc = $7,
    status = $8,
    summary_short = $9,
    metadata = coalesce(s.metadata, '{}'::jsonb) || $10::jsonb,
    updated_at = now()
from campaigns c
where c.id = s.campaign_id
  and c.slug = $1
  and s.source_session_id = $2
returning s.*;`,
    [campaign, sourceId, title, sessionDate, startedAt, endedAt, arc, status, summary, JSON.stringify(metadataPatch)]
  );
  if (!result.rows.length) throw httpError(404, `Sessao nao encontrada: ${sourceId}`);
  return sessionResponse(result.rows[0]);
}

function targetCte() {
  return `
with target as (
  select c.id campaign_id, c.slug campaign_slug, c.name campaign_name,
         s.id session_id, s.title session_title, s.source_session_id,
         s.session_date, s.arc, s.status, s.duration_ms, s.summary_short, s.started_at, s.ended_at
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
    'sessionDate', to_char(s.session_date, 'YYYY-MM-DD'),
    'startedAt', s.started_at,
    'endedAt', s.ended_at,
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
    'payload', re.payload,
    'note', case when tn.id is null then null else json_build_object(
      'id', tn.id,
      'note_type', tn.note_type,
      'visibility', tn.visibility,
      'review_status', tn.review_status,
      'created_at', tn.created_at
    ) end
  ) item
  from roll20_events re
  join target t on t.session_id = re.session_id
  left join table_notes tn
    on tn.source_system = 'roll20'
   and tn.source_id = 'roll20-note:' || re.id::text
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
      date: dateOnly(session.session_date),
      arc: session.arc,
      status: session.status,
      durationMs: session.duration_ms,
      startedAt: session.started_at,
      endedAt: session.ended_at,
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

function splitTextIntoPhrases(text) {
  const clean = cleanText(text, 20000);
  if (!clean) return [];
  const matches = clean.match(/[^.!?;:\n]+[.!?;:]?/g) || [clean];
  const phrases = matches.map(item => item.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (phrases.length <= 1) return phrases;
  const compact = [];
  for (const phrase of phrases) {
    const previous = compact[compact.length - 1] || '';
    if (phrase.length < 18 && previous && `${previous} ${phrase}`.length <= 160) {
      compact[compact.length - 1] = `${previous} ${phrase}`;
    } else {
      compact.push(phrase);
    }
  }
  return compact;
}

function phraseTimelineItems(segment) {
  const text = cleanText(segment.text, 20000);
  if (!text) return [];
  const startMs = Number(segment.start_ms || 0);
  const endMs = Number(segment.end_ms || startMs);
  const durationMs = Math.max(0, endMs - startMs);
  const phrases = splitTextIntoPhrases(text);
  if (!phrases.length) return [];
  if (phrases.length === 1 || durationMs < 2500) {
    return [{
      id: `${segment.id || segment.source_segment_id}:phrase:0`,
      segmentId: segment.id || segment.source_segment_id,
      sourceSegmentId: segment.source_segment_id || null,
      phraseIndex: 0,
      trackKey: segment.track_key || null,
      speakerName: segment.speaker_name || null,
      characterName: segment.character_name || null,
      startMs,
      endMs,
      durationMs,
      text,
      confidence: segment.raw_confidence || null,
      timingMode: 'segment_exact'
    }];
  }
  const totalWeight = phrases.reduce((sum, phrase) => sum + Math.max(1, phrase.length), 0);
  let cursor = startMs;
  return phrases.map((phrase, index) => {
    const isLast = index === phrases.length - 1;
    const weight = Math.max(1, phrase.length);
    const phraseDuration = isLast ? endMs - cursor : Math.max(200, Math.round(durationMs * (weight / totalWeight)));
    const phraseEnd = isLast ? endMs : Math.min(endMs, cursor + phraseDuration);
    const item = {
      id: `${segment.id || segment.source_segment_id}:phrase:${index}`,
      segmentId: segment.id || segment.source_segment_id,
      sourceSegmentId: segment.source_segment_id || null,
      phraseIndex: index,
      trackKey: segment.track_key || null,
      speakerName: segment.speaker_name || null,
      characterName: segment.character_name || null,
      startMs: cursor,
      endMs: phraseEnd,
      durationMs: Math.max(0, phraseEnd - cursor),
      text: phrase,
      confidence: segment.raw_confidence || null,
      timingMode: 'phrase_estimated_from_segment'
    };
    cursor = phraseEnd;
    return item;
  });
}

async function buildTimelinePayload(campaign, sourceSessionId, access = null, db = getPool()) {
  const common = targetCte();
  const params = [campaign, sourceSessionId];
  const noteParams = [
    campaign,
    sourceSessionId,
    access?.profile?.id || null,
    ['owner', 'master', 'reviewer'].includes(access?.campaignRole || '')
  ];
  const session = await data(`${common} select row_to_json(target) data from target;`, params, db);
  if (!session) throw httpError(404, `Sessao nao encontrada: ${sourceSessionId}`);
  const [
    participants,
    segments,
    recordingFiles,
    roll20Events,
    discordEvents
  ] = await Promise.all([
    data(
      `${common}
select coalesce(json_agg(item order by item->>'trackKey'), '[]'::json) data from (
  select json_build_object(
    'id', p.id,
    'trackKey', p.source_track_key,
    'playerName', p.player_name,
    'characterName', p.character_name,
    'role', p.role,
    'audioTrackLabel', p.audio_track_label,
    'discordHandle', p.discord_handle
  ) item
  from participants p
  join target t on t.session_id = p.session_id
) rows;`,
      params,
      db
    ),
    data(
      `${common}
select coalesce(json_agg(item order by (item->>'startMs')::int, item->>'trackKey', item->>'sourceSegmentId'), '[]'::json) data from (
  select json_build_object(
    'id', ts.id,
    'sourceSegmentId', ts.source_segment_id,
    'sourceSequence', ts.source_sequence,
    'trackKey', ts.track_key,
    'speakerName', ts.speaker_name,
    'speakerRole', ts.speaker_role,
    'characterName', ts.character_name,
    'startMs', ts.start_ms,
    'endMs', ts.end_ms,
    'chunkIndex', ts.chunk_index,
    'text', ts.text,
    'textChars', ts.text_chars,
    'textWords', ts.text_words,
    'reviewStatus', ts.review_status,
    'needsReview', ts.needs_review,
    'tags', ts.tags,
    'sourceChunkPath', ts.source_chunk_path,
    'metadata', ts.metadata
  ) item
  from transcript_segments ts
  join target t on t.session_id = ts.session_id
  where ts.is_empty = false
) rows;`,
      params,
      db
    ),
    data(
      `${common}
select coalesce(json_agg(item order by item->>'sourceFileRole'), '[]'::json) data from (
  select json_build_object(
    'id', rf.id,
    'sourceFileRole', rf.source_file_role,
    'fileType', rf.file_type,
    'storageBucket', rf.storage_bucket,
    'storagePath', rf.storage_path,
    'originalFilename', rf.original_filename,
    'mimeType', rf.mime_type,
    'sizeBytes', rf.size_bytes,
    'durationMs', rf.duration_ms
  ) item
  from recording_files rf
  join target t on t.session_id = rf.session_id
) rows;`,
      params,
      db
    ),
    data(
      `${common}
select coalesce(json_agg(item order by coalesce((item->>'startMs')::int, 2147483647), item->>'createdAt'), '[]'::json) data from (
  select json_build_object(
    'id', re.id,
    'eventType', re.event_type,
    'speaker', re.roll20_who,
    'characterName', re.character_name,
    'startMs', re.approx_start_ms,
    'text', re.text,
    'sourceSystem', re.source_system,
    'sourceEventId', re.source_event_id,
    'createdAtRoll20', re.created_at_roll20,
    'createdAt', re.created_at,
    'payload', re.payload
  ) item
  from roll20_events re
  join target t on t.session_id = re.session_id
) rows;`,
      params,
      db
    ),
    data(
      `${common}
select coalesce(json_agg(item order by coalesce((item->>'startMs')::int, 2147483647), item->>'createdAt'), '[]'::json) data from (
  select json_build_object(
    'id', tn.id,
    'noteType', tn.note_type,
    'visibility', tn.visibility,
    'reviewStatus', tn.review_status,
    'authorProfileId', tn.author_profile_id,
    'authorDiscordId', tn.author_discord_id,
    'authorName', tn.author_name,
    'startMs', case
      when (tn.metadata #>> '{timeline,startMs}') ~ '^\\d+$' then (tn.metadata #>> '{timeline,startMs}')::int
      else null
    end,
    'text', tn.content,
    'sourceSystem', tn.source_system,
    'sourceId', tn.source_id,
    'createdAt', tn.created_at,
    'metadata', tn.metadata
  ) item
  from table_notes tn
  join target t on t.session_id = tn.session_id
  where tn.source_system = 'discord'
    and (
      $4::boolean
      or tn.author_profile_id = $3::uuid
      or tn.visibility in ('player_visible', 'public_candidate')
    )
) rows;`,
      noteParams,
      db
    )
  ]);

  const phraseItems = (segments || []).flatMap(segment => phraseTimelineItems({
    ...segment,
    id: segment.id,
    source_segment_id: segment.sourceSegmentId,
    track_key: segment.trackKey,
    speaker_name: segment.speakerName,
    character_name: segment.characterName,
    start_ms: segment.startMs,
    end_ms: segment.endMs,
    raw_confidence: segment.rawConfidence
  }));
  const timelineItems = [
    ...phraseItems.map(item => ({
      ...item,
      kind: 'speech',
      laneId: `speaker:${item.trackKey || item.speakerName || 'unknown'}`,
      title: item.characterName || item.speakerName || item.trackKey || 'Fala',
      subtitle: item.speakerName || item.trackKey || 'audio'
    })),
    ...(roll20Events || []).map(event => ({
      id: event.id,
      kind: 'roll20',
      laneId: 'event:roll20',
      title: roll20DiceTimelineTitle(event) || event.eventType || 'roll20',
      subtitle: [event.speaker, event.characterName].filter(Boolean).join(' / ') || 'Roll20',
      startMs: event.startMs,
      endMs: event.startMs,
      durationMs: 0,
      text: event.text || event.payload?.rawCommand || event.sourceEventId || 'Evento Roll20',
      raw: event
    })),
    ...(discordEvents || []).map(event => ({
      id: event.id,
      kind: 'discord',
      laneId: 'event:discord',
      title: event.authorName || event.authorDiscordId || 'Discord',
      subtitle: [event.noteType, event.reviewStatus].filter(Boolean).join(' / ') || 'mensagem',
      startMs: event.startMs,
      endMs: event.startMs,
      durationMs: 0,
      text: event.text || event.sourceId || 'Mensagem Discord',
      timingMode: event.metadata?.timeline?.timingMode || null,
      raw: event
    }))
  ].sort((a, b) => {
    const aAt = a.startMs === null || a.startMs === undefined ? Number.MAX_SAFE_INTEGER : Number(a.startMs);
    const bAt = b.startMs === null || b.startMs === undefined ? Number.MAX_SAFE_INTEGER : Number(b.startMs);
    if (aAt !== bAt) return aAt - bAt;
    return String(a.kind).localeCompare(String(b.kind));
  });
  const durationMs = Math.max(
    Number(session.duration_ms || 0),
    ...timelineItems.map(item => Number(item.endMs || item.startMs || 0)),
    ...(recordingFiles || []).map(file => Number(file.durationMs || 0))
  );
  const lanes = [
    ...(participants || []).map(participant => ({
      id: `speaker:${participant.trackKey || participant.playerName || participant.id}`,
      type: 'speaker',
      trackKey: participant.trackKey,
      label: participant.characterName || participant.playerName || participant.trackKey || 'Speaker',
      subtitle: participant.playerName || participant.discordHandle || '',
      participantId: participant.id
    })),
    { id: 'event:roll20', type: 'event', label: 'Roll20', subtitle: 'chat, dados e notas' },
    { id: 'event:discord', type: 'event', label: 'Discord', subtitle: 'mensagens e notas sincronizadas' },
    { id: 'event:media', type: 'event', label: 'Midia', subtitle: 'imagens e anexos futuros' },
    { id: 'event:ai', type: 'event', label: 'IA', subtitle: 'canon, quote e bastidores futuros' }
  ];
  return {
    ok: true,
    mode: 'timeline_readonly_v1',
    campaignSlug: campaign,
    sourceSessionId,
    session: {
      id: session.session_id,
      title: session.session_title,
      sourceSessionId: session.source_session_id,
      sessionDate: dateOnly(session.session_date),
      startedAt: session.started_at,
      endedAt: session.ended_at,
      arc: session.arc,
      status: session.status,
      durationMs
    },
    stats: {
      lanes: lanes.length,
      transcriptSegments: (segments || []).length,
      phraseItems: phraseItems.length,
      roll20Events: (roll20Events || []).length,
      discordEvents: (discordEvents || []).length,
      recordingFiles: (recordingFiles || []).length,
      syncedItems: timelineItems.filter(item => item.startMs !== null && item.startMs !== undefined).length,
      totalItems: timelineItems.length,
      timingNote: 'Phrase timings are local estimates inside already-transcribed segments; no extra OpenAI cost.'
    },
    lanes,
    participants: participants || [],
    recordingFiles: recordingFiles || [],
    transcriptSegments: segments || [],
    phrases: phraseItems,
    roll20Events: roll20Events || [],
    discordEvents: discordEvents || [],
    items: timelineItems
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
    `- Data: \`${dateOnly(session.session_date) || 'sem data'}\``,
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
  if (path === '/api/roll20-bridge/config' || path === '/api/roll20/bridge/config') {
    const access = await requireCampaignAccess(req, campaign, ['owner', 'master']);
    const token = roll20BridgeToken();
    return sendJson(res, 200, {
      ok: true,
      campaignSlug: campaign,
      apiBase: process.env.DND_PUBLIC_SITE_URL || 'https://dnd.faysk.dev',
      source: 'roll20_bridge_config',
      tokenConfigured: Boolean(token),
      bridgeToken: token,
      actor: {
        profileId: access.profile?.id || null,
        displayName: access.profile?.displayName || access.user?.displayName || null,
        role: access.campaignRole || null
      }
    });
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
  if (path === '/api/pipeline-control' || path === '/api/pipeline/status') {
    await requireCampaignAccess(req, campaign);
    const payload = await buildPipelineControlPayload(campaign, query.get('sourceSessionId') || '', {
      limit: query.get('limit') || query.get('transcriptionLimit') || DEFAULT_TRANSCRIPTION_LIMIT
    });
    return sendJson(res, 200, payload);
  }
  if (path === '/api/monitoring') {
    const access = await requirePermission(req, campaign, {
      action: 'project.monitor.read',
      scopeType: 'project',
      scopeId: PROJECT_SCOPE_ID,
      legacyRoles: ['owner', 'master'],
      error: 'Monitoramento tecnico exige permissao project.monitor.read.'
    });
    const deep = ['1', 'true', 'yes'].includes(String(query.get('deep') || '').toLowerCase());
    return sendJson(res, 200, await buildMonitoringPayload(getPool(), {
      campaignSlug: campaign,
      runId,
      deep,
      actor: {
        profileId: access.profile?.id || null,
        displayName: access.profile?.displayName || access.user?.displayName || null,
        role: access.campaignRole || null
      }
    }));
  }
  if (path === '/api/rbac') {
    const access = await rbacAdminAccess(req, campaign);
    return sendJson(res, 200, await rbacAdminPayload(getPool(), access, campaign));
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
  if (path === '/api/timeline') {
    const access = await requireCampaignAccess(req, campaign);
    return sendJson(res, 200, await buildTimelinePayload(campaign, sourceSessionId, access));
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
  if (path === '/api/rbac/assign') {
    const client = await getPool().connect();
    try {
      await client.query('begin');
      const payload = await assignRbacRole(client, req, campaign, body);
      await client.query('commit');
      return sendJson(res, 200, payload);
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  if (path === '/api/rbac/revoke') {
    const client = await getPool().connect();
    try {
      await client.query('begin');
      const payload = await revokeRbacAssignment(client, req, campaign, body);
      await client.query('commit');
      return sendJson(res, 200, payload);
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  if (path === '/api/rbac/transfer-dm') {
    const client = await getPool().connect();
    try {
      await client.query('begin');
      const payload = await transferCampaignDm(client, req, campaign, body);
      await client.query('commit');
      return sendJson(res, 200, payload);
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  if (path === '/api/roll20-event-note') {
    const client = await getPool().connect();
    try {
      await client.query('begin');
      const payload = await convertRoll20EventToNote(client, req, campaign, body);
      await client.query('commit');
      return sendJson(res, 200, payload);
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
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
  if (isRoll20BridgePath(path)) {
    const payload = await roll20BridgePayload(req, campaign, body);
    if (body.dryRun === true) return sendJson(res, 200, payload);
    const client = await getPool().connect();
    try {
      await client.query('begin');
      const persisted = await persistRoll20Events(client, campaign, payload, {
        ...body,
        bridgeToken: undefined,
        bridge_token: undefined
      });
      await client.query('commit');
      return sendJson(res, 200, {
        ...payload,
        mode: 'roll20_bridge_persisted',
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
  if (path === '/api/discord/sync-channel' || path === '/api/discord-sync-channel') {
    const access = await requireCampaignAccess(req, campaign, ['owner', 'master', 'reviewer']);
    const client = await getPool().connect();
    try {
      await client.query('begin');
      const payload = await persistDiscordMessages(client, campaign, sourceSessionId, body, access);
      await client.query('commit');
      return sendJson(res, 200, payload);
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  if (path === '/api/jobs/retry' || path === '/api/job-retry') {
    const payload = await retryProcessingJob(req, campaign, body);
    return sendJson(res, 200, { ...payload, jobs: await listJobs(campaign), sessions: await listSessions(campaign, runId) });
  }
  if (path === '/api/jobs/control' || path === '/api/job-control') {
    const payload = await controlProcessingJob(req, campaign, body);
    return sendJson(res, 200, {
      ...payload,
      jobs: await listJobs(campaign, payload.sourceSessionId || ''),
      sessions: await listSessions(campaign, runId)
    });
  }
  if (path === '/api/pipeline-continue' || path === '/api/jobs/pipeline-continue') {
    const payload = await runPipelineContinue(req, campaign, body);
    const jobSourceSessionId = payload.sourceSessionId || cleanText(body.sourceSessionId || body.source_session_id, 180);
    return sendJson(res, 200, {
      ...payload,
      jobs: await listJobs(campaign, jobSourceSessionId || ''),
      sessions: await listSessions(campaign, runId)
    });
  }
  if (path === '/api/pipeline-control' || path === '/api/pipeline/action') {
    const payload = await runPipelineControlAction(req, campaign, body);
    return sendJson(res, 200, {
      ...payload,
      jobs: await listJobs(campaign, payload.sourceSessionId || body.sourceSessionId || ''),
      sessions: await listSessions(campaign, runId)
    });
  }
  if (path === '/api/run-cloud-plan-chunks' || path === '/api/jobs/run-cloud-plan-chunks') {
    const payload = await runCloudPlanChunks(req, campaign, body);
    return sendJson(res, 200, { ...payload, jobs: await listJobs(campaign), sessions: await listSessions(campaign, runId) });
  }
  if (path === '/api/storage-cleanup-run' || path === '/api/storage/cleanup-run') {
    const payload = await runStorageCleanup(req, campaign, body);
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
    applyRoll20BridgeCors(req, res, path);
    if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
    if (req.method === 'GET') return await handleGet(req, res, path, url.searchParams);
    if (req.method === 'POST') return await handlePost(req, res, path);
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};
