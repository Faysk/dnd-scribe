const DEFAULT_PREFIX = '!dnd';
const KNOWN_COMMANDS = new Set(['sessao', 'acao', 'canon', 'dm', 'audio']);
const SAMPLE_CHAT = `
[21:04] Dandelion: !dnd sessao estado:inicio titulo:"Estradas de Cinza"
[21:18] Astel: !dnd acao personagem:"Astel" texto:"Investigou o simbolo no altar"
[21:31] GM: !dnd canon tipo:npc texto:"O ferreiro reconhece o selo antigo"
[22:02] GM: !dnd dm tipo:gancho texto:"A testemunha sabe mais do que contou"
[22:40] Dandelion: conversa comum sem comando
[23:05] Feh: !dnd audio prioridade:alta motivo:"Cena importante"
`.trim();

const state = {
  payload: {
    campaignSlug: 'yuhara-main',
    sourceSessionId: '',
    source: 'roll20-copy-paste',
    prefix: DEFAULT_PREFIX,
    summary: { total: 0, valid: 0, invalid: 0, byCommand: {}, byEventType: {}, byVisibility: {} },
    events: []
  },
  backend: {
    loading: false,
    result: null,
    error: null
  },
  auth: {
    ready: false,
    error: null,
    config: null,
    client: null,
    user: null,
    profile: null,
    memberships: [],
    campaignRole: null,
    capabilities: null,
    profileLoading: false,
    profileError: null
  }
};

window.state = state;

