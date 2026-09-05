const { Pool } = require('pg');

const DEFAULT_CAMPAIGN = 'yuhara-main';
const MAX_SOURCE_SESSION_ID = 220;
const MAX_PUBLIC_SESSIONS = 500;
const MAX_PUBLIC_SUMMARY_SHORT = 4000;
const MAX_PUBLIC_SUMMARY_FULL = 1000000;
const MAX_PUBLIC_IMAGE_URL = 2048;

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

function cleanText(value, maxLength) {
  const text = String(value || '').trim();
  if (!text || text.length > maxLength) return '';
  return text;
}

function dateOnly(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function publicSession(row, includeFullSummary = false) {
  const session = {
    sourceSessionId: cleanText(row.source_session_id, MAX_SOURCE_SESSION_ID),
    title: cleanText(row.title, 500),
    sessionDate: dateOnly(row.session_date),
    arc: cleanText(row.arc, 300),
    summary: cleanText(row.summary_short, MAX_PUBLIC_SUMMARY_SHORT),
    hasSummary: row.has_summary === true || Boolean(cleanText(row.summary_full, MAX_PUBLIC_SUMMARY_FULL)),
    coverImageUrl: cleanText(row.cover_image_url, MAX_PUBLIC_IMAGE_URL),
    heroImageUrl: cleanText(row.hero_image_url, MAX_PUBLIC_IMAGE_URL),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : ''
  };
  if (includeFullSummary) session.summaryFull = cleanText(row.summary_full, MAX_PUBLIC_SUMMARY_FULL);
  return session;
}

function sendJson(res, status, payload, cacheControl = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

module.exports = async function publicLibrary(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const campaignSlug = cleanText(req.query?.campaignSlug || DEFAULT_CAMPAIGN, 120);
  if (campaignSlug !== DEFAULT_CAMPAIGN) {
    return sendJson(res, 404, { ok: false, error: 'campaign_not_found' });
  }

  const rawSourceSessionId = req.query?.sourceSessionId;
  const sourceSessionId = rawSourceSessionId === undefined ? '' : cleanText(rawSourceSessionId, MAX_SOURCE_SESSION_ID);
  if (rawSourceSessionId !== undefined && !sourceSessionId) {
    return sendJson(res, 400, { ok: false, error: 'invalid_source_session_id' });
  }

  try {
    if (sourceSessionId) {
      const result = await getPool().query(
        `
select s.source_session_id, s.title, s.session_date, s.arc,
       left(s.summary_short, $3) summary_short,
       left(s.summary_full, $4 + 1) summary_full,
       coalesce(left(s.metadata->>'coverImageUrl', $5 + 1), '') cover_image_url,
       coalesce(left(s.metadata->>'heroImageUrl', $5 + 1), '') hero_image_url,
       s.updated_at
from sessions s
join campaigns c on c.id = s.campaign_id
where c.slug = $1
  and s.source_session_id = $2
  and s.status = 'published'
limit 1;`,
        [campaignSlug, sourceSessionId, MAX_PUBLIC_SUMMARY_SHORT + 1, MAX_PUBLIC_SUMMARY_FULL, MAX_PUBLIC_IMAGE_URL]
      );

      if (!result.rows.length) {
        return sendJson(res, 404, { ok: false, error: 'session_not_found' });
      }

      return sendJson(
        res,
        200,
        { ok: true, campaignSlug, session: publicSession(result.rows[0], true) },
        'public, s-maxage=60, stale-while-revalidate=300'
      );
    }

    const result = await getPool().query(
      `
select s.source_session_id, s.title, s.session_date, s.arc,
       left(s.summary_short, $2 + 1) summary_short,
       nullif(trim(s.summary_full), '') is not null has_summary,
       coalesce(left(s.metadata->>'coverImageUrl', $3 + 1), '') cover_image_url,
       coalesce(left(s.metadata->>'heroImageUrl', $3 + 1), '') hero_image_url,
       s.updated_at
from sessions s
join campaigns c on c.id = s.campaign_id
where c.slug = $1
  and s.status = 'published'
order by s.session_date desc nulls last, s.created_at desc
limit $4;`,
      [campaignSlug, MAX_PUBLIC_SUMMARY_SHORT, MAX_PUBLIC_IMAGE_URL, MAX_PUBLIC_SESSIONS]
    );

    return sendJson(
      res,
      200,
      {
        ok: true,
        campaignSlug,
        sessions: result.rows.map((row) => publicSession(row, false))
      },
      'public, s-maxage=60, stale-while-revalidate=300'
    );
  } catch (error) {
    console.error('[public-library] Falha ao consultar memoria publica.', {
      category: 'public_library_query',
      message: error instanceof Error ? error.message : String(error)
    });
    return sendJson(res, 503, { ok: false, error: 'public_library_unavailable' });
  }
};
