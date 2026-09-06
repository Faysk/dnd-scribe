const {
  getPool,
  httpError,
  requireFeaturePermissions,
  sendJson,
} = require('../lib/feature-auth');

function clock(milliseconds) {
  const seconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

async function sessionMarkdown(campaign, sourceSessionId) {
  const result = await getPool().query(
    `
select s.title, to_char(s.session_date, 'YYYY-MM-DD') session_date, s.arc, s.summary_short,
       coalesce(json_agg(json_build_object(
         'startMs', ts.start_ms,
         'speaker', coalesce(nullif(ts.character_name, ''), nullif(ts.speaker_name, ''), ts.track_key, 'Mesa'),
         'text', ts.text
       ) order by coalesce(ts.start_ms, 2147483647), coalesce(ts.source_sequence, 2147483647), ts.id)
       filter (where ts.id is not null and coalesce(ts.is_empty, false) is false), '[]'::json) segments
from sessions s
join campaigns c on c.id = s.campaign_id
left join transcript_segments ts on ts.session_id = s.id
where c.slug = $1 and s.source_session_id = $2
group by s.id;`,
    [campaign, sourceSessionId],
  );
  const session = result.rows[0];
  if (!session) throw httpError(404, 'Sessão não encontrada.');
  const lines = [
    `# ${session.title}`,
    '',
    session.session_date ? `**Data:** ${session.session_date}` : '',
    session.arc ? `**Arco:** ${session.arc}` : '',
    session.summary_short ? `\n${session.summary_short}` : '',
    '',
    '## Transcrição completa',
    '',
  ].filter((line, index, values) => line || values[index - 1] !== '');
  for (const segment of session.segments || []) {
    lines.push(`**[${clock(segment.startMs)}] ${segment.speaker}**`, '', segment.text, '');
  }
  return `${lines.join('\n').trim()}\n`;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const campaign = String(url.searchParams.get('campaignSlug') || 'yuhara-main').trim().slice(0, 120);
    const sourceSessionId = String(url.searchParams.get('sourceSessionId') || '').trim().slice(0, 220);
    if (!sourceSessionId) throw httpError(400, 'sourceSessionId obrigatório.');
    await requireFeaturePermissions(req, campaign, ['campaign.transcript.read']);
    const markdown = await sessionMarkdown(campaign, sourceSessionId);
    const filename = `transcricao-${sourceSessionId.replace(/[^a-z0-9_-]+/gi, '-')}.md`;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(markdown);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || 'Erro interno.' });
  }
};
