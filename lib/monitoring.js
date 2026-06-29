const crypto = require('node:crypto');

const SECRET_NEVER_EXPOSE = 'hidden';

function cleanText(value, max = 500) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : '';
}

function base64UrlDecode(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function jwtExpiry(value) {
  const token = String(value || '').trim();
  if (!/^[^.]+\.[^.]+\.[^.]+$/.test(token)) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(token.split('.')[1]));
    if (!payload.exp) return null;
    const expiresAt = new Date(Number(payload.exp) * 1000);
    if (Number.isNaN(expiresAt.getTime())) return null;
    const daysRemaining = Math.floor((expiresAt.getTime() - Date.now()) / 86400000);
    return {
      detected: true,
      expiresAt: expiresAt.toISOString(),
      daysRemaining
    };
  } catch (_error) {
    return null;
  }
}

function secretMetadata(key, value) {
  const expiry = jwtExpiry(value);
  return {
    key,
    present: Boolean(value),
    value: SECRET_NEVER_EXPOSE,
    expiresAt: expiry?.expiresAt || null,
    daysRemaining: expiry?.daysRemaining ?? null
  };
}

function envGroup(id, label, description, keys, options = {}) {
  const mode = options.mode || 'any';
  const required = Boolean(options.required);
  const present = keys.filter(key => Boolean(process.env[key]));
  const missing = keys.filter(key => !process.env[key]);
  const configured = mode === 'all' ? missing.length === 0 : present.length > 0;
  const metadata = present.map(key => secretMetadata(key, process.env[key]));
  const expiring = metadata.find(item => item.daysRemaining !== null && item.daysRemaining < 14 && item.daysRemaining >= 0);
  const expired = metadata.find(item => item.daysRemaining !== null && item.daysRemaining < 0);
  const status = expired
    ? 'critical'
    : expiring
      ? 'attention'
      : configured
        ? 'ok'
        : required
          ? 'critical'
          : 'standby';
  return {
    id,
    label,
    description,
    required,
    mode,
    status,
    configured,
    presentKeys: present,
    missingKeys: missing,
    secrets: metadata,
    note: options.note || ''
  };
}

function monitoringEnvGroups() {
  return [
    envGroup(
      'supabase-public',
      'Supabase Auth publico',
      'URL e chave publica usados pelo login Discord/Google no navegador.',
      ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
      { mode: 'all', required: true }
    ),
    envGroup(
      'database',
      'Supabase Postgres',
      'Pooler/connection string usada pelas APIs de producao.',
      ['DATABASE_POOLER_URL', 'SUPABASE_POOLER_URL', 'DATABASE_URL'],
      { mode: 'any', required: true }
    ),
    envGroup(
      'r2-storage',
      'Cloudflare R2',
      'Bucket, endpoint e credenciais para uploads Craig e audio sob demanda.',
      ['R2_S3_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'],
      { mode: 'all', required: true }
    ),
    envGroup(
      'discord-app',
      'Discord app/interactions',
      'App id, chave publica e bot token para comandos e verificacao Discord.',
      ['DISCORD_APPLICATION_ID', 'DISCORD_PUBLIC_KEY', 'DISCORD_BOT_TOKEN'],
      { mode: 'all', required: false }
    ),
    envGroup(
      'discord-webhook',
      'Discord webhook',
      'Webhook de avisos operacionais para registrar falhas e conclusoes importantes.',
      ['DISCORD_WEBHOOK_URL'],
      { mode: 'any', required: false }
    ),
    envGroup(
      'vercel-api',
      'Vercel API',
      'Token e ids para consultar deploys/logs via API sem expor o painel da Vercel.',
      ['VERCEL_TOKEN', 'VERCEL_PROJECT_ID', 'VERCEL_TEAM_ID'],
      { mode: 'all', required: false }
    ),
    envGroup(
      'openai',
      'OpenAI',
      'Chave fica em standby ate uma etapa paga ser explicitamente aprovada pelo DM.',
      ['OPENAI_API_KEY'],
      { mode: 'any', required: false, note: 'Ausente nao quebra o app enquanto a IA paga estiver bloqueada.' }
    ),
    envGroup(
      'roll20-operator',
      'Roll20 operador',
      'Credenciais opcionais para automacoes futuras; hoje o fluxo principal e import/manual.',
      ['ROLL20_OPERATOR_EMAIL', 'ROLL20_OPERATOR_PASSWORD', 'ROLL20_CAMPAIGN_URL'],
      { mode: 'all', required: false }
    ),
    envGroup(
      'roll20-bridge',
      'Roll20 bridge',
      'Token dedicado para a extensao Chrome enviar eventos Roll20 em tempo real.',
      ['ROLL20_BRIDGE_TOKEN', 'DND_ROLL20_BRIDGE_TOKEN'],
      { mode: 'any', required: false, note: 'Necessario apenas para captura automatica via extensao.' }
    ),
    envGroup(
      'cron-supervisor',
      'Supervisor cron',
      'Segredo usado pela Vercel Cron para continuar etapas zero-cost da esteira Craig.',
      ['CRON_SECRET', 'DND_CRON_SECRET'],
      { mode: 'any', required: true }
    )
  ];
}