function $(selector) {
  return document.querySelector(selector);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function cleanText(value, max = 500) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : '';
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

function badge(text, color = '') {
  return `<span class="badge ${color}">${escapeHtml(text)}</span>`;
}

function selectedCampaignSlug() {
  return cleanText($('#campaignSlug')?.value, 120) || 'yuhara-main';
}

function roleLabel(role) {
  return {
    owner: 'Owner',
    master: 'DM',
    player: 'Jogador',
    reviewer: 'Revisor',
    viewer: 'Leitor'
  }[role] || 'Sem papel';
}

function authDisplayName(user = state.auth.user) {
  if (!user) return '';
  return user.user_metadata?.full_name
    || user.user_metadata?.name
    || user.user_metadata?.global_name
    || user.user_metadata?.preferred_username
    || user.user_metadata?.user_name
    || user.user_metadata?.username
    || user.email
    || 'Usuario autenticado';
}

function authProviderName(user = state.auth.user) {
  return user?.app_metadata?.provider || user?.identities?.[0]?.provider || 'oauth';
}

function authProviderLabel(provider = authProviderName()) {
  return { discord: 'Discord', google: 'Google' }[provider] || 'OAuth';
}

function canValidateRoll20() {
  return state.auth.campaignRole === 'owner' || state.auth.campaignRole === 'master';
}

async function apiJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...options, headers });
  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (_error) {
    payload = { ok: false, error: raw || 'Resposta invalida da API.' };
  }
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function initAuth() {
  try {
    const config = await apiJson('/api/auth-config');
    state.auth.config = config;
    if (!config.supabaseUrl || !config.publishableKey) {
      state.auth.error = 'Config publica do Supabase ausente.';
      state.auth.ready = true;
      render();
      return;
    }
    if (!window.supabase?.createClient) {
      state.auth.error = 'Cliente Supabase nao carregou no navegador.';
      state.auth.ready = true;
      render();
      return;
    }
    state.auth.client = window.supabase.createClient(config.supabaseUrl, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    const { data, error } = await state.auth.client.auth.getSession();
    if (error) throw error;
    state.auth.user = data?.session?.user || null;
    state.auth.ready = true;
    render();
    await loadAuthProfile(data?.session || null);
    state.auth.client.auth.onAuthStateChange(async (_event, session) => {
      state.auth.user = session?.user || null;
      state.auth.ready = true;
      render();
      await loadAuthProfile(session || null);
    });
  } catch (error) {
    state.auth.ready = true;
    state.auth.error = error.message || String(error);
    render();
  }
}

async function loadAuthProfile(session = null) {
  state.auth.profile = null;
  state.auth.memberships = [];
  state.auth.campaignRole = null;
  state.auth.capabilities = null;
  state.auth.profileError = null;
  if (!state.auth.user || !state.auth.client) {
    state.auth.profileLoading = false;
    render();
    return;
  }
  try {
    state.auth.profileLoading = true;
    render();
    let activeSession = session;
    if (!activeSession) {
      const { data, error } = await state.auth.client.auth.getSession();
      if (error) throw error;
      activeSession = data?.session || null;
    }
    if (!activeSession?.access_token) return;
    const campaign = encodeURIComponent(selectedCampaignSlug());
    const payload = await apiJson(`/api/auth/me?campaignSlug=${campaign}`, {
      headers: { Authorization: `Bearer ${activeSession.access_token}` }
    });
    state.auth.profile = payload.profile || null;
    state.auth.memberships = payload.memberships || [];
    state.auth.campaignRole = payload.campaignRole || null;
    state.auth.capabilities = payload.capabilities || null;
  } catch (error) {
    state.auth.profileError = error.message || String(error);
  } finally {
    state.auth.profileLoading = false;
    render();
  }
}

async function signInProvider(provider) {
  if (!state.auth.client) {
    toast('Login ainda nao esta pronto.');
    return;
  }
  const { error } = await state.auth.client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
  if (error) toast(error.message);
}

function signInDiscord() {
  return signInProvider('discord');
}

function signInGoogle() {
  return signInProvider('google');
}

async function signOutAuth() {
  if (!state.auth.client) return;
  const { error } = await state.auth.client.auth.signOut();
  if (error) toast(error.message);
  else toast('Sessao encerrada.');
}

function renderAuthPanel() {
  const panel = $('#authPanel');
  if (!panel) return;
  if (!state.auth.ready) {
    panel.innerHTML = `<div><span class="label">Acesso</span><strong>Conectando login da mesa</strong><small>Preparando Discord/Google.</small></div>`;
    return;
  }
  if (state.auth.error) {
    panel.innerHTML = `
      <div>
        <span class="label">Acesso</span>
        <strong>Acesso fechado</strong>
        <small>${escapeHtml(state.auth.error)}</small>
      </div>
      <div class="auth-actions"><button onclick="initAuth()">Tentar de novo</button></div>
    `;
    return;
  }
  if (!state.auth.user) {
    panel.innerHTML = `
      <div>
        <span class="label">Acesso</span>
        <strong>Entrar na mesa</strong>
        <small>Validacao e gravacao no backend exigem DM ou Owner. Preview no navegador continua disponivel.</small>
      </div>
      <div class="badges">${badge('RBAC ativo', 'green')}${badge('DM/Owner', 'gold')}</div>
      <div class="auth-actions"><button class="primary" onclick="signInDiscord()">Entrar Discord</button><button onclick="signInGoogle()">Google</button></div>
    `;
    return;
  }
  const provider = authProviderName();
  const role = roleLabel(state.auth.campaignRole);
  const profileName = state.auth.profile?.displayName || authDisplayName();
  const detail = state.auth.profile?.roll20Name ? `@${state.auth.profile.roll20Name}` : 'Perfil da mesa';
  const statusBadge = canValidateRoll20() ? badge('Pode validar Roll20', 'green') : badge('Sem permissao de ingestao', 'orange');
  panel.innerHTML = `
    <div>
      <span class="label">Acesso</span>
      <strong>${escapeHtml(profileName)}</strong>
      <small>${escapeHtml(state.auth.profile ? detail : 'Login conectado; vinculo pode estar pendente.')}${state.auth.profileLoading ? ' Atualizando...' : ''}</small>
      ${state.auth.profileError ? `<small>${escapeHtml(state.auth.profileError)}</small>` : ''}
    </div>
    <div class="badges">${badge(authProviderLabel(provider), provider === 'discord' ? 'violet' : 'green')}${badge(role, canValidateRoll20() ? 'gold' : 'blue')}${statusBadge}</div>
    <div class="auth-actions"><button onclick="loadAuthProfile()">Atualizar</button><button onclick="signOutAuth()">Sair</button></div>
  `;
}

function splitRoll20Speaker(line, prefix = DEFAULT_PREFIX) {
  const rawLine = String(line || '').trimEnd();
  const prefixIndex = rawLine.indexOf(prefix);
  if (prefixIndex < 0) return { speaker: null, message: rawLine };

  const beforePrefix = rawLine.slice(0, prefixIndex).trim();
  const message = rawLine.slice(prefixIndex).trim();
  const speaker = beforePrefix
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/:\s*$/, '')
    .trim();

  return {
    speaker: speaker && speaker.length <= 80 ? speaker : null,
    message
  };
}

function tokenizeCommand(value) {
  const input = String(value || '');
  const tokens = [];
  let token = '';
  let quote = '';
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      token += char;
      escaped = false;
      continue;
    }

    if (quote) {
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = '';
        continue;
      }
      token += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (token) {
        tokens.push(token);
        token = '';
      }
      continue;
    }

    token += char;
  }

  if (escaped) token += '\\';
  if (quote) throw new Error(`unterminated ${quote} quote`);
  if (token) tokens.push(token);
  return tokens;
}

