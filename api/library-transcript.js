const {
  getPool,
  httpError,
  requireFeaturePermissions,
  sendJson,
} = require('../lib/feature-auth');

function pageSize(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return 120;
  return Math.max(40, Math.min(parsed, 200));
}

function encodeCursor(row) {
  if (!row) return null;
  return Buffer.from(JSON.stringify({
    startMs: Number(row.start_ms ?? 2147483647),
    sequence: Number(row.source_sequence ?? 2147483647),
    id: row.id,
  })).toString('base64url');
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (!parsed?.id) return null;
    return {
      startMs: Number.isFinite(Number(parsed.startMs)) ? Number(parsed.startMs) : 2147483647,
      sequence: Number.isFinite(Number(parsed.sequence)) ? Number(parsed.sequence) : 2147483647,
      id: String(parsed.id),
    };
  } catch {
    throw httpError(400, 'Cursor de transcrição inválido.');
  }
}

async function transcriptPage(campaign, sourceSessionId, query) {
  const limit = pageSize(query.get('limit'));
  const cursor = decodeCursor(query.get('cursor'));
  const search = String(query.get('q') || '').trim().slice(0, 120);
  const speaker = String(query.get('speaker') || '').trim().slice(0, 120);
  const params = [
    campaign,
    sourceSessionId,
    cursor?.startMs ?? null,
    cursor?.sequence ?? null,
    cursor?.id ?? null,
    search || null,
    speaker || null,
    limit + 1,
  ];
  const result = await getPool().query(
    `
with target as (
  select s.id, s.title, s.source_session_id, s.source_system,
         to_char(s.session_date, 'YYYY-MM-DD') session_date,
         s.started_at, s.ended_at, s.arc, s.status, s.duration_ms,
         s.summary_short, s.summary_full, s.metadata, s.updated_at
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = $1 and s.source_session_id = $2
),
filtered as (
  select ts.id, ts.source_segment_id, ts.source_sequence, ts.start_ms, ts.end_ms,
         ts.speaker_name, ts.character_name, ts.track_key, ts.text,
         ts.review_status, ts.needs_review
  from transcript_segments ts
  join target t on t.id = ts.session_id
  where coalesce(ts.is_empty, false) is false
    and (
      $3::integer is null
      or (
        coalesce(ts.start_ms, 2147483647),
        coalesce(ts.source_sequence, 2147483647),
        ts.id
      ) > ($3::integer, $4::integer, $5::uuid)
    )
    and (
      $6::text is null
      or to_tsvector('portuguese', ts.text) @@ websearch_to_tsquery('portuguese', $6)
    )
    and (
      $7::text is null
      or coalesce(nullif(ts.character_name, ''), nullif(ts.speaker_name, ''), ts.track_key, '') = $7
    )
  order by coalesce(ts.start_ms, 2147483647), coalesce(ts.source_sequence, 2147483647), ts.id
  limit $8
)
select
  (select row_to_json(t) from target t) session,
  coalesce((select json_agg(row_to_json(f) order by coalesce(f.start_ms, 2147483647), coalesce(f.source_sequence, 2147483647), f.id) from filtered f), '[]'::json) segments,
  coalesce((
    select json_agg(speaker order by speaker)
    from (
      select distinct coalesce(nullif(ts.character_name, ''), nullif(ts.speaker_name, ''), ts.track_key) speaker
      from transcript_segments ts
      join target t on t.id = ts.session_id
      where coalesce(ts.is_empty, false) is false
        and coalesce(nullif(ts.character_name, ''), nullif(ts.speaker_name, ''), ts.track_key) is not null
    ) speakers
  ), '[]'::json) speakers,
  (select count(*)::int from transcript_segments ts join target t on t.id = ts.session_id where coalesce(ts.is_empty, false) is false) total;`,
    params,
  );
  const payload = result.rows[0] || {};
  if (!payload.session) throw httpError(404, 'Sessão não encontrada.');
  const rows = payload.segments || [];
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  return {
    session: {
      id: payload.session.id,
      title: payload.session.title,
      sourceSessionId: payload.session.source_session_id,
      sourceSystem: payload.session.source_system,
      sessionDate: payload.session.session_date,
      startedAt: payload.session.started_at,
      endedAt: payload.session.ended_at,
      arc: payload.session.arc,
      status: payload.session.status,
      durationMs: payload.session.duration_ms,
      summary: payload.session.summary_short,
      hasSummary: Boolean(String(payload.session.summary_full || '').trim()),
      coverImageUrl: payload.session.metadata?.coverImageUrl || '',
      heroImageUrl: payload.session.metadata?.heroImageUrl || '',
      updatedAt: payload.session.updated_at,
    },
    segments: visible.map((row) => ({
      id: row.source_segment_id || row.id,
      startMs: row.start_ms,
      endMs: row.end_ms,
      speaker: row.character_name || row.speaker_name || row.track_key || 'Mesa',
      text: row.text,
      reviewStatus: row.review_status,
      needsReview: row.needs_review,
    })),
    speakers: payload.speakers || [],
    total: Number(payload.total || 0),
    nextCursor: hasMore ? encodeCursor(visible.at(-1)) : null,
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const campaign = String(url.searchParams.get('campaignSlug') || 'yuhara-main').trim().slice(0, 120);
    const sourceSessionId = String(url.searchParams.get('sourceSessionId') || '').trim().slice(0, 220);
    if (!sourceSessionId) throw httpError(400, 'sourceSessionId obrigatório.');
    await requireFeaturePermissions(req, campaign, ['campaign.transcript.read']);
    const payload = await transcriptPage(campaign, sourceSessionId, url.searchParams);
    return sendJson(res, 200, { ok: true, ...payload });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || 'Erro interno.' });
  }
};