async function timed(label, fn) {
  const start = Date.now();
  try {
    const data = await fn();
    return {
      id: label,
      status: 'ok',
      ms: Date.now() - start,
      data
    };
  } catch (error) {
    return {
      id: label,
      status: 'critical',
      ms: Date.now() - start,
      error: error.message || String(error)
    };
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 3500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function statusFromHttp(status) {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 401 || status === 403 || status === 404) return 'critical';
  return 'attention';
}

async function dbPing(db) {
  const result = await timed('database', async () => {
    const response = await db.query('select now() as now, current_database() as database_name;');
    return {
      now: response.rows[0]?.now || null,
      database: response.rows[0]?.database_name || null
    };
  });
  return {
    label: 'Banco Supabase',
    description: 'Ping direto via pooler Postgres.',
    ...result
  };
}

function r2SigningCheck() {
  const required = ['R2_S3_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) {
    return {
      id: 'r2-signing',
      label: 'Assinatura R2',
      status: 'critical',
      missingKeys: missing,
      description: 'Nao e possivel assinar URLs de upload/audio.'
    };
  }
  try {
    new URL(process.env.R2_S3_ENDPOINT || process.env.R2_ENDPOINT);
    return {
      id: 'r2-signing',
      label: 'Assinatura R2',
      status: 'ok',
      description: 'Credenciais presentes e endpoint parseavel; valores seguem ocultos.'
    };
  } catch (error) {
    return {
      id: 'r2-signing',
      label: 'Assinatura R2',
      status: 'critical',
      error: error.message,
      description: 'Endpoint R2 invalido.'
    };
  }
}

async function discordBotCheck(deep) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return { id: 'discord-bot', label: 'Discord bot', status: 'standby', description: 'DISCORD_BOT_TOKEN ausente.' };
  }
  if (!deep) {
    return { id: 'discord-bot', label: 'Discord bot', status: 'ok', description: 'Token presente. Use verificacao profunda para testar a API.' };
  }
  const result = await timed('discord-bot', async () => {
    const response = await fetchWithTimeout('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bot ${token}`,
        'User-Agent': process.env.DISCORD_USER_AGENT || 'DnD-Scribe (https://dnd.faysk.dev, 0.1)'
      }
    });
    const body = await response.json().catch(() => ({}));
    return {
      httpStatus: response.status,
      username: body.username || null,
      botId: body.id || null
    };
  });
  return {
    id: 'discord-bot',
    label: 'Discord bot',
    description: 'Valida token chamando Discord /users/@me.',
    ...result,
    status: result.data ? statusFromHttp(result.data.httpStatus) : result.status
  };
}

async function discordChannelContentCheck(deep) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_DND_CHANNEL_ID;
  if (!token || !channelId) {
    return {
      id: 'discord-channel-content',
      label: 'Discord canal/conteudo',
      status: 'standby',
      description: 'DISCORD_BOT_TOKEN ou DISCORD_DND_CHANNEL_ID ausente.'
    };
  }
  if (!deep) {
    return {
      id: 'discord-channel-content',
      label: 'Discord canal/conteudo',
      status: 'ok',
      description: 'Canal configurado. Use verificacao profunda para testar historico e conteudo.'
    };
  }
  const result = await timed('discord-channel-content', async () => {
    const response = await fetchWithTimeout(`https://discord.com/api/v10/channels/${channelId}/messages?limit=10`, {
      headers: {
        Authorization: `Bot ${token}`,
        'User-Agent': process.env.DISCORD_USER_AGENT || 'DnD-Scribe (https://dnd.faysk.dev, 0.1)'
      }
    });
    const body = await response.json().catch(() => []);
    const messages = Array.isArray(body) ? body : [];
    return {
      httpStatus: response.status,
      checkedMessages: messages.length,
      withContent: messages.filter(item => Boolean(item.content)).length,
      withAttachments: messages.filter(item => (item.attachments || []).length > 0).length,
      authorsPresent: messages.filter(item => item.author?.id).length
    };
  });
  let status = result.data ? statusFromHttp(result.data.httpStatus) : result.status;
  let description = 'Valida leitura do canal DnD e disponibilidade de conteudo de mensagem.';
  if (status === 'ok' && Number(result.data?.checkedMessages || 0) > 0 && Number(result.data?.withContent || 0) === 0 && Number(result.data?.withAttachments || 0) === 0) {
    status = 'attention';
    description = 'Discord retornou mensagens sem content/anexos; validar Message Content Intent ou usar context menu.';
  }
  return {
    id: 'discord-channel-content',
    label: 'Discord canal/conteudo',
    description,
    ...result,
    status
  };
}

