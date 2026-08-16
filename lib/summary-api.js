'use strict';

const crypto = require('node:crypto');

const API_VERSION = 'v1';
const SUMMARY_SCOPE = 'summaries:read';
const API_KEY_PREFIX = 'dnd_live_';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const RATE_LIMIT_PER_MINUTE = 300;
const API_KEY_MAX_EXPIRY_DAYS = 3650;

function httpError(statusCode, message, code = 'request_error') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function cleanText(value, max = 500) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : '';
}

function isoDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function dateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function externalBearerToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || '').trim();
  if (!/^bearer\s+/i.test(header)) return '';
  return header.replace(/^bearer\s+/i, '').trim();
}

function hashApiKey(secret) {
  return crypto.createHash('sha256').update(String(secret || ''), 'utf8').digest('hex');
}

function generateApiKey() {
  const secret = `${API_KEY_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
  return {
    secret,
    prefix: secret.slice(0, API_KEY_PREFIX.length + 10),
    hash: hashApiKey(secret)
  };
}

function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursor(value) {
  const text = cleanText(value, 1000);
  if (!text) return null;
  try {
    const parsed = JSON.parse(Buffer.from(text, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object') throw new Error('invalid');
    const updatedAt = isoDate(parsed.updatedAt);
    const id = cleanText(parsed.id, 180);
    if (!updatedAt || !id) throw new Error('invalid');
    return { updatedAt, id };
  } catch (_error) {
    throw httpError(400, 'Cursor invalido.', 'invalid_cursor');
  }
}

function parseLimit(value) {
  if (value === null || value === undefined || value === '') return DEFAULT_LIMIT;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw httpError(400, 'limit precisa ser um inteiro positivo.', 'invalid_limit');
  return Math.min(MAX_LIMIT, number);
}

function parseIsoDateTime(value, field = 'updatedAfter') {
  const text = cleanText(value, 100);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw httpError(400, `${field} precisa ser uma data/hora ISO 8601 valida.`, 'invalid_datetime');
  return date.toISOString();
}

function parseDateOnly(value, field) {
  const text = cleanText(value, 20);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw httpError(400, `${field} precisa estar em YYYY-MM-DD.`, 'invalid_date');
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw httpError(400, `${field} possui uma data invalida.`, 'invalid_date');
  }
  return text;
}

function wantsMarkdown(req) {
  return String(req.headers.accept || '').toLowerCase().split(',').some(value => value.trim().startsWith('text/markdown'));
}

function etagFor(value) {
  const digest = crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('base64url').slice(0, 32);
  return `"sum-${digest}"`;
}

function requestHasEtag(req, etag) {
  const raw = String(req.headers['if-none-match'] || '').trim();
  if (!raw) return false;
  return raw.split(',').map(item => item.trim()).includes(etag) || raw === '*';
}

function setApiHeaders(res, extra = {}) {
  res.setHeader('X-DnD-Scribe-API-Version', API_VERSION);
  res.setHeader('Vary', 'Authorization, Accept');
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null) res.setHeader(key, String(value));
  });
}

function setRateHeaders(res, rate) {
  if (!rate) return;
  setApiHeaders(res, {
    'X-RateLimit-Limit': RATE_LIMIT_PER_MINUTE,
    'X-RateLimit-Remaining': Math.max(0, RATE_LIMIT_PER_MINUTE - Number(rate.count || 0)),
    'X-RateLimit-Reset': Math.floor(new Date(rate.resetAt).getTime() / 1000)
  });
}

function sendApiJson(res, statusCode, payload, headers = {}) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  setApiHeaders(res, headers);
  res.end(JSON.stringify(payload));
}

function sendApiError(res, error, rate = null) {
  const statusCode = Number(error?.statusCode || 500);
  const code = cleanText(error?.code || (statusCode === 500 ? 'internal_error' : 'request_error'), 80);
  if (statusCode === 401) res.setHeader('WWW-Authenticate', 'Bearer realm="DnD Scribe API"');
  if (statusCode === 429 && rate?.resetAt) {
    const retry = Math.max(1, Math.ceil((new Date(rate.resetAt).getTime() - Date.now()) / 1000));
    res.setHeader('Retry-After', String(retry));
  }
  setRateHeaders(res, rate);
  return sendApiJson(res, statusCode, {
    error: {
      code,
      message: statusCode >= 500 ? 'Erro interno ao processar a requisicao.' : (error?.message || 'Falha na requisicao.')
    }
  }, {
    'Cache-Control': 'no-store'
  });
}

async function authenticateApiKey(req, db, requiredScope = SUMMARY_SCOPE) {
  const secret = externalBearerToken(req);
  if (!secret || !secret.startsWith(API_KEY_PREFIX) || secret.length < API_KEY_PREFIX.length + 20) {
    throw httpError(401, 'API key ausente ou invalida.', 'invalid_api_key');
  }

  const result = await db.query(
    `
select k.id api_key_id,
       k.key_prefix,
       k.scopes,
       k.expires_at,
       c.id client_id,
       c.name client_name,
       c.campaign_id,
       campaigns.slug campaign_slug
from external_api_keys k
join external_api_clients c on c.id = k.client_id
join campaigns on campaigns.id = c.campaign_id
where k.key_hash = $1
  and k.revoked_at is null
  and c.revoked_at is null
  and (k.expires_at is null or k.expires_at > now())
limit 1;`,
    [hashApiKey(secret)]
  );
  const key = result.rows[0];
  if (!key) throw httpError(401, 'API key invalida, expirada ou revogada.', 'invalid_api_key');
  if (!Array.isArray(key.scopes) || !key.scopes.includes(requiredScope)) {
    throw httpError(403, `A API key nao possui o escopo ${requiredScope}.`, 'insufficient_scope');
  }

  const usage = await db.query(
    `
with bucket as (
  insert into external_api_usage_windows (api_key_id, window_start, request_count)
  values ($1::uuid, date_trunc('minute', now()), 1)
  on conflict (api_key_id, window_start)
  do update set request_count = external_api_usage_windows.request_count + 1
  returning request_count, window_start
), touched as (
  update external_api_keys
  set last_used_at = now(), request_count = request_count + 1
  where id = $1::uuid
  returning id
)
select request_count,
       window_start,
       window_start + interval '1 minute' reset_at
from bucket;`,
    [key.api_key_id]
  );
  const rate = {
    count: Number(usage.rows[0]?.request_count || 1),
    resetAt: isoDate(usage.rows[0]?.reset_at) || new Date(Date.now() + 60_000).toISOString()
  };
  if (rate.count > RATE_LIMIT_PER_MINUTE) {
    const error = httpError(429, 'Limite de requisicoes por minuto excedido.', 'rate_limit_exceeded');
    error.rate = rate;
    throw error;
  }
  return { ...key, rate };
}

function publicSiteUrl() {
  return String(process.env.DND_PUBLIC_SITE_URL || 'https://dnd.faysk.dev').replace(/\/$/, '');
}

function summaryListItem(row) {
  const id = String(row.source_session_id || '');
  return {
    id,
    title: row.title || '',
    sessionDate: dateOnly(row.session_date),
    arc: row.arc || null,
    summary: row.summary_short || '',
    updatedAt: isoDate(row.updated_at),
    webUrl: `${publicSiteUrl()}/#/sessao/${encodeURIComponent(id)}/resumo`
  };
}

