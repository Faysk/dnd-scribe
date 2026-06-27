const crypto = require('crypto');
const { Pool } = require('pg');
const { notifyDiscord } = require('./discord');

const DEFAULT_CAMPAIGN = 'yuhara-main';
const EPHEMERAL = 64;
const INTERACTION = {
  PING: 1,
  APPLICATION_COMMAND: 2
};
const COMMAND_TYPE = {
  CHAT_INPUT: 1,
  MESSAGE: 3
};
const RESPONSE = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4
};

let pool;
let publicKeyObject;

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_POOLER_URL || process.env.SUPABASE_POOLER_URL || process.env.DATABASE_URL;
  if (!connectionString) throw httpError(500, 'DATABASE_POOLER_URL or DATABASE_URL is not configured');
  pool = new Pool({
    connectionString,
    max: 3,
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

function cleanText(value, max = 1000) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, Math.max(0, max - 3))}...` : text;
}

function defaultCampaignSlug() {
  return process.env.DND_DEFAULT_CAMPAIGN_SLUG || DEFAULT_CAMPAIGN;
}

function discordPublicKey() {
  if (publicKeyObject) return publicKeyObject;
  const hex = String(process.env.DISCORD_PUBLIC_KEY || '').trim();
  if (!hex) throw httpError(500, 'DISCORD_PUBLIC_KEY ausente no ambiente.');
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw httpError(500, 'DISCORD_PUBLIC_KEY invalida.');
  const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
  publicKeyObject = crypto.createPublicKey({
    key: Buffer.concat([spkiPrefix, Buffer.from(hex, 'hex')]),
    format: 'der',
    type: 'spki'
  });
  return publicKeyObject;
}

function verifyDiscordSignature({ signature, timestamp, rawBody }) {
  if (!signature || !timestamp) return false;
  if (!/^[0-9a-fA-F]+$/.test(signature)) return false;
  try {
    return crypto.verify(
      null,
      Buffer.concat([Buffer.from(timestamp, 'utf8'), rawBody]),
      discordPublicKey(),
      Buffer.from(signature, 'hex')
    );
  } catch (_error) {
    return false;
  }
}

function interactionUser(payload = {}) {
  const user = payload.member?.user || payload.user || {};
  return {
    id: user.id || '',
    username: user.global_name || user.username || user.id || 'discord-user',
    discriminator: user.discriminator || '',
    avatar: user.avatar || null
  };
}

function responseMessage(content, { ephemeral = true, embeds = [] } = {}) {
  return {
    type: RESPONSE.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: cleanText(content, 1900),
      flags: ephemeral ? EPHEMERAL : undefined,
      embeds
    }
  };
}

function optionValue(options = [], name, fallback = null) {
  const option = options.find(item => item.name === name);
  return option?.value ?? fallback;
}

function commandPath(data = {}) {
  const parts = [data.name].filter(Boolean);
  let current = data.options || [];
  for (let depth = 0; depth < 2; depth += 1) {
    const nested = current.find(item => item.type === 1 || item.type === 2);
    if (!nested) break;
    parts.push(nested.name);
    current = nested.options || [];
  }
  return parts.join(' ');
}

function commandOptions(data = {}) {
  const first = (data.options || [])[0];
  if (first?.type === 1 || first?.type === 2) return first.options || [];
  return data.options || [];
}

async function data(sql, params = [], db = getPool()) {
  const result = await db.query(sql, params);
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return row.data ?? row.row_to_json ?? row.coalesce ?? Object.values(row)[0] ?? null;
}

async function campaignContext(db, campaignSlug, sourceSessionId = '') {
  return await data(
    `