async function discordWebhookCheck(deep) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    return { id: 'discord-webhook', label: 'Discord webhook', status: 'standby', description: 'Webhook ausente.' };
  }
  if (!deep) {
    return { id: 'discord-webhook', label: 'Discord webhook', status: 'ok', description: 'Webhook presente. Use verificacao profunda para testar a URL.' };
  }
  const result = await timed('discord-webhook', async () => {
    const response = await fetchWithTimeout(url, { method: 'GET' });
    const body = await response.json().catch(() => ({}));
    return {
      httpStatus: response.status,
      webhookId: body.id || null,
      channelId: body.channel_id || null,
      guildId: body.guild_id || null
    };
  });
  return {
    id: 'discord-webhook',
    label: 'Discord webhook',
    description: 'Valida o webhook sem enviar mensagem.',
    ...result,
    status: result.data ? statusFromHttp(result.data.httpStatus) : result.status
  };
}

async function vercelCheck(deep) {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_ID_DND || '';
  const teamId = process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID || '';
  if (!token || !projectId) {
    return {
      id: 'vercel-deployments',
      label: 'Vercel deploys/logs',
      status: 'standby',
      description: 'Configure VERCEL_TOKEN e VERCEL_PROJECT_ID para consulta remota.'
    };
  }
  if (!deep) {
    return {
      id: 'vercel-deployments',
      label: 'Vercel deploys/logs',
      status: 'ok',
      description: 'Token e projeto presentes. Use verificacao profunda para consultar deploys.'
    };
  }
  const query = new URLSearchParams({ projectId, limit: '3' });
  if (teamId) query.set('teamId', teamId);
  const result = await timed('vercel-deployments', async () => {
    const response = await fetchWithTimeout(`https://api.vercel.com/v6/deployments?${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await response.json().catch(() => ({}));
    const deployments = Array.isArray(body.deployments) ? body.deployments.slice(0, 3) : [];
    return {
      httpStatus: response.status,
      deployments: deployments.map(item => ({
        uid: item.uid,
        url: item.url,
        state: item.state,
        target: item.target,
        createdAt: item.createdAt || item.created
      }))
    };
  });
  const latest = result.data?.deployments?.[0];
  return {
    id: 'vercel-deployments',
    label: 'Vercel deploys/logs',
    description: 'Consulta os deploys recentes pela API da Vercel.',
    ...result,
    status: result.data
      ? latest?.state === 'READY'
        ? 'ok'
        : statusFromHttp(result.data.httpStatus) === 'ok'
          ? 'attention'
          : statusFromHttp(result.data.httpStatus)
      : result.status
  };
}


function siteBaseUrl() {
  const raw = process.env.DND_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw.replace(/\/+$/, '') : `https://${raw.replace(/\/+$/, '')}`;
}

async function cronSupervisorCheck(deep) {
  const secret = process.env.CRON_SECRET || process.env.DND_CRON_SECRET || '';
  if (!secret) {
    return {
      id: 'pipeline-supervisor',
      label: 'Supervisor Craig',
      status: 'critical',
      description: 'CRON_SECRET ausente; Vercel Cron nao consegue chamar o supervisor.'
    };
  }
  if (!deep) {
    return {
      id: 'pipeline-supervisor',
      label: 'Supervisor Craig',
      status: 'ok',
      description: 'CRON_SECRET presente. Use verificacao profunda para testar o endpoint em dry-run.'
    };
  }
  const baseUrl = siteBaseUrl();
  if (!baseUrl) {
    return {
      id: 'pipeline-supervisor',
      label: 'Supervisor Craig',
      status: 'attention',
      description: 'CRON_SECRET presente, mas URL publica nao configurada para teste profundo.'
    };
  }
  const result = await timed('pipeline-supervisor', async () => {
    const response = await fetchWithTimeout(`${baseUrl}/api/pipeline-supervisor?dryRun=true&maxSessions=1&maxRuns=1`, {
      headers: { Authorization: `Bearer ${secret}` }
    }, 8000);
    const body = await response.json().catch(() => ({}));
    return {
      httpStatus: response.status,
      ok: body.ok === true,
      mode: body.mode || null,
      dryRun: body.dryRun === true,
      sessions: Array.isArray(body.sessions) ? body.sessions.length : null,
      processed: body.processed ?? null
    };
  });
  return {
    id: 'pipeline-supervisor',
    label: 'Supervisor Craig',
    description: 'Valida endpoint cron em dry-run com CRON_SECRET.',
    ...result,
    status: result.data?.ok ? 'ok' : (result.data ? statusFromHttp(result.data.httpStatus) : result.status)
  };
}

function roll20BridgeCheck(deep) {
  const token = process.env.ROLL20_BRIDGE_TOKEN || process.env.DND_ROLL20_BRIDGE_TOKEN || '';
  if (!token) {
    return {
      id: 'roll20-bridge',
      label: 'Roll20 bridge',
      status: 'standby',
      description: 'ROLL20_BRIDGE_TOKEN ausente; import manual continua funcionando.'
    };
  }
  const strongEnough = String(token).length >= 24;
  return {
    id: 'roll20-bridge',
    label: 'Roll20 bridge',
    status: strongEnough ? 'ok' : 'attention',
    description: deep
      ? 'Token dedicado presente para a extensao Chrome enviar eventos Roll20.'
      : 'Token dedicado presente. O teste real acontece no tab Roll20 com a extensao Chrome.',
    data: {
      configured: true,
      tokenLength: String(token).length,
      minRecommendedLength: 24,
      chromeExtensionPath: 'integrations/roll20/chrome-extension',
      endpoint: '/api/roll20-bridge'
    }
  };
}

async function dbJson(db, id, label, sql, params = []) {
  const result = await timed(id, async () => {
    const response = await db.query(sql, params);
    if (!response.rows.length) return null;
    const row = response.rows[0];
    return row.data ?? Object.values(row)[0] ?? null;
  });
  return { id, label, ...result };
}

function monitoringQueries(campaignSlug) {
  const campaignParam = [campaignSlug];
  const scoped = `
with scoped_sessions as (
  select s.*
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = $1
)`;
  return [
    db => dbJson(
      db,
      'campaign',
      'Campanha',
      `
select json_build_object(
  'slug', c.slug,
  'name', c.name,
  'createdAt', c.created_at,
  'members', coalesce((
    select count(*)::int
    from campaign_members cm
    where cm.campaign_id = c.id
  ), 0),
  'roles', coalesce((
    select json_agg(row_to_json(role_row) order by role_row.role)
    from (
      select cm.role, count(*)::int total
      from campaign_members cm
      where cm.campaign_id = c.id
      group by cm.role
    ) role_row
  ), '[]'::json)
) data
from campaigns c
where c.slug = $1
limit 1;`,
      campaignParam
    ),
    db => dbJson(
      db,
      'sessions',
      'Sessoes',
      `${scoped}
select json_build_object(
  'total', count(*)::int,
  'byStatus', coalesce((
    select json_agg(row_to_json(status_row) order by status_row.status)
    from (
      select status, count(*)::int total
      from scoped_sessions
      group by status
    ) status_row
  ), '[]'::json),
  'latest', coalesce((
    select json_agg(row_to_json(latest_row) order by latest_row.updated_at desc)
    from (
      select title, source_session_id, status, session_date, updated_at
      from scoped_sessions
      order by updated_at desc nulls last
      limit 5
    ) latest_row
  ), '[]'::json)
) data
from scoped_sessions;`,
      campaignParam
    ),
    db => dbJson(
      db,
      'content',
      'Conteudo sincronizado',
      `${scoped}
select json_build_object(
  'participants', coalesce((select count(*)::int from participants p join scoped_sessions s on s.id = p.session_id), 0),
  'segments', coalesce((select count(*)::int from transcript_segments ts join scoped_sessions s on s.id = ts.session_id where coalesce(ts.is_empty, false) is false), 0),
  'words', coalesce((select sum(ts.text_words)::bigint from transcript_segments ts join scoped_sessions s on s.id = ts.session_id where coalesce(ts.is_empty, false) is false), 0),
  'roll20Events', coalesce((select count(*)::int from roll20_events re join scoped_sessions s on s.id = re.session_id), 0),
  'tableNotes', coalesce((select count(*)::int from table_notes tn join scoped_sessions s on s.id = tn.session_id), 0),
  'reviewDecisions', coalesce((select count(*)::int from review_decisions rd join scoped_sessions s on s.id = rd.session_id), 0),
  'publications', coalesce((select count(*)::int from publications p join scoped_sessions s on s.id = p.session_id), 0),
  'canonCandidates', coalesce((select count(*)::int from canon_candidates cc join scoped_sessions s on s.id = cc.session_id), 0),
  'quoteCandidates', coalesce((select count(*)::int from quote_candidates qc join scoped_sessions s on s.id = qc.session_id), 0),
  'outtakeCandidates', coalesce((select count(*)::int from outtake_candidates oc join scoped_sessions s on s.id = oc.session_id), 0)
) data;`,
      campaignParam
    ),
    db => dbJson(
      db,
      'roll20-bridge-events',
      'Roll20 bridge eventos',
      `${scoped}
select json_build_object(
  'total', coalesce((
    select count(*)::int
    from roll20_events re
    join scoped_sessions s on s.id = re.session_id
    where re.payload #>> '{import,source}' = 'roll20-bridge'
       or re.payload ? 'bridge'
       or re.source_event_id like 'roll20-mod-%'
       or re.source_event_id like 'roll20-bridge-%'
  ), 0),
  'diceRolls', coalesce((
    select count(*)::int
    from roll20_events re
    join scoped_sessions s on s.id = re.session_id
    where re.event_type = 'roll20_dice_roll'
      and (
        re.payload #>> '{import,source}' = 'roll20-bridge'
        or re.payload ? 'bridge'
        or re.source_event_id like 'roll20-mod-%'
        or re.source_event_id like 'roll20-bridge-%'
      )
  ), 0),
  'latest', coalesce((
    select json_agg(row_to_json(latest_row) order by latest_row.created_at desc)
    from (
      select re.id, re.event_type, re.roll20_who, re.character_name, re.source_event_id,
             re.created_at_roll20, re.created_at, re.approx_start_ms, re.text
      from roll20_events re
      join scoped_sessions s on s.id = re.session_id
      where re.payload #>> '{import,source}' = 'roll20-bridge'
         or re.payload ? 'bridge'
         or re.source_event_id like 'roll20-mod-%'
         or re.source_event_id like 'roll20-bridge-%'
      order by re.created_at desc
      limit 10
    ) latest_row
  ), '[]'::json),
  'byType', coalesce((
    select json_agg(row_to_json(type_row) order by type_row.event_type)
    from (
      select re.event_type, count(*)::int total
      from roll20_events re
      join scoped_sessions s on s.id = re.session_id
      where re.payload #>> '{import,source}' = 'roll20-bridge'
         or re.payload ? 'bridge'
         or re.source_event_id like 'roll20-mod-%'
         or re.source_event_id like 'roll20-bridge-%'
      group by re.event_type
    ) type_row
  ), '[]'::json)
) data;`,
      campaignParam
    ),
    db => dbJson(
      db,
      'storage',
      'Dados e audios',
      `${scoped}
select coalesce(json_agg(row_to_json(storage_row) order by storage_row.bytes desc nulls last), '[]'::json) data
from (
  select
    coalesce(rf.file_type, 'unknown') file_type,
    coalesce(rf.source_system, 'unknown') source_system,
    count(*)::int files,
    coalesce(sum(rf.size_bytes), 0)::bigint bytes,
    round((coalesce(sum(rf.duration_ms), 0) / 60000.0)::numeric, 3) audio_minutes
  from recording_files rf
  join scoped_sessions s on s.id = rf.session_id
  group by coalesce(rf.file_type, 'unknown'), coalesce(rf.source_system, 'unknown')
) storage_row;`,
      campaignParam
    ),
    db => dbJson(
      db,
      'audio-pipeline',
      'Pipeline de audio',
      `${scoped}
select json_build_object(
  'chunks', coalesce((select count(*)::int from audio_chunks ac join scoped_sessions s on s.id = ac.session_id), 0),
  'silentChunks', coalesce((select count(*)::int from audio_chunks ac join scoped_sessions s on s.id = ac.session_id where coalesce(ac.probably_silent, false) is true), 0),
  'chunkMinutes', coalesce((select round((sum(ac.duration_ms) / 60000.0)::numeric, 3) from audio_chunks ac join scoped_sessions s on s.id = ac.session_id), 0),
  'speechSlices', coalesce((select count(*)::int from audio_speech_slices ss join scoped_sessions s on s.id = ss.session_id), 0),
  'speechSliceMinutes', coalesce((select round((sum(ss.duration_ms) / 60000.0)::numeric, 3) from audio_speech_slices ss join scoped_sessions s on s.id = ss.session_id), 0),
  'transcriptionWorkUnits', coalesce((select count(*)::int from audio_transcription_work_units wu join scoped_sessions s on s.id = wu.session_id), 0),
  'transcriptionCandidates', coalesce((
    select count(*)::int
    from audio_transcription_work_units wu
    join scoped_sessions s on s.id = wu.session_id
    where nullif(wu.sha256, '') is not null and coalesce(wu.probably_silent, false) is false
  ), 0)
) data;`,
      campaignParam
    ),
    db => dbJson(
      db,
      'audio-cleanup',
      'Readiness de limpeza',
      `${scoped}, cleanup_rows as (
  select cleanup.*
  from audio_storage_cleanup_candidates cleanup
  join scoped_sessions s on s.id = cleanup.session_id
), status_rows as (
  select readiness_status, artifact_type, count(*)::int objects,
         coalesce(sum(size_bytes), 0)::bigint bytes,
         coalesce(sum(reclaimable_bytes), 0)::bigint reclaimable_bytes
  from cleanup_rows
  group by readiness_status, artifact_type
), largest_rows as (
  select artifact_id, source_session_id, artifact_type, retention_class, lifecycle_status,
         readiness_status, blockers, required_action, storage_bucket, storage_path,
         original_filename, size_bytes, reclaimable_bytes, updated_at
  from cleanup_rows
  where readiness_status in ('delete_ready', 'blocked')
  order by size_bytes desc
  limit 12
)
select json_build_object(
  'objects', coalesce((select count(*)::int from cleanup_rows), 0),
  'bytes', coalesce((select sum(size_bytes)::bigint from cleanup_rows), 0),
  'deleteReadyObjects', coalesce((select count(*)::int from cleanup_rows where readiness_status = 'delete_ready'), 0),
  'deleteReadyBytes', coalesce((select sum(reclaimable_bytes)::bigint from cleanup_rows where readiness_status = 'delete_ready'), 0),
  'blockedObjects', coalesce((select count(*)::int from cleanup_rows where readiness_status = 'blocked'), 0),
  'blockedBytes', coalesce((select sum(size_bytes)::bigint from cleanup_rows where readiness_status = 'blocked'), 0),
  'holdObjects', coalesce((select count(*)::int from cleanup_rows where readiness_status = 'hold'), 0),
  'holdBytes', coalesce((select sum(size_bytes)::bigint from cleanup_rows where readiness_status = 'hold'), 0),
  'byStatus', coalesce((select json_agg(row_to_json(status_rows) order by readiness_status, artifact_type) from status_rows), '[]'::json),
  'largest', coalesce((select json_agg(row_to_json(largest_rows) order by size_bytes desc) from largest_rows), '[]'::json)
) data;`,
      campaignParam
    ),
    db => dbJson(
      db,
      'ai-usage',
      'Consumo IA',
      `${scoped}
select json_build_object(
  'ledgerEntries', coalesce((select count(*)::int from ai_usage_ledger l join scoped_sessions s on s.id = l.session_id), 0),
  'estimatedCostUsd', coalesce((select sum(l.estimated_cost_usd)::numeric(12, 6) from ai_usage_ledger l join scoped_sessions s on s.id = l.session_id), 0),
  'actualCostUsd', coalesce((select sum(l.actual_cost_usd)::numeric(12, 6) from ai_usage_ledger l join scoped_sessions s on s.id = l.session_id), 0),
  'audioMinutes', coalesce((select sum(l.input_audio_minutes)::numeric(12, 3) from ai_usage_ledger l join scoped_sessions s on s.id = l.session_id), 0),
  'byStatus', coalesce((
    select json_agg(row_to_json(status_row) order by status_row.status, status_row.model)
    from (
      select l.status, l.model, l.operation_type, count(*)::int entries,
             coalesce(sum(l.estimated_cost_usd), 0)::numeric(12, 6) estimated_cost_usd,
             coalesce(sum(l.actual_cost_usd), 0)::numeric(12, 6) actual_cost_usd
      from ai_usage_ledger l
      join scoped_sessions s on s.id = l.session_id
      group by l.status, l.model, l.operation_type
    ) status_row
  ), '[]'::json)
) data;`,
      campaignParam
    ),
    db => dbJson(
      db,
      'jobs',
      'Jobs e falhas',
      `${scoped}, job_rows as (
  select pj.*, s.source_session_id, s.title session_title
  from processing_jobs pj
  left join scoped_sessions s on s.id = pj.session_id
  where s.id is not null
), status_rows as (
  select status, job_type, count(*)::int total
  from job_rows
  group by status, job_type
), recent_rows as (
  select id, job_type, status, attempts, left(coalesce(error, ''), 600) error,
         created_at, started_at, finished_at, source_session_id, session_title,
         output
  from job_rows
  order by created_at desc
  limit 20
)
select json_build_object(
  'total', (select count(*)::int from job_rows),
  'queued', (select count(*)::int from job_rows where status = 'queued'),
  'running', (select count(*)::int from job_rows where status = 'running'),
  'failed', (select count(*)::int from job_rows where status = 'failed'),
  'failedLast24h', (select count(*)::int from job_rows where status = 'failed' and created_at > now() - interval '24 hours'),
  'oldestQueuedAt', (select min(created_at) from job_rows where status in ('queued', 'retrying')),
  'byStatus', coalesce((select json_agg(row_to_json(status_rows) order by status, job_type) from status_rows), '[]'::json),
  'recent', coalesce((select json_agg(row_to_json(recent_rows) order by created_at desc) from recent_rows), '[]'::json)
) data;`,
      campaignParam
    )
  ];
}

function statusRank(status) {
  return {
    critical: 4,
    attention: 3,
    warning: 2,
    standby: 0,
    not_checked: 0,
    ok: 0
  }[status] ?? 1;
}

function overallStatus(items) {
  const worst = items.reduce((current, item) => (
    statusRank(item.status) > statusRank(current.status) ? item : current
  ), { status: 'ok' });
  return worst.status;
}

function byId(items, id) {
  return items.find(item => item.id === id) || {};
}

function readinessStatus(status) {
  if (status === 'critical') return 'critical';
  if (status === 'attention' || status === 'warning') return 'attention';
  if (status === 'standby' || status === 'not_checked') return 'warning';
  return 'ok';
}

function buildReadiness(env, checks, metrics, deep) {
  const sessions = byId(metrics, 'sessions').data || {};
  const content = byId(metrics, 'content').data || {};
  const storage = byId(metrics, 'storage').data || [];
  const roll20Bridge = byId(metrics, 'roll20-bridge-events').data || {};
  const cleanup = byId(metrics, 'audio-cleanup').data || {};
  const audio = byId(metrics, 'audio-pipeline').data || {};
  const ai = byId(metrics, 'ai-usage').data || {};
  const jobs = byId(metrics, 'jobs').data || {};
  const storageFiles = storage.reduce((total, row) => total + Number(row.files || 0), 0);
  const storageBytes = storage.reduce((total, row) => total + Number(row.bytes || 0), 0);
  const contentItems = Number(content.segments || 0) + Number(content.roll20Events || 0) + Number(content.tableNotes || 0);
  const failedJobs = Number(jobs.failedLast24h || 0);
  const queuedJobs = Number(jobs.queued || 0) + Number(jobs.running || 0);
  const items = [
    {
      id: 'auth',
      label: 'Login e acesso fechado',
      status: readinessStatus(byId(env, 'supabase-public').status),
      detail: 'Supabase Auth publico configurado para proteger o site.'
    },
    {
      id: 'database',
      label: 'Banco da campanha',
      status: readinessStatus(byId(checks, 'database').status),
      detail: 'APIs conseguem consultar o Postgres de producao.'
    },
    {
      id: 'storage',
      label: 'Audio e arquivos R2',
      status: readinessStatus(byId(checks, 'r2-signing').status),
      detail: storageFiles
        ? `${storageFiles} arquivo(s), ${storageBytes} bytes rastreados.`
        : 'Assinatura R2 pronta; ainda sem arquivo rastreado no snapshot.'
    },
    {
      id: 'discord',
      label: 'Discord da mesa',
      status: readinessStatus(byId(checks, 'discord-channel-content').status),
      detail: deep
        ? 'Leitura de historico/conteudo validada pela verificacao profunda.'
        : 'Canal configurado; rode verificacao profunda antes do teste real.'
    },
    {
      id: 'timeline',
      label: 'Timeline com dados',
      status: contentItems > 0 ? 'ok' : 'attention',
      detail: contentItems > 0
        ? `${contentItems} item(ns) sincronizados entre fala, Roll20 e Discord.`
        : 'Ainda nao ha conteudo sincronizado para revisar na timeline.'
    },
    {
      id: 'roll20-bridge',
      label: 'Roll20 automatico',
      status: byId(checks, 'roll20-bridge').status === 'ok'
        ? Number(roll20Bridge.total || 0) > 0 ? 'ok' : 'attention'
        : readinessStatus(byId(checks, 'roll20-bridge').status),
      detail: Number(roll20Bridge.total || 0) > 0
        ? `${roll20Bridge.total} evento(s) recebidos pela ponte, ${roll20Bridge.diceRolls || 0} rolagem(ns).`
        : 'Ponte configurada/pendente; validar extensao Chrome no Roll20 real.'
    },
    {
      id: 'cleanup',
      label: 'Limpeza de storage',
      status: Number(cleanup.blockedObjects || 0) > 0
        ? 'attention'
        : Number(cleanup.deleteReadyObjects || 0) > 0 ? 'attention' : 'ok',
      detail: Number(cleanup.deleteReadyObjects || 0) > 0
        ? `${cleanup.deleteReadyObjects} objeto(s) prontos para limpeza, ${cleanup.deleteReadyBytes || 0} bytes recuperaveis.`
        : Number(cleanup.blockedObjects || 0) > 0
          ? `${cleanup.blockedObjects} objeto(s) bloqueados para limpeza.`
          : 'Sem limpeza pendente no snapshot atual.'
    },
    {
      id: 'jobs',
      label: 'Workers e fila',
      status: failedJobs > 0 ? 'critical' : queuedJobs > 0 ? 'attention' : 'ok',
      detail: failedJobs > 0
        ? `${failedJobs} falha(s) nas ultimas 24h.`
        : queuedJobs > 0
          ? `${queuedJobs} job(s) aguardando execucao ou conclusao.`
          : 'Sem falhas recentes e sem fila ativa.'
    },
    {
      id: 'pipeline-supervisor',
      label: 'Supervisor Craig',
      status: readinessStatus(byId(checks, 'pipeline-supervisor').status),
      detail: byId(checks, 'pipeline-supervisor').description || 'Cron seguro para continuar etapas zero-cost.'
    },
    {
      id: 'cost',
      label: 'Custo OpenAI',
      status: Number(ai.estimatedCostUsd || 0) > 0 ? 'attention' : 'ok',
      detail: Number(ai.estimatedCostUsd || 0) > 0
        ? `Uso estimado registrado: $${Number(ai.estimatedCostUsd || 0).toFixed(4)}.`
        : 'Nenhum custo estimado registrado no ledger atual.'
    },
    {
      id: 'deep-check',
      label: 'Snapshot profundo',
      status: deep ? 'ok' : 'not_checked',
      detail: deep
        ? 'Checks remotos de Discord, webhook e Vercel executados.'
        : 'Use verificacao profunda para validar tokens e APIs remotas.'
    }
  ];
  const blocking = items.filter(item => item.status === 'critical');
  const attention = items.filter(item => ['attention', 'warning', 'not_checked'].includes(item.status));
  return {
    status: overallStatus(items),
    ready: blocking.length === 0,
    blocking: blocking.length,
    attention: attention.length,
    items
  };
}

function recommendations(env, checks, metrics) {
  const items = [];
  for (const item of env.filter(entry => entry.status === 'critical')) {
    items.push({
      level: 'critical',
      title: `${item.label} precisa de atencao`,
      detail: item.configured ? 'Chave expirada ou invalida detectada.' : `Faltando: ${item.missingKeys.join(', ')}`
    });
  }
  for (const item of env.filter(entry => ['attention', 'warning'].includes(entry.status))) {
    items.push({
      level: 'attention',
      title: `${item.label} pede revisao`,
      detail: item.secrets?.find(secret => secret.daysRemaining !== null)?.expiresAt
        ? 'Existe token proximo do vencimento.'
        : item.note || 'Config presente, mas merece conferencia antes de teste real.'
    });
  }
  for (const check of checks.filter(entry => entry.status === 'critical')) {
    items.push({
      level: 'critical',
      title: `${check.label || check.id} falhou`,
      detail: check.error || check.description || 'Verificar detalhes.'
    });
  }
  for (const check of checks.filter(entry => ['attention', 'warning'].includes(entry.status))) {
    items.push({
      level: 'attention',
      title: `${check.label || check.id} pede atencao`,
      detail: check.error || check.description || 'Verificar detalhes.'
    });
  }
  const jobs = metrics.find(item => item.id === 'jobs')?.data || {};
  if (Number(jobs.failedLast24h || 0) > 0) {
    items.push({
      level: 'critical',
      title: 'Jobs falharam nas ultimas 24h',
      detail: `${jobs.failedLast24h} falha(s) recentes precisam de leitura.`
    });
  }
  if (Number(jobs.queued || 0) > 0) {
    items.push({
      level: 'attention',
      title: 'Ha jobs em fila',
      detail: `${jobs.queued} job(s) aguardando worker ou acao do DM.`
    });
  }
  const roll20Bridge = metrics.find(item => item.id === 'roll20-bridge-events')?.data || {};
  const roll20BridgeEnv = env.find(item => item.id === 'roll20-bridge') || {};
  if (roll20BridgeEnv.configured && Number(roll20Bridge.total || 0) === 0) {
    items.push({
      level: 'attention',
      title: 'Roll20 bridge ainda sem evento real',
      detail: 'Token esta configurado; falta validar a extensao Chrome dentro do Roll20 e gerar uma rolagem.'
    });
  }
  const cleanup = metrics.find(item => item.id === 'audio-cleanup')?.data || {};
  if (Number(cleanup.deleteReadyObjects || 0) > 0) {
    items.push({
      level: 'attention',
      title: 'Storage tem limpeza pronta',
      detail: `${cleanup.deleteReadyObjects} objeto(s) podem liberar ${cleanup.deleteReadyBytes || 0} bytes apos confirmacao.`
    });
  }
  if (Number(cleanup.blockedObjects || 0) > 0) {
    items.push({
      level: 'attention',
      title: 'Storage tem limpeza bloqueada',
      detail: `${cleanup.blockedObjects} objeto(s) precisam de evidencia/acao antes de liberar espaco.`
    });
  }
  if (!items.length) {
    items.push({
      level: 'ok',
      title: 'Nada critico no snapshot',
      detail: 'Servicos essenciais e banco responderam no estado atual.'
    });
  }
  return items.slice(0, 8);
}

function publicRuntime() {
  return {
    node: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    vercel: Boolean(process.env.VERCEL),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    region: process.env.VERCEL_REGION || null,
    url: process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || null,
    gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA
      ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12)
      : null
  };
}

function snapshotId(payload) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      generatedAt: payload.generatedAt,
      status: payload.overallStatus,
      campaignSlug: payload.campaignSlug
    }))
    .digest('hex')
    .slice(0, 12);
}