function parseCommandArgs(tokens) {
  const args = {};
  const positional = [];

  for (const token of tokens) {
    const separator = token.indexOf(':');
    if (separator <= 0) {
      positional.push(cleanText(token, 240));
      continue;
    }

    const key = token.slice(0, separator).trim();
    const value = token.slice(separator + 1).trim();
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,40}$/.test(key)) {
      positional.push(cleanText(token, 240));
      continue;
    }

    args[key] = cleanText(value, 1000);
  }

  return { args, positional: positional.filter(Boolean) };
}

function parseRoll20CommandLine(line, lineNo, prefix = DEFAULT_PREFIX) {
  const rawLine = String(line || '').replace(/\r?\n$/, '');
  if (!rawLine.includes(prefix)) return null;

  const { speaker, message } = splitRoll20Speaker(rawLine, prefix);
  const rawCommand = message.slice(message.indexOf(prefix) + prefix.length).trim();
  if (!rawCommand) {
    return { lineNo, speaker, command: '', args: {}, positional: [], rawCommand, rawLine, valid: false, error: 'missing command after prefix' };
  }

  try {
    const tokens = tokenizeCommand(rawCommand);
    if (!tokens.length) throw new Error('empty command');
    const { args, positional } = parseCommandArgs(tokens.slice(1));
    return {
      lineNo,
      speaker,
      command: cleanText(tokens[0], 80).toLowerCase(),
      args,
      positional,
      rawCommand,
      rawLine,
      valid: true,
      error: null
    };
  } catch (error) {
    return { lineNo, speaker, command: '', args: {}, positional: [], rawCommand, rawLine, valid: false, error: error.message };
  }
}

function parseRoll20ChatText(text, prefix = DEFAULT_PREFIX) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line, index) => parseRoll20CommandLine(line, index + 1, prefix))
    .filter(Boolean);
}

function eventTypeForCommand(command) {
  if (command === 'sessao') return 'session_marker';
  if (command === 'acao') return 'character_action_candidate';
  if (command === 'canon') return 'canon_candidate';
  if (command === 'dm') return 'dm_backstage_note';
  if (command === 'audio') return 'audio_processing_hint';
  return 'raw_roll20_note';
}

function visibilityForCommand(command) {
  if (command === 'dm') return 'dm_only';
  if (command === 'canon') return 'dm_review';
  if (command === 'audio') return 'dm_review';
  return 'table_review';
}

function normalizeRoll20Event(parsed, campaignSlug) {
  const command = cleanText(parsed?.command, 80).toLowerCase();
  const valid = Boolean(parsed?.valid);

  return {
    source: 'roll20',
    sourceKind: 'chat_command',
    campaignSlug,
    eventType: valid ? eventTypeForCommand(command) : 'invalid_roll20_command',
    command,
    knownCommand: KNOWN_COMMANDS.has(command),
    status: valid ? 'pending_review' : 'invalid',
    visibility: valid ? visibilityForCommand(command) : 'dm_review',
    needsDmReview: true,
    lineNo: parsed?.lineNo || null,
    speaker: cleanText(parsed?.speaker, 120) || null,
    args: parsed?.args || {},
    positional: Array.isArray(parsed?.positional) ? parsed.positional : [],
    text: cleanText(parsed?.args?.texto || parsed?.args?.text || parsed?.args?.descricao || '', 2000),
    targetCharacter: cleanText(parsed?.args?.personagem || parsed?.args?.character || '', 180) || null,
    noteType: cleanText(parsed?.args?.tipo || parsed?.args?.type || '', 80) || null,
    markerState: cleanText(parsed?.args?.estado || parsed?.args?.state || '', 80) || null,
    priority: cleanText(parsed?.args?.prioridade || parsed?.args?.priority || '', 40) || null,
    rawCommand: cleanText(parsed?.rawCommand, 2000),
    rawLine: cleanText(parsed?.rawLine, 3000),
    error: parsed?.error || null
  };
}

function summarizeEvents(events) {
  const summary = { total: events.length, valid: 0, invalid: 0, byCommand: {}, byEventType: {}, byVisibility: {} };

  for (const event of events) {
    if (event.status === 'invalid') summary.invalid += 1;
    else summary.valid += 1;
    summary.byCommand[event.command || 'invalid'] = (summary.byCommand[event.command || 'invalid'] || 0) + 1;
    summary.byEventType[event.eventType] = (summary.byEventType[event.eventType] || 0) + 1;
    summary.byVisibility[event.visibility] = (summary.byVisibility[event.visibility] || 0) + 1;
  }

  return summary;
}