select row_to_json(context_row) data
from (
  select c.id campaign_id, c.slug campaign_slug, c.name campaign_name,
         s.id session_id, s.source_session_id, s.title session_title, s.status session_status
  from campaigns c
  left join lateral (
    select s.*
    from sessions s
    where s.campaign_id = c.id
      and ($2 = '' or s.source_session_id = $2)
    order by s.session_date desc nulls last, s.created_at desc
    limit 1
  ) s on true
  where c.slug = $1
  limit 1
) context_row;`,
    [campaignSlug, sourceSessionId],
    db
  );
}

async function profileForDiscord(db, campaignId, discordUserId) {
  if (!discordUserId) return null;
  return await data(
    `
select row_to_json(profile_row) data
from (
  select p.id, p.display_name, p.roll20_name, p.default_character_name, cm.role
  from profiles p
  join campaign_members cm on cm.profile_id = p.id
  where cm.campaign_id = $1::uuid
    and p.discord_id = $2
  limit 1
) profile_row;`,
    [campaignId, discordUserId],
    db
  );
}

async function statusText(db, campaignSlug) {
  const session = await data(
    `
select row_to_json(session_row) data
from (
  select s.title, s.source_session_id, s.status, s.session_date, s.summary_short,
         (select count(*) from transcript_segments ts where ts.session_id = s.id and ts.is_empty = false) segments,
         (select count(*) from participants p where p.session_id = s.id) participants,
         (select count(*) from recording_files rf where rf.session_id = s.id) files,
         (select count(*) from publications p where p.session_id = s.id) publications
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = $1
  order by s.session_date desc nulls last, s.created_at desc
  limit 1
) session_row;`,
    [campaignSlug],
    db
  );
  const jobs = await data(
    `
