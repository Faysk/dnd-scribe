const { Pool } = require('pg');

const PROJECT_SCOPE_ID = 'dnd-scribe';
let pool;

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_POOLER_URL
    || process.env.SUPABASE_POOLER_URL
    || process.env.DATABASE_URL;
  if (!connectionString) throw httpError(503, 'Banco de dados não configurado.');
  pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

function bearerToken(req) {
  const value = req.headers.authorization || req.headers.Authorization || '';
  if (!String(value).toLowerCase().startsWith('bearer ')) return '';
  return String(value).slice(7).trim();
}

function authPublicConfig() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      || process.env.SUPABASE_PUBLISHABLE_KEY
      || process.env.SUPABASE_ANON_KEY
      || '',
  };
}

async function authenticatedUser(req) {
  const token = bearerToken(req);
  if (!token) throw httpError(401, 'Login Discord ou Google obrigatório.');
  const config = authPublicConfig();
  if (!config.supabaseUrl || !config.publishableKey) {
    throw httpError(503, 'Autenticação não configurada neste ambiente.');
  }
  const response = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status === 401 || response.status === 403) {
    throw httpError(401, 'Sessão expirada ou inválida.');
  }
  if (!response.ok) throw httpError(502, 'Não foi possível validar a sessão agora.');
  return response.json();
}

async function requireFeaturePermissions(req, campaignSlug, actions) {
  const campaign = String(campaignSlug || '').trim().slice(0, 120);
  if (!campaign) throw httpError(400, 'campaignSlug obrigatório.');
  const required = [...new Set((actions || []).map(String).filter(Boolean))];
  if (!required.length) throw httpError(500, 'Permissão de acesso não configurada.');

  const user = await authenticatedUser(req);
  const db = getPool();
  const profileResult = await db.query(
    `
select p.id
from profiles p
join campaign_members cm on cm.profile_id = p.id
join campaigns c on c.id = cm.campaign_id
where p.auth_user_id = $1::uuid
  and c.slug = $2
limit 1;`,
    [user.id, campaign],
  );
  const profileId = profileResult.rows[0]?.id || null;
  if (!profileId) throw httpError(403, 'Perfil da mesa ainda não aprovado pelo DM.');

  const permissionResult = await db.query(
    `
select distinct rp.permission_action
from role_assignments ra
join role_permissions rp on rp.role_id = ra.role_id
where ra.profile_id = $1::uuid
  and rp.permission_action = any($2::text[])
  and ra.status = 'active'
  and now() >= ra.starts_at
  and (ra.ends_at is null or ra.ends_at > now())
  and (
    (ra.scope_type = 'campaign' and ra.scope_id = $3)
    or (ra.scope_type = 'project' and ra.scope_id = $4)
  );`,
    [profileId, required, campaign, PROJECT_SCOPE_ID],
  );
  const granted = new Set(permissionResult.rows.map((row) => row.permission_action));
  const missing = required.filter((action) => !granted.has(action));
  if (missing.length) {
    throw httpError(403, missing.includes('campaign.transcript.read')
      ? 'Sem permissão para visualizar as transcrições.'
      : 'Sem permissão para esta ação.');
  }
  return { user, profileId, permissions: granted };
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req, maxBytes = 64 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw httpError(413, 'Corpo da requisição muito grande.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw httpError(400, 'JSON inválido.');
  }
}

module.exports = {
  getPool,
  httpError,
  readJsonBody,
  requireFeaturePermissions,
  sendJson,
};