function summaryDetailItem(row) {
  return {
    ...summaryListItem(row),
    summaryMarkdown: row.summary_full || '',
    coverImageUrl: row.metadata?.coverImageUrl || '',
    heroImageUrl: row.metadata?.heroImageUrl || ''
  };
}

async function listSummaries(db, access, query) {
  const limit = parseLimit(query.get('limit'));
  const cursor = decodeCursor(query.get('cursor'));
  const updatedAfter = parseIsoDateTime(query.get('updatedAfter'), 'updatedAfter');
  const from = parseDateOnly(query.get('from'), 'from');
  const to = parseDateOnly(query.get('to'), 'to');
  const arc = cleanText(query.get('arc'), 160) || null;
  if (from && to && from > to) throw httpError(400, 'from nao pode ser posterior a to.', 'invalid_date_range');

  const params = [access.campaign_id];
  const where = [
    's.campaign_id = $1::uuid',
    "s.status = 'published'",
    "nullif(trim(coalesce(s.summary_full, '')), '') is not null"
  ];
  const bind = value => {
    params.push(value);
    return `$${params.length}`;
  };
  if (updatedAfter) where.push(`s.updated_at > ${bind(updatedAfter)}::timestamptz`);
  if (from) where.push(`s.session_date >= ${bind(from)}::date`);
  if (to) where.push(`s.session_date <= ${bind(to)}::date`);
  if (arc) where.push(`lower(coalesce(s.arc, '')) = lower(${bind(arc)})`);
  if (cursor) {
    const timeParam = bind(cursor.updatedAt);
    const idParam = bind(cursor.id);
    where.push(`(s.updated_at, s.source_session_id) < (${timeParam}::timestamptz, ${idParam})`);
  }
  params.push(limit + 1);

  const result = await db.query(
    `
select s.source_session_id, s.title, s.session_date, s.arc,
       s.summary_short, s.updated_at
from sessions s
where ${where.join('\n  and ')}
order by s.updated_at desc, s.source_session_id desc
limit $${params.length};`,
    params
  );
  const hasMore = result.rows.length > limit;
  const visible = result.rows.slice(0, limit);
  const last = visible.at(-1);
  return {
    data: visible.map(summaryListItem),
    nextCursor: hasMore && last
      ? encodeCursor({ updatedAt: isoDate(last.updated_at), id: last.source_session_id })
      : null,
    hasMore,
    limit
  };
}