select coalesce(json_agg(job_row order by job_row.created_at desc), '[]'::json) data
from (
  select pj.job_type, pj.status, pj.created_at, pj.output->>'workerStatus' worker_status
  from processing_jobs pj
  join sessions s on s.id = pj.session_id
  join campaigns c on c.id = s.campaign_id
  where c.slug = $1
  order by pj.created_at desc
  limit 3
) job_row;`,
    [campaignSlug],
    db
  ) || [];

  if (!session) return `DnD Scribe: nenhuma sessao encontrada para ${campaignSlug}.`;
  const lines = [
    `**${session.title || session.source_session_id}**`,
    `Status: ${session.status || '-'} | Data: ${session.session_date || '-'}`,
    `Segmentos: ${session.segments || 0} | Participantes: ${session.participants || 0} | Arquivos: ${session.files || 0} | Publicacoes: ${session.publications || 0}`
  ];
  if (session.summary_short) lines.push(`Resumo: ${cleanText(session.summary_short, 280)}`);
  if (jobs.length) {
    lines.push('', '**Jobs recentes**');
    for (const job of jobs) {
      lines.push(`- ${job.job_type}: ${job.status}${job.worker_status ? ` (${job.worker_status})` : ''}`);
    }
  }
  return lines.join('\n');
}


function numeric(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function fixed(value, digits = 3) {
  return numeric(value).toFixed(digits);
}

function dollars(value) {
  return '$' + numeric(value).toFixed(4);
}

async function costText(db, context) {
  const model = process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';
  const promptVersion = process.env.OPENAI_TRANSCRIPTION_PROMPT_VERSION || process.env.DND_TRANSCRIPTION_PROMPT_VERSION || 'transcribe_v1';
  const summary = await data([
    "with units as (",
    "  select wu.*, tc.id cache_id",
    "  from audio_transcription_work_units wu",
    "  left join transcription_cache tc",
    "    on tc.audio_sha256 = wu.sha256",
    "   and tc.provider = 'openai'",
    "   and tc.model = $2",
    "   and tc.prompt_version = $3",
    "   and tc.status = 'succeeded'",
    "  where wu.session_id = $1::uuid",
    ")",
    "select json_build_object(",
    "  'workUnits', count(*)::int,",
    "  'speechSlices', count(*) filter (where unit_type = 'speech_slice')::int,",
    "  'chunkFallbacks', count(*) filter (where unit_type = 'chunk')::int,",
    "  'missingHash', count(*) filter (where nullif(sha256, '') is null)::int,",
    "  'probablySilent', count(*) filter (where probably_silent is true)::int,",
    "  'cacheHits', count(*) filter (where cache_id is not null)::int,",
    "  'transcribeCandidates', count(*) filter (",
    "    where nullif(sha256, '') is not null",
    "      and coalesce(probably_silent, false) is false",
    "      and cache_id is null",
    "  )::int,",
    "  'totalAudioMinutes', round((coalesce(sum(duration_ms), 0) / 60000.0)::numeric, 3),",
    "  'speechAudioMinutes', round((coalesce(sum(duration_ms) filter (where unit_type = 'speech_slice'), 0) / 60000.0)::numeric, 3),",
    "  'fallbackAudioMinutes', round((coalesce(sum(duration_ms) filter (where unit_type = 'chunk'), 0) / 60000.0)::numeric, 3),",
    "  'billableAudioMinutes', round((coalesce(sum(",
    "    case",
    "      when nullif(sha256, '') is not null",
    "       and coalesce(probably_silent, false) is false",
    "       and cache_id is null",
    "      then duration_ms else 0 end",
    "  ), 0) / 60000.0)::numeric, 3)",
    ") data",
    "from units;"
  ].join('\n'), [context.session_id, model, promptVersion], db) || {};

  const ledger = await data([
    "select json_build_object(",
    "  'entries', count(*)::int,",
    "  'estimatedCostUsd', coalesce(sum(estimated_cost_usd), 0)::numeric(12, 6),",
    "  'actualCostUsd', coalesce(sum(actual_cost_usd), 0)::numeric(12, 6),",
    "  'audioMinutes', coalesce(sum(input_audio_minutes), 0)::numeric(12, 3)",
    ") data",
    "from ai_usage_ledger",
    "where session_id = $1::uuid;"
  ].join('\n'), [context.session_id], db) || { entries: 0, estimatedCostUsd: 0, actualCostUsd: 0, audioMinutes: 0 };

  const rate = numeric(process.env.DND_COST_TRANSCRIPTION_AUDIO_MINUTE_USD);
  const billableMinutes = numeric(summary.billableAudioMinutes);
  const estimatedNextRun = rate > 0 ? billableMinutes * rate : null;
  const title = context.session_title || context.source_session_id || 'sessao atual';
  const lines = [
    '**Custos - ' + title + '**',
    'Modelo: ' + model + ' | prompt: ' + promptVersion,
    'Minutos: cobraveis ' + fixed(summary.billableAudioMinutes) + ' | speech ' + fixed(summary.speechAudioMinutes) + ' | fallback ' + fixed(summary.fallbackAudioMinutes) + ' | total ' + fixed(summary.totalAudioMinutes),
    'Work units: ' + numeric(summary.workUnits) + ' | candidatos ' + numeric(summary.transcribeCandidates) + ' | cache hits ' + numeric(summary.cacheHits),
    'Hashes faltando: ' + numeric(summary.missingHash) + ' | silenciosos: ' + numeric(summary.probablySilent),
    'Ledger: ' + numeric(ledger.entries) + ' lancamentos | audio ' + fixed(ledger.audioMinutes) + ' min | est. ' + dollars(ledger.estimatedCostUsd) + ' | real ' + dollars(ledger.actualCostUsd)
  ];
  if (estimatedNextRun !== null) {
    lines.push('Estimativa local da proxima transcricao: ' + dollars(estimatedNextRun) + ' (' + fixed(billableMinutes) + ' min x ' + dollars(rate) + '/min)');
  }
  const warnings = [];
  if (numeric(summary.missingHash) > 0) warnings.push('Bloqueio: ainda ha work units sem sha256.');
  if (numeric(summary.chunkFallbacks) > 0) warnings.push('Custo: ainda ha chunks inteiros como fallback; speech slices reduzem minutos.');
  if (numeric(summary.transcribeCandidates) > 0) warnings.push('Pronto: existem candidatos para dry-run ou rodada pequena.');
  if (warnings.length) lines.push('', '**Avisos**', ...warnings.map(item => '- ' + item));
  return lines.join('\n');
}

async function handleCosts(payload, context) {
  const content = await costText(getPool(), context);
  return responseMessage(content, { ephemeral: true });
}

async function insertInteraction(db, payload, context, response, path) {
  const user = interactionUser(payload);
  await db.query(
    `
