const {
  getPool,
  httpError,
  readJsonBody,
  requireFeaturePermissions,
  sendJson,
} = require('../lib/feature-auth');

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

async function updateEditorSegment(campaign, sourceSessionId, body) {
  const segmentId = cleanText(body.segmentId, 240);
  const text = cleanText(body.text, 10000);
  const speaker = cleanText(body.speaker, 160);
  const requestedReviewStatus = cleanText(body.reviewStatus || 'approved', 40);
  const reviewStatus = requestedReviewStatus === 'unreviewed' ? 'pending' : requestedReviewStatus;
  if (!segmentId || !text || !speaker) throw httpError(400, 'Fala, speaker e texto são obrigatórios.');
  if (!['pending', 'approved', 'needs_review', 'discarded'].includes(reviewStatus)) {
    throw httpError(400, 'Estado de revisão inválido.');
  }
  const result = await getPool().query(
    `
update transcript_segments ts
set text = $4,
    text_chars = char_length($4),
    text_words = array_length(regexp_split_to_array(trim($4), '\\s+'), 1),
    speaker_name = $5,
    character_name = null,
    review_status = $6,
    needs_review = $6 in ('pending', 'needs_review')
from sessions s
join campaigns c on c.id = s.campaign_id
where ts.session_id = s.id
  and c.slug = $1
  and s.source_session_id = $2
  and (ts.source_segment_id = $3 or ts.id::text = $3)
returning ts.source_segment_id, ts.id, ts.start_ms, ts.end_ms, ts.speaker_name,
          ts.character_name, ts.track_key, ts.text, ts.review_status, ts.needs_review;`,
    [campaign, sourceSessionId, segmentId, text, speaker, reviewStatus],
  );
  const row = result.rows[0];
  if (!row) throw httpError(404, 'Fala não encontrada.');
  return {
    id: row.source_segment_id || row.id,
    startMs: row.start_ms,
    endMs: row.end_ms,
    speaker: row.character_name || row.speaker_name || row.track_key || 'Mesa',
    text: row.text,
    reviewStatus: row.review_status,
    needsReview: row.needs_review,
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
    const body = await readJsonBody(req);
    const campaign = cleanText(body.campaignSlug || 'yuhara-main', 120);
    const sourceSessionId = cleanText(body.sourceSessionId, 220);
    if (!sourceSessionId) throw httpError(400, 'sourceSessionId obrigatório.');
    await requireFeaturePermissions(req, campaign, [
      'campaign.transcript.read',
      'campaign.content.edit',
    ]);
    return sendJson(res, 200, {
      ok: true,
      segment: await updateEditorSegment(campaign, sourceSessionId, body),
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || 'Erro interno.' });
  }
};
