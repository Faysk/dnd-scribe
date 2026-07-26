#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

function readEnv(filePath) {
  const values = {};
  const text = fs.readFileSync(filePath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const separator = line.indexOf('=');
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    values[key] = value;
  }
  return values;
}

function parseArgs(argv) {
  const args = { envFile: '.env.local', campaignSlug: 'yuhara-main', dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--env-file') args.envFile = argv[++index];
    else if (value === '--campaign-slug') args.campaignSlug = argv[++index];
    else if (value === '--title') args.title = argv[++index];
    else if (value === '--summary-file') args.summaryFile = argv[++index];
    else if (value === '--dry-run') args.dryRun = true;
    else if (!args.sessionJson) args.sessionJson = value;
    else throw new Error(`Argumento desconhecido: ${value}`);
  }
  if (!args.sessionJson) {
    throw new Error(
      'Uso: node tools/publish_local_text.js <session.json> [--title "..."] [--summary-file resumo.md] [--dry-run]'
    );
  }
  return args;
}

function publicationFromFile(filePath, title, summaryFile) {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const sourceId = String(value.recording_id || '').trim();
  if (!sourceId) throw new Error('session.json sem recording_id');
  const rawSegments = Array.isArray(value.transcript) ? value.transcript : [];
  if (!rawSegments.length) throw new Error('session.json sem transcricao');
  const seen = new Set();
  const segments = rawSegments.flatMap((item, sequence) => {
    if (item.review_status === 'discarded') return [];
    const text = String(item.text || '').trim();
    if (!text) return [];
    const sourceSegmentId = String(item.id ?? sequence);
    if (seen.has(sourceSegmentId)) throw new Error(`Segmento duplicado: ${sourceSegmentId}`);
    seen.add(sourceSegmentId);
    const startMs = Math.max(0, Math.round(Number(item.start || 0) * 1000));
    const endMs = Math.max(startMs, Math.round(Number(item.end || 0) * 1000));
    const speaker = String(item.speaker || item.track || 'Mesa');
    const localReview = String(item.review_status || 'unreviewed');
    return [{
      source_segment_id: sourceSegmentId,
      source_sequence: sequence,
      start_ms: startMs,
      end_ms: endMs,
      track_key: String(item.track || speaker),
      speaker_name: speaker,
      character_name: null,
      text,
      text_chars: text.length,
      text_words: text.split(/\s+/u).filter(Boolean).length,
      needs_review: localReview === 'needs_review',
      review_status: localReview === 'approved'
        ? 'approved'
        : localReview === 'needs_review' ? 'needs_review' : 'pending',
      metadata: { source: 'local_companion', localReviewStatus: localReview }
    }];
  });
  if (!segments.length) throw new Error('Nenhuma fala publicavel');
  const startTime = value.start_time ? new Date(value.start_time) : null;
  const startIso = startTime && !Number.isNaN(startTime.getTime()) ? startTime.toISOString() : null;
  const sessionDate = String(value.played_at || startIso?.slice(0, 10) || '').slice(0, 10) || null;
  const durationMs = Math.max(...segments.map(item => item.end_ms));
  const endedAt = startIso ? new Date(new Date(startIso).getTime() + durationMs).toISOString() : null;
  return {
    sourceId,
    title: title || value.title || `Sessao ${sessionDate || sourceId}`,
    sessionDate,
    startTime: startIso,
    endedAt,
    durationMs,
    arc: value.arc || null,
    summary: value.recap?.short || null,
    summaryFull: summaryFile ? fs.readFileSync(summaryFile, 'utf8').trim() : null,
    model: value.model || null,
    segments
  };
}

