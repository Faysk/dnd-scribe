const crypto = require('crypto');
const { Pool } = require('pg');

const DEFAULT_CAMPAIGN = 'yuhara-main';
const PROJECT_SCOPE_ID = 'dnd-scribe';

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

async function data(sql, params = [], db = getPool()) {
  const result = await db.query(sql, params);
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return row.data ?? row.row_to_json ?? row.coalesce ?? Object.values(row)[0] ?? null;
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
      || ''
  };
}

async function supabaseUserFromRequest(req) {
  const token = bearerToken(req);
  if (!token) throw httpError(401, 'Login Discord ou Google obrigatorio.');
  const config = authPublicConfig();
  if (!config.supabaseUrl || !config.publishableKey) throw httpError(500, 'Supabase auth config publica ausente.');
  const response = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${token}`
    }
  });
  if (response.status === 401 || response.status === 403) throw httpError(401, 'Sessao invalida ou expirada.');
  if (!response.ok) throw httpError(502, `Falha ao validar sessao (${response.status}).`);
  return response.json();
}

async function linkedProfileForUser(db, userId, campaignSlug) {
  return await data(
    `
select json_build_object(
  'profileId', p.id,
  'displayName', p.display_name,
  'campaignRole', cm.role
) data
from profiles p
left join campaigns c on c.slug = $2
left join campaign_members cm on cm.profile_id = p.id and cm.campaign_id = c.id
where p.auth_user_id = $1::uuid
limit 1;`,
    [userId, campaignSlug],
    db
  );
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

async function requireInventoryAccess(req, campaignSlug) {
  const user = await supabaseUserFromRequest(req);
  const db = getPool();
  const linked = await linkedProfileForUser(db, user.id, campaignSlug);
  if (!linked?.profileId) throw httpError(403, 'Perfil ainda nao vinculado ao projeto.');
  const check = await profileHasPermission(db, linked.profileId, 'project.monitor.read', 'project', PROJECT_SCOPE_ID);
  if (check.allowed) return { user, linked, permissionMode: 'rbac' };
  if (!check.available && ['owner', 'master'].includes(linked.campaignRole || '')) {
    return { user, linked, permissionMode: 'legacy_dm' };
  }
  throw httpError(403, 'Inventario de storage exige permissao project.monitor.read.');
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

function createR2SignedUrl(key, expiresSeconds, bucketOverride = '', method = 'GET', extraQuery = {}) {
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
  const keyPath = String(key || '').split('/').filter(part => part !== '').map(encodeRfc3986).join('/');
  const canonicalUri = keyPath ? `/${encodeRfc3986(bucket)}/${keyPath}` : `/${encodeRfc3986(bucket)}/`;
  const params = {
    ...Object.fromEntries(Object.entries(extraQuery || {}).map(([name, value]) => [name, String(value)])),
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

function decodeXml(value = '') {
  return String(value)
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function xmlText(block, tag) {
  const match = String(block || '').match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? decodeXml(match[1]) : '';
}

function parseR2ListObjects(xml) {
  const contents = [];
  const contentMatches = String(xml || '').matchAll(/<Contents>([\s\S]*?)<\/Contents>/g);
  for (const match of contentMatches) {
    const block = match[1];
    contents.push({
      key: xmlText(block, 'Key'),
      lastModified: xmlText(block, 'LastModified'),
      etag: xmlText(block, 'ETag').replaceAll('"', ''),
      sizeBytes: Number(xmlText(block, 'Size') || 0)
    });
  }
  return {
    isTruncated: xmlText(xml, 'IsTruncated') === 'true',
    nextContinuationToken: xmlText(xml, 'NextContinuationToken'),
    keyCount: Number(xmlText(xml, 'KeyCount') || contents.length),
    contents
  };
}

async function listR2Objects(prefix = '', options = {}) {
  const config = r2Config();
  if (!config.bucket) throw httpError(500, 'R2_BUCKET ausente no ambiente.');
  const maxPages = Math.max(1, Math.min(25, Number(options.maxPages || 10)));
  const maxKeys = Math.max(1, Math.min(1000, Number(options.maxKeys || 1000)));
  const objects = [];
  let continuationToken = cleanText(options.continuationToken, 2000);
  let truncated = false;
  for (let page = 0; page < maxPages; page += 1) {
    const query = {
      'list-type': '2',
      'max-keys': String(maxKeys),
      prefix: String(prefix || '')
    };
    if (continuationToken) query['continuation-token'] = continuationToken;
    const response = await fetch(createR2SignedUrl('', 300, config.bucket, 'GET', query));
    const body = await response.text().catch(() => '');
    if (!response.ok) {
      throw httpError(502, `Falha ao listar R2 (${response.status}): ${cleanText(body, 240)}`);
    }
    const parsed = parseR2ListObjects(body);
    objects.push(...parsed.contents);
    truncated = parsed.isTruncated;
    continuationToken = parsed.nextContinuationToken;
    if (!truncated || !continuationToken) break;
  }
  return {
    bucket: config.bucket,
    prefix,
    objects,
    truncated,
    nextContinuationToken: continuationToken || null
  };
}

function sourceSessionIdFromR2Key(key = '') {
  const match = String(key || '').match(/\/sessions\/([^/]+)\//);
  return match ? decodeURIComponent(match[1]) : 'unknown';
}

function classifyR2Artifact(key = '') {
  const normalized = String(key || '').toLowerCase();
  if (normalized.includes('/uploads/craig/') || normalized.endsWith('.zip')) {
    return {
      category: 'raw_zip',
      retentionClass: 'temporary_7d_after_success',
      permanence: 'temporary',
      label: 'ZIP Craig original',
      action: 'expirar apos manifest/extracao validos'
    };
  }
  if (normalized.includes('/tracks/craig/') && normalized.endsWith('.flac')) {
    return {
      category: 'work_flac',
      retentionClass: 'temporary_until_voice_ref',
      permanence: 'candidate_temporary',
      label: 'FLAC extraido',
      action: 'compactar para Opus e expirar FLAC'
    };
  }
  if (normalized.includes('/voice-ref/') || normalized.endsWith('.opus')) {
    return {
      category: 'media_voice_ref',
      retentionClass: 'permanent_optimized',
      permanence: 'permanent',
      label: 'Audio compacto permanente',
      action: 'manter'
    };
  }
  if (normalized.includes('/speech-slices/') || normalized.includes('/transcribe-chunks/') || normalized.includes('/chunks/')) {
    return {
      category: 'work_chunks',
      retentionClass: 'temporary_72h_after_transcription',
      permanence: 'temporary',
      label: 'Chunks/slices temporarios',
      action: 'expirar apos transcricao'
    };
  }
  return {
    category: 'unknown',
    retentionClass: 'needs_classification',
    permanence: 'unknown',
    label: 'Artefato nao classificado',
    action: 'revisar prefixo e politica'
  };
}

function addInventoryTotals(target, object) {
  target.objects += 1;
  target.bytes += Number(object.sizeBytes || 0);
  if (!target.latestModified || String(object.lastModified || '') > String(target.latestModified)) {
    target.latestModified = object.lastModified || null;
  }
}

async function buildStorageInventory(campaign, options = {}) {
  const prefix = cleanText(options.prefix, 500) || `campaigns/${campaign}/sessions/`;
  const listed = await listR2Objects(prefix, {
    maxPages: options.maxPages || 10,
    maxKeys: options.maxKeys || 1000,
    continuationToken: options.continuationToken || ''
  });
  const totals = { objects: 0, bytes: 0, latestModified: null };
  const categories = {};
  const sessions = {};
  const objects = listed.objects.map(object => {
    const classification = classifyR2Artifact(object.key);
    const sourceSessionId = sourceSessionIdFromR2Key(object.key);
    const item = { ...object, sourceSessionId, ...classification };
    categories[item.category] ||= { category: item.category, label: item.label, retentionClass: item.retentionClass, objects: 0, bytes: 0, latestModified: null };
    sessions[sourceSessionId] ||= { sourceSessionId, objects: 0, bytes: 0, latestModified: null, categories: {} };
    sessions[sourceSessionId].categories[item.category] ||= { category: item.category, label: item.label, retentionClass: item.retentionClass, objects: 0, bytes: 0, latestModified: null };
    addInventoryTotals(totals, item);
    addInventoryTotals(categories[item.category], item);
    addInventoryTotals(sessions[sourceSessionId], item);
    addInventoryTotals(sessions[sourceSessionId].categories[item.category], item);
    return item;
  });
  const sessionList = Object.values(sessions)
    .map(session => ({
      ...session,
      categories: Object.values(session.categories).sort((a, b) => b.bytes - a.bytes),
      warning: session.bytes >= 500 * 1024 * 1024
        ? 'red'
        : session.bytes >= 250 * 1024 * 1024
          ? 'yellow'
          : 'ok'
    }))
    .sort((a, b) => b.bytes - a.bytes);
  return {
    ok: true,
    mode: 'r2_inventory_readonly',
    generatedAt: new Date().toISOString(),
    campaignSlug: campaign,
    bucket: listed.bucket,
    prefix: listed.prefix,
    truncated: listed.truncated,
    nextContinuationToken: listed.nextContinuationToken,
    totals,
    categories: Object.values(categories).sort((a, b) => b.bytes - a.bytes),
    sessions: sessionList,
    largestObjects: objects.slice().sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, 25),
    policy: {
      yellowSessionBytes: 250 * 1024 * 1024,
      redSessionBytes: 500 * 1024 * 1024,
      targetPermanentBytes: 150 * 1024 * 1024,
      note: 'Inventario apenas leitura. Limpeza e lifecycle entram nas proximas etapas.'
    }
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const campaign = url.searchParams.get('campaignSlug') || DEFAULT_CAMPAIGN;
    await requireInventoryAccess(req, campaign);
    const payload = await buildStorageInventory(campaign, {
      prefix: url.searchParams.get('prefix') || '',
      continuationToken: url.searchParams.get('continuationToken') || '',
      maxPages: url.searchParams.get('maxPages') || 10,
      maxKeys: url.searchParams.get('maxKeys') || 1000
    });
    return sendJson(res, 200, payload);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};