function parseForm() {
  const campaignSlug = cleanText($('#campaignSlug').value, 120) || 'yuhara-main';
  const sourceSessionId = cleanText($('#sourceSessionId').value, 180);
  const prefix = cleanText($('#commandPrefix').value, 20) || DEFAULT_PREFIX;
  const parsed = parseRoll20ChatText($('#chatInput').value, prefix);
  const events = parsed.map(event => normalizeRoll20Event(event, campaignSlug));
  state.backend.result = null;
  state.backend.error = null;
  state.payload = {
    campaignSlug,
    sourceSessionId: sourceSessionId || null,
    source: 'roll20-copy-paste',
    prefix,
    dryRun: true,
    generatedAt: new Date().toISOString(),
    summary: summarizeEvents(events),
    events
  };
  render();
}

function metric(value, label) {
  return `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function renderBackendStatus() {
  if (state.backend.loading) {
    return `
      <div class="roll20-summary-block roll20-api-state">
        <span class="label">Backend</span>
        <p>Validando parser e permissao no servidor...</p>
      </div>
    `;
  }
  if (state.backend.error) {
    return `
      <div class="roll20-summary-block roll20-api-state error">
        <span class="label">Backend</span>
        <p>${escapeHtml(state.backend.error)}</p>
      </div>
    `;
  }
  if (state.backend.result) {
    const summary = state.backend.result.summary || {};
    const persisted = state.backend.result.persisted || null;
    const detail = persisted
      ? `${persisted.persisted || 0} gravados, ${persisted.skippedInvalid || 0} invalidos ignorados.`
      : `Dry-run autenticado aceito. ${escapeHtml(summary.total || 0)} eventos, ${escapeHtml(summary.valid || 0)} validos.`;
    return `
      <div class="roll20-summary-block roll20-api-state success">
        <span class="label">Backend</span>
        <p>${escapeHtml(detail)}</p>
        <div class="badges">
          ${badge(state.backend.result.actor?.role || 'role', 'gold')}
          ${badge(state.backend.result.mode || 'dry_run', 'green')}
        </div>
      </div>
    `;
  }
  const message = state.auth.user
    ? (canValidateRoll20() ? 'Pronto para validar no backend.' : 'Somente DM/Owner valida no backend.')
    : 'Entre com Discord ou Google para validar no backend.';
  return `
    <div class="roll20-summary-block roll20-api-state">
      <span class="label">Backend</span>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function renderSummary() {
  const summary = state.payload.summary;
  const commands = Object.entries(summary.byCommand || {})
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => badge(`${name}: ${count}`, name === 'dm' ? 'gold' : 'blue'))
    .join('');

  $('#summaryPanel').innerHTML = `
    <div class="roll20-metrics">
      ${metric(summary.total, 'eventos')}
      ${metric(summary.valid, 'validos')}
      ${metric(summary.invalid, 'invalidos')}
    </div>
    <div class="roll20-summary-block">
      <span class="label">Comandos</span>
      <div class="badges">${commands || badge('nenhum', 'orange')}</div>
    </div>
    <div class="roll20-summary-block">
      <span class="label">Regra</span>
      <p>O preview no navegador nao grava nada. Validar API e Gravar eventos usam a API de producao.</p>
    </div>
    ${renderBackendStatus()}
  `;
}

function renderEvent(event) {
  const title = event.text || event.args?.motivo || event.args?.titulo || event.rawCommand || event.command || 'Comando Roll20';
  const classes = ['roll20-event'];
  if (event.visibility === 'dm_only') classes.push('private');
  if (event.status === 'invalid') classes.push('invalid');

  return `
    <article class="${classes.join(' ')}">
      <div class="roll20-event-main">
        <div>
          <span class="label">Linha ${escapeHtml(event.lineNo || '-')}</span>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="badges">
          ${badge(event.command || 'invalid', event.status === 'invalid' ? 'red' : 'blue')}
          ${badge(event.eventType, event.visibility === 'dm_only' ? 'gold' : 'green')}
          ${badge(event.visibility, event.visibility === 'dm_only' ? 'gold' : 'violet')}
        </div>
      </div>
      <dl>
        <div><dt>Speaker</dt><dd>${escapeHtml(event.speaker || '-')}</dd></div>
        <div><dt>Personagem</dt><dd>${escapeHtml(event.targetCharacter || '-')}</dd></div>
        <div><dt>Tipo</dt><dd>${escapeHtml(event.noteType || event.markerState || event.priority || '-')}</dd></div>
      </dl>
      ${event.error ? `<p class="roll20-error">${escapeHtml(event.error)}</p>` : ''}
      <code>${escapeHtml(event.rawLine)}</code>
    </article>
  `;
}