async function publish(client, campaignSlug, publication) {
  await client.query('begin');
  try {
    const sessionResult = await client.query(
      `
insert into sessions (
  campaign_id, title, slug, session_date, arc, status, summary_short, summary_full,
  source_system, source_session_id, started_at, ended_at, duration_ms, metadata
)
select c.id, $2, $3, $4::date, $5, 'published', $6, $12,
       'local_companion', $7, $8::timestamptz, $9::timestamptz, $10,
       jsonb_build_object('localPublication', jsonb_build_object(
         'publishedAt', now(),
         'audioLocation', 'local_only',
         'model', $11::text,
         'source', 'operator_cli'
       ))
from campaigns c
where c.slug = $1
on conflict (campaign_id, source_system, source_session_id)
  where source_system is not null and source_session_id is not null
do update set
  title = excluded.title,
  session_date = excluded.session_date,
  arc = excluded.arc,
  status = excluded.status,
  summary_short = excluded.summary_short,
  summary_full = coalesce(excluded.summary_full, sessions.summary_full),
  started_at = excluded.started_at,
  ended_at = excluded.ended_at,
  duration_ms = excluded.duration_ms,
  metadata = coalesce(sessions.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now()
returning id;`,
      [
        campaignSlug,
        publication.title,
        `local-${publication.sourceId.toLowerCase()}`,
        publication.sessionDate,
        publication.arc,
        publication.summary,
        publication.sourceId,
        publication.startTime,
        publication.endedAt,
        publication.durationMs,
        publication.model,
        publication.summaryFull
      ]
    );
    if (!sessionResult.rows.length) throw new Error(`Campanha nao encontrada: ${campaignSlug}`);
    const sessionId = sessionResult.rows[0].id;
    const payload = JSON.stringify(publication.segments);
    await client.query(
      `
insert into transcript_segments (
  session_id, source_segment_id, source_sequence, start_ms, end_ms,
  track_key, speaker_name, character_name, text, text_chars, text_words,
  language, is_empty, needs_review, review_status, metadata
)
select
  $1::uuid, item.source_segment_id, item.source_sequence, item.start_ms, item.end_ms,
  item.track_key, item.speaker_name, item.character_name, item.text,
  item.text_chars, item.text_words, 'pt', false, item.needs_review,
  item.review_status, item.metadata
from jsonb_to_recordset($2::jsonb) as item(
  source_segment_id text,
  source_sequence integer,
  start_ms integer,
  end_ms integer,
  track_key text,
  speaker_name text,
  character_name text,
  text text,
  text_chars integer,
  text_words integer,
  needs_review boolean,
  review_status text,
  metadata jsonb
)
on conflict (session_id, source_segment_id) where source_segment_id is not null
do update set
  source_sequence = excluded.source_sequence,
  start_ms = excluded.start_ms,
  end_ms = excluded.end_ms,
  track_key = excluded.track_key,
  speaker_name = excluded.speaker_name,
  character_name = excluded.character_name,
  text = excluded.text,
  text_chars = excluded.text_chars,
  text_words = excluded.text_words,
  needs_review = excluded.needs_review,
  review_status = excluded.review_status,
  metadata = excluded.metadata;`,
      [sessionId, payload]
    );
    await client.query(
      `
delete from transcript_segments ts
where ts.session_id = $1::uuid
  and ts.source_segment_id is not null
  and not exists (
    select 1
    from jsonb_to_recordset($2::jsonb) as item(source_segment_id text)
    where item.source_segment_id = ts.source_segment_id
  );`,
      [sessionId, payload]
    );
    await client.query('commit');
    return { sessionId, segments: publication.segments.length };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const publication = publicationFromFile(
    path.resolve(args.sessionJson),
    args.title,
    args.summaryFile ? path.resolve(args.summaryFile) : null
  );
  const textBytes = Buffer.byteLength(JSON.stringify(publication.segments));
  const summary = {
    sourceSessionId: publication.sourceId,
    title: publication.title,
    segments: publication.segments.length,
    textBytes,
    audioTransferred: false,
    dryRun: args.dryRun
  };
  if (args.dryRun) {
    console.log(JSON.stringify(summary));
    return;
  }
  const env = readEnv(path.resolve(args.envFile));
  const connectionString = env.DATABASE_POOLER_URL || env.SUPABASE_POOLER_URL || env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_POOLER_URL ou DATABASE_URL ausente');
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const result = await publish(pool, args.campaignSlug, publication);
    console.log(JSON.stringify({ ...summary, ...result, published: true }));
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error.message || String(error));
  process.exitCode = 1;
});