async function buildMonitoringPayload(db, options = {}) {
  const campaignSlug = cleanText(options.campaignSlug || 'yuhara-main', 120);
  const deep = Boolean(options.deep);
  const generatedAt = new Date().toISOString();
  const env = monitoringEnvGroups();
  const [database, discordBot, discordChannelContent, discordWebhook, vercel, cronSupervisor] = await Promise.all([
    dbPing(db),
    discordBotCheck(deep),
    discordChannelContentCheck(deep),
    discordWebhookCheck(deep),
    vercelCheck(deep),
    cronSupervisorCheck(deep)
  ]);
  const roll20Bridge = roll20BridgeCheck(deep);
  const checks = [
    {
      id: 'api-runtime',
      label: 'API DnD Scribe',
      status: 'ok',
      description: 'Esta resposta foi gerada pela funcao de producao.',
      data: publicRuntime()
    },
    database,
    r2SigningCheck(),
    discordBot,
    discordChannelContent,
    discordWebhook,
    vercel,
    cronSupervisor,
    roll20Bridge
  ];
  const metrics = await Promise.all(monitoringQueries(campaignSlug).map(query => query(db)));
  const payload = {
    ok: true,
    mode: 'technical_monitoring',
    access: 'permission:project.monitor.read',
    campaignSlug,
    deep,
    generatedAt,
    runtime: publicRuntime(),
    env,
    checks,
    metrics
  };
  payload.readiness = buildReadiness(env, checks, metrics, deep);
  payload.overallStatus = overallStatus([...env, ...checks, ...metrics]);
  payload.recommendations = recommendations(env, checks, metrics);
  payload.snapshotId = snapshotId(payload);
  return payload;
}

module.exports = {
  buildMonitoringPayload,
  jwtExpiry,
  monitoringEnvGroups
};
