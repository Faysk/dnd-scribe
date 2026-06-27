'use strict';

const { Pool } = require('pg');
const {
  parseRoll20ChatText,
  normalizeRoll20Events,
  summarizeRoll20Events
} = require('../../lib/roll20-commands');

const DEFAULT_CAMPAIGN = 'yuhara-main';
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const DM_ROLES = new Set(['owner', 'master']);

let pool;

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_POOLER_URL || process.env.SUPABASE_POOLER_URL || process.env.DATABASE_URL;
  if (!connectionString) throw httpError(500, 'DATABASE_POOLER_URL or DATABASE_URL is not configured');
  pool = new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false }
  });
  return pool;
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
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

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(req.body ? JSON.parse(req.body) : {});

  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > MAX_BODY_BYTES) {
        reject(httpError(413, 'Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(httpError(400, 'JSON invalido no corpo da requisicao.'));
      }
    });
    req.on('error', reject);
  });
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

async function supabaseUserFromRequest(req) {
  const token = bearerToken(req);
  if (!token) throw httpError(401, 'Login Discord ou Google obrigatorio.');

  const config = authPublicConfig();
  if (!config.supabaseUrl || !config.publishableKey) {
    throw httpError(500, 'Supabase auth config publica ausente.');
  }

  const baseUrl = config.supabaseUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${token}`
    }
  });

  if (response.status === 401 || response.status === 403) {
    throw httpError(401, 'Sessao invalida ou expirada.');
  }
  if (!response.ok) throw httpError(502, `Falha ao validar sessao OAuth (${response.status}).`);
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
      else $4::text
    end,
    discord_handle = coalesce(nullif($5, ''), discord_handle),
    last_sign_in_at = now()
where auth_user_id = $1::uuid;`,
    [user.id, user.email || null, authAvatar(user), discord?.id || null, discord?.handle || null]
  );
}

async function requireDmAccess(req, campaignSlug) {
  const db = getPool();
  const user = await supabaseUserFromRequest(req);
  await syncAuthProfile(db, user);

  const result = await db.query(
    `
select cm.role, p.id profile_id, p.display_name
from profiles p
join campaign_members cm on cm.profile_id = p.id
join campaigns c on c.id = cm.campaign_id
where p.auth_user_id = $1::uuid
  and c.slug = $2
limit 1;`,
    [user.id, campaignSlug]
  );

  const membership = result.rows[0] || null;
  if (!membership) throw httpError(403, 'Perfil da mesa ainda nao aprovado pelo DM.');
  if (!DM_ROLES.has(membership.role)) throw httpError(403, 'Apenas DM pode ingerir chat do Roll20.');

  return {
    userId: user.id,
    profileId: membership.profile_id,
    displayName: membership.display_name,
    role: membership.role
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed' });

    const body = await readBody(req);
    const campaignSlug = cleanText(body.campaignSlug || body.campaign_slug || DEFAULT_CAMPAIGN, 120);
    const prefix = cleanText(body.prefix || process.env.ROLL20_COMMAND_PREFIX || '!dnd', 20) || '!dnd';
    const source = cleanText(body.source || 'copy-paste', 80) || 'copy-paste';
    const sourceSessionId = cleanText(body.sourceSessionId || body.source_session_id, 180) || null;
    const text = String(body.text || body.chatText || body.chat_text || '').slice(0, MAX_BODY_BYTES);

    if (!text.trim()) throw httpError(400, 'text obrigatorio com chat copiado/exportado do Roll20.');

    const actor = await requireDmAccess(req, campaignSlug);
    const parsed = parseRoll20ChatText(text, { prefix });
    const events = normalizeRoll20Events(parsed, {
      campaignSlug,
      receivedAt: body.receivedAt || body.received_at || undefined
    });
    const summary = summarizeRoll20Events(events);

    if (body.dryRun === false) {
      return sendJson(res, 409, {
        ok: false,
        mode: 'dry_run_only',
        error: 'Persistencia Roll20 ainda nao habilitada. Use dryRun para validar o parser primeiro.',
        campaignSlug,
        sourceSessionId,
        source,
        prefix,
        summary,
        events
      });
    }

    return sendJson(res, 200, {
      ok: true,
      mode: 'dry_run_only',
      dryRun: true,
      campaignSlug,
      sourceSessionId,
      source,
      prefix,
      actor: {
        profileId: actor.profileId,
        displayName: actor.displayName,
        role: actor.role
      },
      summary,
      events
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};