async function getSummary(db, access, sourceSessionId) {
  const result = await db.query(
    `
select s.source_session_id, s.title, s.session_date, s.arc,
       s.summary_short, s.summary_full, s.metadata, s.updated_at
from sessions s
where s.campaign_id = $1::uuid
  and s.source_session_id = $2
  and s.status = 'published'
  and nullif(trim(coalesce(s.summary_full, '')), '') is not null
limit 1;`,
    [access.campaign_id, sourceSessionId]
  );
  if (!result.rows[0]) throw httpError(404, 'Resumo publicado nao encontrado.', 'summary_not_found');
  return summaryDetailItem(result.rows[0]);
}

function detailPathId(path) {
  const prefix = '/api/v1/summaries/';
  if (!path.startsWith(prefix)) return '';
  let decoded = '';
  try {
    decoded = decodeURIComponent(path.slice(prefix.length));
  } catch (_error) {
    throw httpError(400, 'ID de sessao invalido.', 'invalid_summary_id');
  }
  const id = cleanText(decoded, 180);
  if (!id || id.includes('/')) throw httpError(400, 'ID de sessao invalido.', 'invalid_summary_id');
  return id;
}

async function handleExternalSummaryGet(req, res, path, query, db) {
  if (path === '/api/v1/health') {
    return sendApiJson(res, 200, {
      status: 'ok',
      apiVersion: API_VERSION,
      service: 'DnD Scribe Summary API',
      documentation: `${publicSiteUrl()}/docs/api`
    }, {
      'Cache-Control': 'public, max-age=60'
    });
  }
  if (path !== '/api/v1/summaries' && !path.startsWith('/api/v1/summaries/')) return false;

  let access = null;
  try {
    access = await authenticateApiKey(req, db, SUMMARY_SCOPE);
    setRateHeaders(res, access.rate);

    if (path === '/api/v1/summaries') {
      if (wantsMarkdown(req)) throw httpError(406, 'A listagem de resumos esta disponivel somente em JSON.', 'not_acceptable');
      const payload = await listSummaries(db, access, query);
      const response = {
        object: 'list',
        apiVersion: API_VERSION,
        data: payload.data,
        pagination: {
          limit: payload.limit,
          hasMore: payload.hasMore,
          nextCursor: payload.nextCursor
        }
      };
      const etag = etagFor(JSON.stringify(response));
      if (requestHasEtag(req, etag)) {
        res.statusCode = 304;
        setApiHeaders(res, { ETag: etag, 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' });
        return res.end();
      }
      return sendApiJson(res, 200, response, {
        ETag: etag,
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300'
      });
    }

    const id = detailPathId(path);
    const summary = await getSummary(db, access, id);
    const etag = etagFor(`${summary.id}\n${summary.updatedAt}\n${summary.summaryMarkdown}`);
    if (requestHasEtag(req, etag)) {
      res.statusCode = 304;
      setApiHeaders(res, { ETag: etag, 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' });
      return res.end();
    }
    if (wantsMarkdown(req)) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      setApiHeaders(res, {
        ETag: etag,
        'Last-Modified': summary.updatedAt ? new Date(summary.updatedAt).toUTCString() : undefined,
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300'
      });
      return res.end(summary.summaryMarkdown);
    }
    return sendApiJson(res, 200, {
      object: 'session_summary',
      apiVersion: API_VERSION,
      data: summary
    }, {
      ETag: etag,
      'Last-Modified': summary.updatedAt ? new Date(summary.updatedAt).toUTCString() : undefined,
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=300'
    });
  } catch (error) {
    return sendApiError(res, error, error.rate || access?.rate || null);
  }
}

function keyStatus(row) {
  if (row.revoked_at) return 'revoked';
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return 'expired';
  return 'active';
}

function keyManagementItem(row) {
  return {
    id: row.key_id,
    clientId: row.client_id,
    name: row.client_name,
    description: row.client_description || '',
    prefix: row.key_prefix,
    scopes: row.scopes || [],
    status: keyStatus(row),
    createdAt: isoDate(row.created_at),
    expiresAt: isoDate(row.expires_at),
    revokedAt: isoDate(row.revoked_at),
    lastUsedAt: isoDate(row.last_used_at),
    requestCount: Number(row.request_count || 0)
  };
}

async function listManagedKeys(db, campaignSlug) {
  await db.query("delete from external_api_usage_windows where window_start < now() - interval '7 days'").catch(() => {});
  const result = await db.query(
    `
select k.id key_id, k.key_prefix, k.scopes, k.created_at, k.expires_at,
       k.revoked_at, k.last_used_at, k.request_count,
       c.id client_id, c.name client_name, c.description client_description
from external_api_keys k
join external_api_clients c on c.id = k.client_id
join campaigns campaigns on campaigns.id = c.campaign_id
where campaigns.slug = $1
order by k.created_at desc;`,
    [campaignSlug]
  );
  return result.rows.map(keyManagementItem);
}

function requestedScopes(body = {}) {
  const raw = Array.isArray(body.scopes) ? body.scopes : [SUMMARY_SCOPE];
  const scopes = Array.from(new Set(raw.map(item => cleanText(item, 80)).filter(Boolean)));
  if (!scopes.length || scopes.some(scope => scope !== SUMMARY_SCOPE)) {
    throw httpError(400, `Nesta versao somente o escopo ${SUMMARY_SCOPE} e permitido.`, 'invalid_scope');
  }
  return scopes;
}

function expiryFromBody(body = {}, fallback = null) {
  if (body.expiresInDays === null || body.expiresInDays === '' || body.expiresInDays === undefined) return fallback;
  const days = Number(body.expiresInDays);
  if (!Number.isInteger(days) || days < 1 || days > API_KEY_MAX_EXPIRY_DAYS) {
    throw httpError(400, `expiresInDays precisa estar entre 1 e ${API_KEY_MAX_EXPIRY_DAYS}.`, 'invalid_expiry');
  }
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

async function managementAccess(req, campaignSlug, requirePermission) {
  return requirePermission(req, campaignSlug, {
    action: 'campaign.permissions.manage',
    scopeType: 'campaign',
    scopeId: campaignSlug,
    legacyRoles: [],
    error: 'Somente o proprietario das permissoes pode administrar API keys.'
  });
}

async function createManagedKey(db, access, campaignSlug, body = {}) {
  const name = cleanText(body.name, 120);
  if (name.length < 2) throw httpError(400, 'Informe um nome com pelo menos 2 caracteres.', 'invalid_name');
  const description = cleanText(body.description, 1000) || null;
  const scopes = requestedScopes(body);
  const expiresAt = expiryFromBody(body, null);
  const generated = generateApiKey();
  const profileId = access.profile?.id || null;

  const client = await db.connect();
  try {
    await client.query('begin');
    const createdClient = await client.query(
      `
insert into external_api_clients (campaign_id, name, description, created_by, metadata)
select campaigns.id, $2, $3, $4::uuid, $5::jsonb
from campaigns
where campaigns.slug = $1
returning id;`,
      [campaignSlug, name, description, profileId, JSON.stringify({ source: 'edit_api_integrations' })]
    );
    if (!createdClient.rows[0]) throw httpError(404, 'Campanha nao encontrada.', 'campaign_not_found');
    const key = await client.query(
      `
insert into external_api_keys (client_id, key_prefix, key_hash, scopes, expires_at, metadata)
values ($1::uuid, $2, $3, $4::text[], $5::timestamptz, $6::jsonb)
returning id;`,
      [
        createdClient.rows[0].id,
        generated.prefix,
        generated.hash,
        scopes,
        expiresAt,
        JSON.stringify({ source: 'edit_api_integrations', createdByProfileId: profileId })
      ]
    );
    await client.query('commit');
    return {
      keyId: key.rows[0].id,
      clientId: createdClient.rows[0].id,
      secret: generated.secret,
      prefix: generated.prefix,
      scopes,
      expiresAt
    };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function revokeManagedKey(db, campaignSlug, keyId) {
  const id = cleanText(keyId, 80);
  if (!id) throw httpError(400, 'keyId obrigatorio.', 'missing_key_id');
  const result = await db.query(
    `
update external_api_keys k
set revoked_at = coalesce(k.revoked_at, now())
from external_api_clients c, campaigns campaigns
where k.id = $1::uuid
  and c.id = k.client_id
  and campaigns.id = c.campaign_id
  and campaigns.slug = $2
returning k.id;`,
    [id, campaignSlug]
  );
  if (!result.rows[0]) throw httpError(404, 'API key nao encontrada.', 'api_key_not_found');
  return id;
}

async function rotateManagedKey(db, access, campaignSlug, body = {}) {
  const keyId = cleanText(body.keyId || body.id, 80);
  if (!keyId) throw httpError(400, 'keyId obrigatorio.', 'missing_key_id');
  const generated = generateApiKey();
  const profileId = access.profile?.id || null;
  const client = await db.connect();
  try {
    await client.query('begin');
    const current = await client.query(
      `
select k.id, k.client_id, k.scopes, k.expires_at
from external_api_keys k
join external_api_clients c on c.id = k.client_id
join campaigns campaigns on campaigns.id = c.campaign_id
where k.id = $1::uuid and campaigns.slug = $2
limit 1
for update of k;`,
      [keyId, campaignSlug]
    );
    const row = current.rows[0];
    if (!row) throw httpError(404, 'API key nao encontrada.', 'api_key_not_found');
    const expiresAt = expiryFromBody(body, isoDate(row.expires_at));
    await client.query('update external_api_keys set revoked_at = coalesce(revoked_at, now()) where id = $1::uuid', [keyId]);
    const replacement = await client.query(
      `
insert into external_api_keys (client_id, key_prefix, key_hash, scopes, expires_at, metadata)
values ($1::uuid, $2, $3, $4::text[], $5::timestamptz, $6::jsonb)
returning id;`,
      [
        row.client_id,
        generated.prefix,
        generated.hash,
        row.scopes,
        expiresAt,
        JSON.stringify({ source: 'edit_api_integrations', rotatedFrom: keyId, createdByProfileId: profileId })
      ]
    );
    await client.query('commit');
    return {
      keyId: replacement.rows[0].id,
      clientId: row.client_id,
      secret: generated.secret,
      prefix: generated.prefix,
      scopes: row.scopes,
      expiresAt,
      rotatedFrom: keyId
    };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function handleSummaryApiGet(req, res, path, query, deps) {
  if (path.startsWith('/api/v1/')) {
    await handleExternalSummaryGet(req, res, path, query, deps.getPool());
    return true;
  }
  if (path !== '/api/integrations/api-keys') return false;
  const campaignSlug = query.get('campaignSlug') || deps.defaultCampaign;
  await managementAccess(req, campaignSlug, deps.requirePermission);
  res.setHeader('Cache-Control', 'private, no-store');
  deps.sendJson(res, 200, {
    ok: true,
    campaignSlug,
    scopeCatalog: [{ scope: SUMMARY_SCOPE, description: 'Ler resumos publicados da campanha.' }],
    documentationUrl: `${publicSiteUrl()}/docs/api`,
    keys: await listManagedKeys(deps.getPool(), campaignSlug)
  });
  return true;
}

async function handleSummaryApiPost(req, res, path, body, deps) {
  const routes = new Set([
    '/api/integrations/api-keys',
    '/api/integrations/api-keys/revoke',
    '/api/integrations/api-keys/rotate'
  ]);
  if (!routes.has(path)) return false;
  const campaignSlug = cleanText(body.campaignSlug, 120) || deps.defaultCampaign;
  const access = await managementAccess(req, campaignSlug, deps.requirePermission);
  const db = deps.getPool();

  if (path === '/api/integrations/api-keys') {
    const created = await createManagedKey(db, access, campaignSlug, body);
    deps.sendJson(res, 201, {
      ok: true,
      campaignSlug,
      created,
      warning: 'A chave completa e exibida somente nesta resposta. Guarde-a em um secret manager.',
      keys: await listManagedKeys(db, campaignSlug)
    });
    return true;
  }
  if (path === '/api/integrations/api-keys/revoke') {
    const keyId = await revokeManagedKey(db, campaignSlug, body.keyId || body.id);
    deps.sendJson(res, 200, { ok: true, keyId, keys: await listManagedKeys(db, campaignSlug) });
    return true;
  }
  const rotated = await rotateManagedKey(db, access, campaignSlug, body);
  deps.sendJson(res, 200, {
    ok: true,
    campaignSlug,
    rotated,
    warning: 'A nova chave completa e exibida somente nesta resposta. Atualize o consumidor antes de descartar esta tela.',
    keys: await listManagedKeys(db, campaignSlug)
  });
  return true;
}

module.exports = {
  API_VERSION,
  SUMMARY_SCOPE,
  RATE_LIMIT_PER_MINUTE,
  decodeCursor,
  encodeCursor,
  generateApiKey,
  hashApiKey,
  parseLimit,
  wantsMarkdown,
  handleSummaryApiGet,
  handleSummaryApiPost
};