insert into discord_interactions (
  interaction_id, application_id, guild_id, channel_id, user_id, username,
  interaction_type, command_name, command_path, campaign_id, session_id, payload, response
)
values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::uuid, $11::uuid, $12::jsonb, $13::jsonb)
on conflict (interaction_id)
do update set response = excluded.response;`,
    [
      payload.id,
      payload.application_id || null,
      payload.guild_id || null,
      payload.channel_id || null,
      user.id || null,
      user.username || null,
      Number(payload.type || 0),
      payload.data?.name || null,
      path || null,
      context?.campaign_id || null,
      context?.session_id || null,
      JSON.stringify(payload),
      JSON.stringify(response)
    ]
  );
}

async function insertTableNote(db, payload, context, note) {
  const user = interactionUser(payload);
  const profile = await profileForDiscord(db, context.campaign_id, user.id);
  const result = await db.query(
    `
insert into table_notes (
  campaign_id, session_id, source_system, source_id, note_type, visibility,
  author_profile_id, author_discord_id, author_name, content, tags, metadata
)
values ($1::uuid, $2::uuid, 'discord', $3, $4, $5, $6::uuid, $7, $8, $9, $10::text[], $11::jsonb)
on conflict (source_system, source_id)
do update set
  content = excluded.content,
  note_type = excluded.note_type,
  visibility = excluded.visibility,
  tags = excluded.tags,
  metadata = excluded.metadata