function renderEvents() {
  $('#resultCount').textContent = `${state.payload.events.length} eventos`;
  $('#eventsList').innerHTML = state.payload.events.map(renderEvent).join('') || '<div class="empty">Nenhum comando encontrado.</div>';
}

function renderJson() {
  $('#jsonOutput').textContent = JSON.stringify(state.payload, null, 2);
}

function render() {
  renderAuthPanel();
  renderBackendButton();
  renderSummary();
  renderEvents();
  renderJson();
}

function renderBackendButton() {
  const preview = $('#backendPreviewBtn');
  const save = $('#saveBackendBtn');
  if (preview) {
    preview.disabled = state.backend.loading;
    preview.textContent = state.backend.loading ? 'Validando...' : 'Validar API';
  }
  if (save) {
    save.disabled = state.backend.loading;
    save.textContent = state.backend.loading ? 'Aguarde...' : 'Gravar eventos';
  }
}

function copyJson() {
  const text = JSON.stringify(state.payload, null, 2);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => toast('JSON copiado.')).catch(() => toast('Nao consegui copiar.'));
    return;
  }
  toast('Clipboard indisponivel neste navegador.');
}

function backendPayload(persist = false) {
  return {
    campaignSlug: selectedCampaignSlug(),
    sourceSessionId: cleanText($('#sourceSessionId')?.value, 180) || null,
    source: 'roll20-copy-paste',
    prefix: cleanText($('#commandPrefix')?.value, 20) || DEFAULT_PREFIX,
    dryRun: !persist,
    text: String($('#chatInput')?.value || '')
  };
}

async function submitBackend(persist = false) {
  parseForm();
  state.backend.loading = true;
  state.backend.error = null;
  state.backend.result = null;
  render();
  try {
    const payload = backendPayload(persist);
    if (!payload.text.trim()) throw new Error('Cole o chat do Roll20 antes de validar.');
    if (!state.auth.user) throw new Error('Login Discord ou Google obrigatorio para validar na API.');
    if (!canValidateRoll20()) throw new Error('Somente DM ou Owner pode validar ingestao Roll20 no backend.');
    if (persist && !payload.sourceSessionId) throw new Error('Informe a Sessao antes de gravar eventos.');
    if (persist && !window.confirm('Gravar estes eventos Roll20 na sessao selecionada?')) return;
    const result = await apiJson('/api/roll20-ingest', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.backend.result = result;
    toast(persist ? 'Eventos Roll20 gravados.' : 'Backend validou o dry-run.');
  } catch (error) {
    state.backend.error = error.message || String(error);
    toast(state.backend.error);
  } finally {
    state.backend.loading = false;
    render();
  }
}

function validateBackendPreview() {
  return submitBackend(false);
}

function persistBackendEvents() {
  return submitBackend(true);
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(state.payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const session = state.payload.sourceSessionId || 'sem-sessao';
  a.href = url;
  a.download = `roll20-events-${session}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function clearForm() {
  $('#chatInput').value = '';
  state.payload = { ...state.payload, summary: summarizeEvents([]), events: [] };
  render();
}

function boot() {
  $('#roll20Form').addEventListener('submit', event => {
    event.preventDefault();
    parseForm();
  });
  $('#parseBtn').addEventListener('click', parseForm);
  $('#backendPreviewBtn').addEventListener('click', validateBackendPreview);
  $('#saveBackendBtn').addEventListener('click', persistBackendEvents);
  $('#copyJsonBtn').addEventListener('click', copyJson);
  $('#downloadJsonBtn').addEventListener('click', downloadJson);
  $('#clearBtn').addEventListener('click', clearForm);
  $('#sampleBtn').addEventListener('click', () => {
    $('#chatInput').value = SAMPLE_CHAT;
    parseForm();
  });
  $('#campaignSlug').addEventListener('change', () => loadAuthProfile());
  render();
  initAuth();
}

window.signInDiscord = signInDiscord;
window.signInGoogle = signInGoogle;
window.signOutAuth = signOutAuth;
window.initAuth = initAuth;
window.loadAuthProfile = loadAuthProfile;

boot();
