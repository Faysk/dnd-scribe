const { Pool } = require('pg');

const DEFAULT_CAMPAIGN = 'yuhara-main';
const PROJECT_SCOPE_ID = 'dnd-scribe';
const RUNNABLE_JOB_TYPES = [
  'cloud_ingest_craig',
  'cloud_extract_craig_tracks',
  'cloud_plan_audio_chunks'
];
const DEFAULT_STALE_MINUTES = 20;
const MIN_STALE_MINUTES = 5;
const MAX_STALE_MINUTES = 120;

let pool;

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_POOLER_URL || process.env.SUPABASE_POOLER_URL || process.env.DATABASE_URL;
  if (!connectionString) throw httpError(500, 'DATABASE_POOLER_URL or DATABASE_URL is not configured.');
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

function cleanText(value, max = 500) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : '';
}

function uuidOrNull(value, fieldName = 'id') {
  const text = cleanText(value, 80);
  if (!text) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw httpError(400, `${fieldName} invalido.`);
  }
  return text;
}

function boundedInteger(value, fallback, min, max) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
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

function authAvatar(user) {
  return user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
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

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(req.body ? JSON.parse(req.body) : {});
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(httpError(413, 'Request body too large.'));
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

async function data(db, sql, params = []) {
  const result = await db.query(sql, params);
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return row.data ?? row.row_to_json ?? row.coalesce ?? Object.values(row)[0] ?? null;
}

async function supabaseUserFromRequest(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const config = authPublicConfig();
  if (!config.supabaseUrl || !config.publishableKey) throw httpError(500, 'Supabase auth config publica ausente.');
  const baseUrl = config.supabaseUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${token}`
    }
  });
  if (response.status === 401 || response.status === 403) throw httpError(401, 'Sessao invalida ou expirada.');
  if (!response.ok) throw httpError(502, `Falha ao validar sessao (${response.status}).`);
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

async function profileForUser(db, userId) {
  return await data(
    `
select row_to_json(profile_row) data
from (
  select id, display_name, discord_id, discord_handle, email
  from profiles
  where auth_user_id = $1::uuid
  limit 1
) profile_row;`,
    [userId]
  );
}

async function rbacTablesAvailable(db) {
  return Boolean(await data(
    db,
    `
select (
  to_regclass('public.role_assignments') is not null
  and to_regclass('public.role_permissions') is not null
  and to_regclass('public.role_definitions') is not null
  and to_regclass('public.permission_catalog') is not null
) data;`
  ));
}

async function profileHasPermission(db, profileId, action, scopeType, scopeId) {
  const available = await rbacTablesAvailable(db);
  if (!available) return { available: false, allowed: false };
  if (!profileId) return { available: true, allowed: false };
  const allowed = Boolean(await data(
    db,
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
    [profileId, action, scopeType, scopeId, PROJECT_SCOPE_ID]
  ));
  return { available: true, allowed };
}

async function legacyCampaignRole(db, profileId, campaignSlug) {
  if (!profileId) return null;
  return await data(
    db,
    `
select cm.role data
from campaign_members cm
join campaigns c on c.id = cm.campaign_id
where cm.profile_id = $1::uuid
  and c.slug = $2
limit 1;`,
    [profileId, campaignSlug]
  );
}

async function requireJobsRun(req, db, campaignSlug) {
  const user = await supabaseUserFromRequest(req);
  if (!user) throw httpError(401, 'Login Discord ou Google obrigatorio.');
  await syncAuthProfile(db, user);
  const profile = await profileForUser(db, user.id);
  const check = await profileHasPermission(db, profile?.id || null, 'project.jobs.run', 'project', PROJECT_SCOPE_ID);
  if (check.allowed) return { user, profile, rbacAvailable: check.available };
  const legacyRole = await legacyCampaignRole(db, profile?.id || null, campaignSlug);
  if (!check.available && ['owner', 'master'].includes(legacyRole || '')) {
    return { user, profile, rbacAvailable: false, legacyRole };
  }
  throw httpError(403, 'Recovery da esteira exige permissao project.jobs.run.');
}

async function recoverStaleJobs(db, campaignSlug, raw) {
  const sourceSessionId = cleanText(raw.sourceSessionId || raw.source_session_id, 180);
  const jobId = uuidOrNull(raw.jobId || raw.job_id, 'jobId');
  const recoverAll = raw.recoverAll === true || raw.recover_all === true;
  if (!sourceSessionId && !jobId && !recoverAll) {
    throw httpError(400, 'Informe sourceSessionId, jobId ou recoverAll=true.');
  }
  const dryRun = raw.dryRun === true || raw.dry_run === true;
  const staleMinutes = boundedInteger(
    raw.staleMinutes || raw.stale_minutes,
    DEFAULT_STALE_MINUTES,
    MIN_STALE_MINUTES,
    MAX_STALE_MINUTES
  );
  const limit = boundedInteger(raw.limit || raw.maxJobs || raw.max_jobs, 10, 1, 25);
  const client = await db.connect();
  try {
    await client.query('begin');
    const targetResult = await client.query(
      `
select pj.id, pj.job_type, pj.status, pj.attempts, pj.started_at, pj.created_at,
       s.source_session_id, s.title session_title,
       floor(extract(epoch from (now() - coalesce(pj.started_at, pj.created_at))) / 60)::int age_minutes
from processing_jobs pj
join sessions s on s.id = pj.session_id
join campaigns c on c.id = s.campaign_id
where c.slug = $1
  and pj.status = 'running'
  and pj.job_type = any($2::text[])
  and ($3::uuid is null or pj.id = $3::uuid)
  and ($4::text = '' or s.source_session_id = $4::text)
  and coalesce(pj.started_at, pj.created_at) < now() - ($5::int * interval '1 minute')
order by coalesce(pj.started_at, pj.created_at), pj.created_at
limit $6::int
for update of pj;`,
      [campaignSlug, RUNNABLE_JOB_TYPES, jobId, sourceSessionId, staleMinutes, limit]
    );
    const targets = targetResult.rows.map(row => ({
      jobId: row.id,
      jobType: row.job_type,
      sourceSessionId: row.source_session_id,
      sessionTitle: row.session_title,
      attempts: row.attempts,
      startedAt: row.started_at,
      createdAt: row.created_at,
      ageMinutes: row.age_minutes
    }));
    if (dryRun || !targets.length) {
      await client.query('rollback');
      return {
        ok: true,
        dryRun,
        staleRecovery: {
          staleMinutes,
          checkedAt: new Date().toISOString(),
          recovered: [],
          candidates: targets
        }
      };
    }

    const ids = targets.map(row => row.jobId);
    await client.query(
      `
update processing_jobs
set status = 'retrying',
    started_at = null,
    finished_at = null,
    error = null,
    output = coalesce(output, '{}'::jsonb) || jsonb_build_object(
      'workerStatus', 'recovered_stale_running',
      'staleRecoveredAt', now(),
      'staleRecoveryReason', 'pipeline_recover_endpoint',
      'staleMinutes', $2::int,
      'paidAiCostUsd', 0
    )
where id = any($1::uuid[]);`,
      [ids, staleMinutes]
    );
    await client.query(
      `
update processing_job_steps
set status = 'retrying',
    error = null,
    retryable = true,
    finished_at = null,
    progress = coalesce(progress, '{}'::jsonb) || jsonb_build_object(
      'staleRecoveredAt', now(),
      'staleRecoveryReason', 'pipeline_recover_endpoint',
      'staleMinutes', $2::int
    ),
    updated_at = now()
where job_id = any($1::uuid[])
  and status in ('running', 'blocked');`,
      [ids, staleMinutes]
    );
    await client.query(
      `
insert into processing_job_steps (
  id, job_id, step_key, label, status, attempts, retryable, order_index,
  progress, created_at, updated_at
)
select gen_random_uuid(), recovered.job_id, 'stale_recovery', 'Recovery automatico', 'retrying',
       0, true, 6,
       jsonb_build_object(
         'staleRecoveredAt', now(),
         'staleRecoveryReason', 'pipeline_recover_endpoint',
         'staleMinutes', $2::int
       ),
       now(), now()
from unnest($1::uuid[]) as recovered(job_id)
on conflict (job_id, step_key) do update set
  label = excluded.label,
  status = excluded.status,
  retryable = true,
  progress = coalesce(processing_job_steps.progress, '{}'::jsonb) || excluded.progress,
  error = null,
  finished_at = null,
  updated_at = now();`,
      [ids, staleMinutes]
    );
    await client.query('commit');
    return {
      ok: true,
      dryRun: false,
      staleRecovery: {
        staleMinutes,
        checkedAt: new Date().toISOString(),
        recovered: targets,
        candidates: targets
      }
    };
  } catch (error) {
    try { await client.query('rollback'); } catch (_rollbackError) {}
    throw error;
  } finally {
    client.release();
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      endpoint: '/api/pipeline-recover',
      method: 'POST',
      authRequired: true,
      permission: 'project.jobs.run',
      staleMinutesDefault: DEFAULT_STALE_MINUTES,
      runnableJobTypes: RUNNABLE_JOB_TYPES
    });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { ok: false, error: 'Metodo nao permitido.' });
  }
  try {
    const body = await readBody(req);
    const campaign = cleanText(body.campaignSlug || body.campaign || req.query?.campaign, 120) || DEFAULT_CAMPAIGN;
    const db = getPool();
    const access = await requireJobsRun(req, db, campaign);
    const payload = await recoverStaleJobs(db, campaign, body);
    return sendJson(res, 200, {
      ...payload,
      campaignSlug: campaign,
      actor: {
        profileId: access.profile?.id || null,
        displayName: access.profile?.display_name || authName(access.user),
        rbacAvailable: access.rbacAvailable
      }
    });
  } catch (error) {
    const status = Number(error.statusCode || 500);
    return sendJson(res, status, {
      ok: false,
      error: error.message || 'Falha ao recuperar jobs travados.'
    });
  }
};