returning id;`,
    [
      context.campaign_id,
      context.session_id || null,
      note.sourceId,
      note.noteType,
      note.visibility,
      profile?.id || null,
      user.id || null,
      profile?.display_name || user.username || null,
      note.content,
      note.tags || [],
      JSON.stringify({
        discord: {
          interactionId: payload.id,
          guildId: payload.guild_id || null,
          channelId: payload.channel_id || null,
          userId: user.id || null,
          username: user.username || null
        },
        requestedSession: note.requestedSession || null,
        source: note.source || 'slash_command',
        raw: note.raw || null
      })
    ]
  );
  return result.rows[0]?.id || null;
}

async function handleStatus(payload, context) {
  const content = await statusText(getPool(), context.campaign_slug);
  return responseMessage(content, { ephemeral: true });
}

async function handleNote(payload, context) {
  const options = commandOptions(payload.data);
  const content = cleanText(optionValue(options, 'texto', ''), 1800);
  if (!content) return responseMessage('Escreva o texto da nota em `/dnd nota texto:`.', { ephemeral: true });
  const noteType = cleanText(optionValue(options, 'tipo', 'note'), 40) || 'note';
  const visibility = cleanText(optionValue(options, 'visibilidade', 'dm_review'), 40) || 'dm_review';
  const sourceId = `interaction:${payload.id}:note`;
  const noteId = await insertTableNote(getPool(), payload, context, {
    sourceId,
    noteType,
    visibility,
    content,
    requestedSession: optionValue(options, 'sessao', ''),
    tags: ['discord', noteType],
    source: 'slash_command'
  });
  await notifyDiscord({
    title: 'Nota Discord salva',
    status: 'ok',
    description: cleanText(content, 800),
    fields: [
      { name: 'tipo', value: noteType, inline: true },
      { name: 'visibilidade', value: visibility, inline: true },
      { name: 'nota', value: String(noteId || '-'), inline: true }
    ]
  });
  return responseMessage(`Nota salva para review do DnD Scribe. ID: ${noteId || 'registrado'}.`, { ephemeral: true });
}

async function handleLink(payload) {
  const user = interactionUser(payload);
  const url = process.env.DND_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://dnd.faysk.dev';
  return responseMessage([
    'Para vincular seu Discord ao perfil da mesa:',
    `1. Abra ${url}`,
    '2. Entre com Discord',
    '3. Confira seu perfil na aba **Acesso**',
    `4. Discord ID detectado: ${user.id || 'nao identificado'}`,
    '',
    'O DM aprova ou ajusta o vinculo final.'
  ].join('\n'), { ephemeral: true });
}

function resolvedTargetMessage(payload) {
  const targetId = payload.data?.target_id;
  const messages = payload.data?.resolved?.messages || {};
  return messages[targetId] || Object.values(messages)[0] || null;
}

async function handleMessageContext(payload, context) {
  const message = resolvedTargetMessage(payload);
  const content = cleanText(message?.content || '', 1800);
  if (!message || !content) {
    return responseMessage('Nao consegui ler o texto dessa mensagem. Use `/dnd nota` como alternativa.', { ephemeral: true });
  }
  const noteId = await insertTableNote(getPool(), payload, context, {
    sourceId: `message:${message.id}`,
    noteType: 'note',
    visibility: 'dm_review',
    content,
    tags: ['discord', 'message-context'],
    source: 'message_context',
    raw: {
      messageId: message.id,
      authorId: message.author?.id || null,
      authorName: message.author?.global_name || message.author?.username || null,
      messageCreatedAt: message.timestamp || null
    }
  });
  return responseMessage(`Mensagem salva no DnD Scribe para review. ID: ${noteId || 'registrado'}.`, { ephemeral: true });
}

function helpResponse() {
  return responseMessage([
    '**DnD Scribe Discord**',
    '`/dnd status` mostra a sessao mais recente.',
    '`/dnd custos` mostra minutos cobraveis, cache e ledger de IA.',
    '`/dnd nota texto: ...` salva uma nota da mesa.',
    '`/dnd vincular` mostra seu Discord ID e o fluxo de vinculo.',
    'Tambem existe o comando de contexto **Salvar no DnD Scribe** em mensagens.'
  ].join('\n'), { ephemeral: true });
}

async function handleApplicationCommand(payload) {
  const db = getPool();
  const path = commandPath(payload.data);
  const options = commandOptions(payload.data);
  const requestedSession = cleanText(optionValue(options, 'sessao', ''), 180);
  const context = await campaignContext(db, defaultCampaignSlug(), requestedSession);
  if (!context?.campaign_id) return responseMessage('Campanha padrao nao encontrada no DnD Scribe.', { ephemeral: true });

  let response;
  if (payload.data?.type === COMMAND_TYPE.MESSAGE || payload.data?.name === 'Salvar no DnD Scribe') {
    response = await handleMessageContext(payload, context);
  } else {
    const subcommand = (payload.data?.options || [])[0]?.name || '';
    if (payload.data?.name !== 'dnd') response = helpResponse();
    else if (subcommand === 'status') response = await handleStatus(payload, context);
    else if (subcommand === 'custos') response = await handleCosts(payload, context);
    else if (subcommand === 'nota') response = await handleNote(payload, context);
    else if (subcommand === 'vincular') response = await handleLink(payload);
    else response = helpResponse();
  }

  await insertInteraction(db, payload, context, response, path);
  return response;
}

async function handleDiscordInteraction(payload) {
  if (payload.type === INTERACTION.PING) return { type: RESPONSE.PONG };
  if (payload.type === INTERACTION.APPLICATION_COMMAND) return handleApplicationCommand(payload);
  return responseMessage('Interacao Discord ainda nao suportada.', { ephemeral: true });
}

module.exports = {
  handleDiscordInteraction,
  verifyDiscordSignature,
  httpError
};
