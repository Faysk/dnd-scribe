const { Pool } = require('pg');

const DEFAULT_CAMPAIGN = 'yuhara-main';
const DEFAULT_SOURCE_SESSION = 'craig-AdabEqbzngmT-stage1-full';
const DEFAULT_RUN = 'classify_candidates_v2_gpt-4o';
const DEFAULT_ACTOR = 'renanyuhara';

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

function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
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

function bearerToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return req.headers['x-dnd-operator-token'] || '';
}

function assertAuthorized(req, path) {
  if (path === '/api/health') return;
  const expected = process.env.DND_OPERATOR_TOKEN;
  if (!expected) {
    const error = new Error('DND_OPERATOR_TOKEN is not configured');
    error.statusCode = 503;
    throw error;
  }
  if (bearerToken(req) !== expected) {
    const error = new Error('Token de operador ausente ou invalido.');
    error.statusCode = 401;
    throw error;
  }
}

async function data(sql, params = [], db = getPool()) {
  const result = await db.query(sql, params);
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return row.data ?? row.row_to_json ?? row.coalesce ?? Object.values(row)[0] ?? null;
}

function targetCte() {
  return `
with target as (
  select c.id campaign_id, c.slug campaign_slug, c.name campaign_name,
         s.id session_id, s.title session_title, s.source_session_id,
         s.session_date, s.status, s.duration_ms, s.summary_short, s.started_at
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
    'sessionDate', s.session_date,
    'status', s.status,
    'durationMs', s.duration_ms,
    'summary', s.summary_short,
    'segments', (select count(*) from transcript_segments ts where ts.session_id = s.id and ts.is_empty = false),
    'participants', (select count(*) from participants p where p.session_id = s.id),
    'recordingFiles', (select count(*) from recording_files rf where rf.session_id = s.id),
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
      date: session.session_date,
      status: session.status,
      durationMs: session.duration_ms,
      startedAt: session.started_at,
      summary: session.summary_short
    },
    participants: participants || [],
    tracks: Object.values(tracks).sort((a, b) => a.track_key.localeCompare(b.track_key)),
    segments: segments || [],
    recordingFiles: recordingFiles || [],
    jobs: jobs || [],
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
      words: (segments || []).reduce((sum, segment) => sum + Number(segment.text_words || 0), 0),
      durationMs: session.duration_ms,
      needsReview: (segments || []).filter(segment => segment.needs_review).length,
      storage
    }
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
    `- Data: \`${session.session_date || 'sem data'}\``,
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
  if (path === '/api/health') {
    return sendJson(res, 200, { ok: true, app: 'dnd-scribe-vercel', campaignSlug: campaign });
  }
  if (path === '/api/sessions') {
    return sendJson(res, 200, { ok: true, sessions: await listSessions(campaign, runId) });
  }
  if (path === '/api/session') {
    const [review, summary] = await Promise.all([
      buildReviewPayload(campaign, sourceSessionId, runId),
      responseSummary(campaign, sourceSessionId, runId)
    ]);
    return sendJson(res, 200, { ok: true, review, summary });
  }
  if (path === '/api/review-template') {
    const actor = query.get('actorTrackKey') || DEFAULT_ACTOR;
    const includeAll = query.get('includeAllSegments') === 'true';
    const template = await buildDecisionTemplate(campaign, sourceSessionId, runId, actor, includeAll);
    return sendJson(res, 200, { ok: true, template });
  }
  return sendJson(res, 404, { ok: false, error: 'Unknown API route' });
}

async function handlePost(req, res, path) {
  const body = await readBody(req);
  const campaign = body.campaignSlug || DEFAULT_CAMPAIGN;
  const decisions = body.decisions || body;
  const sourceSessionId = body.sourceSessionId || decisions.sourceSessionId || DEFAULT_SOURCE_SESSION;
  const runId = body.runId || decisions.aiRunId || DEFAULT_RUN;
  const dryRun = Boolean(body.dryRun);
  if (path === '/api/review-decisions/apply') {
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
    if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
    assertAuthorized(req, path);
    if (req.method === 'GET') return await handleGet(req, res, path, url.searchParams);
    if (req.method === 'POST') return await handlePost(req, res, path);
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
  }
};
