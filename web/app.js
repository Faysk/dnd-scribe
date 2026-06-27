const DEFAULT_RUN = 'classify_candidates_v2_gpt-4o';
const SESSION_STATUSES = [
  'planned',
  'recording',
  'uploaded',
  'processing',
  'ready_for_review',
  'reviewing',
  'approved',
  'published',
  'archived',
  'failed'
];

const DandelionPlaylist = {
  id: 'PLu1TRjIhrP64RDxyOvUf1OoCtz2mir86q',
  firstVideoId: 'lMxL4lXlf7E',
  title: 'Cancoes do Dandelion',
  owner: 'Dandelion',
  youtubeUrl: 'https://www.youtube.com/watch?v=lMxL4lXlf7E&list=PLu1TRjIhrP64RDxyOvUf1OoCtz2mir86q',
  embedUrl: 'https://www.youtube.com/embed/videoseries?enablejsapi=1&list=PLu1TRjIhrP64RDxyOvUf1OoCtz2mir86q',
  thumbnailUrl: 'https://i.ytimg.com/vi/lMxL4lXlf7E/hqdefault.jpg',
  usage: [
    { label: 'Antes da sessao', detail: 'Ambientar mesa, lembrar tom emocional e aquecer o grupo.' },
    { label: 'Durante cena', detail: 'Usar quando Dandelion performar, discursar ou puxar clima de revolucao.' },
    { label: 'Depois da sessao', detail: 'Registrar quais musicas viraram momento canon ou bastidor.' }
  ],
  notes: [
    'Player usa embed oficial do YouTube em modo discreto para a mesa local.',
    'Se houver arquivos originais autorizados, o app pode ganhar player de audio nativo depois.',
    'Letras completas devem continuar no YouTube ou em arquivo autorizado, nao copiadas para o app.'
  ]
};

const state = {
  sessions: [],
  selectedSourceSessionId: null,
  review: null,
  summary: null,
  tab: 'review',
  query: '',
  speaker: 'all',
  status: 'all',
  candidateKind: 'all',
  candidateStatus: 'all',
  selectedSegmentId: null,
  segmentDecisions: {},
  candidateDecisions: {},
  busy: false,
  loadingSession: false,
  log: [],
  ingest: {
    busy: false,
    error: null,
    result: null
  },
  jobs: [],
  jobsPolling: false,
  craigMap: null,
  craigMapEditable: false,
  craigMapError: null,
  auth: {
    ready: false,
    client: null,
    user: null,
    profile: null,
    memberships: [],
    campaignRole: null,
    capabilities: null,
    profileLoading: false,
    profileError: null,
    error: null,
    mode: 'auth_required',
    primaryProvider: 'discord',
    providers: ['discord', 'google']
  },
  music: {
    expanded: false,
    ready: false,
    playing: false,
    volume: 70
  },
  audio: {
    segmentId: null,
    loading: false,
    error: null,
    url: null,
    trackKey: null,
    startSeconds: 0,
    expiresAt: null,
    file: null
  }
};

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeId(value = '') {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function badge(text, color = '') {
  return `<span class="badge ${color}">${escapeHtml(text)}</span>`;
}

function fmtDuration(ms = 0) {
  const total = Math.floor(Number(ms || 0) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

function copyText(text, message = 'Copiado.') {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => toast(message)).catch(() => toast(text));
    return;
  }
  toast(text);
}

function setBusy(value) {
  state.busy = value;
  updateActionButtons();
}

function decisionCounts() {
  return {
    segments: Object.keys(state.segmentDecisions).length,
    candidates: Object.keys(state.candidateDecisions).length
  };
}

function hasDraftChanges() {
  const counts = decisionCounts();
  return counts.segments + counts.candidates > 0;
}

function updateActionButtons() {
  const hasReview = Boolean(state.review);
  const hasDraft = hasDraftChanges();
  const canRead = canReadCampaign();
  const canManage = canManageCampaign();
  const controls = {
    applyDecisionsBtn: state.busy || !hasReview || !hasDraft || !canManage,
    downloadTemplateBtn: state.busy || !hasReview || !canRead,
    downloadDecisionsBtn: state.busy || !hasReview || !canRead,
    refreshSessionsBtn: state.busy || !canRead
  };
  Object.entries(controls).forEach(([id, disabled]) => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  });
}

function draftStorageKey(sourceSessionId = state.selectedSourceSessionId) {
  if (!sourceSessionId) return '';
  return `dnd-scribe:draft:${sourceSessionId}:${DEFAULT_RUN}`;
}

function persistDraft() {
  const key = draftStorageKey();
  if (!key) return;
  try {
    const payload = {
      savedAt: new Date().toISOString(),
      sourceSessionId: state.selectedSourceSessionId,
      runId: DEFAULT_RUN,
      segmentDecisions: state.segmentDecisions,
      candidateDecisions: state.candidateDecisions
    };
    if (hasDraftChanges()) localStorage.setItem(key, JSON.stringify(payload));
    else localStorage.removeItem(key);
  } catch (error) {
    state.log.unshift({ at: new Date().toLocaleTimeString('pt-BR'), message: `Rascunho nao salvo: ${error.message}` });
    state.log = state.log.slice(0, 12);
  }
}

function restoreDraft(sourceSessionId) {
  const key = draftStorageKey(sourceSessionId);
  if (!key) return { restored: false, segments: 0, candidates: 0 };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { restored: false, segments: 0, candidates: 0 };
    const payload = JSON.parse(raw);
    if (payload.runId && payload.runId !== DEFAULT_RUN) return { restored: false, segments: 0, candidates: 0 };
    state.segmentDecisions = payload.segmentDecisions || {};
    state.candidateDecisions = payload.candidateDecisions || {};
    const counts = decisionCounts();
    return { restored: true, ...counts, savedAt: payload.savedAt || null };
  } catch (error) {
    localStorage.removeItem(key);
    return { restored: false, segments: 0, candidates: 0 };
  }
}

function clearDraft(showToast = false) {
  const key = draftStorageKey();
  if (key) localStorage.removeItem(key);
  state.segmentDecisions = {};
  state.candidateDecisions = {};
  updateActionButtons();
  render();
  if (showToast) toast('Rascunho local limpo.');
}

function confirmClearDraft() {
  if (!hasDraftChanges()) return;
  if (!window.confirm('Limpar o rascunho local desta sessao?')) return;
  clearDraft(true);
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const response = await fetch(path, {
    ...options,
    headers
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Falha HTTP ${response.status}`);
  }
  return payload;
}

function remember(message, payload = null) {
  state.log.unshift({
    at: new Date().toLocaleTimeString('pt-BR'),
    message,
    payload
  });
  state.log = state.log.slice(0, 12);
}

async function boot() {
  $('#refreshSessionsBtn').addEventListener('click', () => loadSessions(true));
  $('#applyDecisionsBtn').addEventListener('click', applyDecisions);
  $('#downloadDecisionsBtn').addEventListener('click', downloadDecisions);
  $('#downloadTemplateBtn').addEventListener('click', downloadTemplate);
  $('#tabs').addEventListener('click', event => {
    const button = event.target.closest('button[data-tab]');
    if (!button) return;
    state.tab = button.dataset.tab;
    render();
  });
  initMusicDock();
  render();
  await initAuth();
  if (canReadCampaign()) await loadCampaignData();
}

async function initAuth() {
  try {
    const config = await api('/api/auth-config');
    state.auth.mode = config.mode || 'auth_required';
    state.auth.primaryProvider = config.primaryProvider || 'discord';
    state.auth.providers = config.providers || ['discord', 'google'];
    if (!config.supabaseUrl || !config.publishableKey) {
      state.auth.error = 'Config publica do Supabase ausente.';
      return;
    }
    if (!window.supabase?.createClient) {
      state.auth.error = 'Cliente Supabase nao carregou no navegador.';
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
    state.auth.client.auth.onAuthStateChange(async (_event, session) => {
      state.auth.user = session?.user || null;
      state.auth.ready = true;
      renderAuthPanel();
      await loadAuthProfile(session);
      if (canReadCampaign()) await loadCampaignData();
      else {
        resetCampaignData();
        render();
      }
    });
    state.auth.ready = true;
    renderAuthPanel();
    await loadAuthProfile(data?.session || null);
  } catch (error) {
    state.auth.ready = true;
    state.auth.error = error.message;
    renderAuthPanel();
  }
}

function canReadCampaign() {
  return Boolean(state.auth.capabilities?.canReadCampaign);
}

function canManageCampaign() {
  return Boolean(state.auth.capabilities?.canManageCampaign);
}

function resetCampaignData() {
  state.sessions = [];
  state.selectedSourceSessionId = null;
  state.review = null;
  state.summary = null;
  state.jobs = [];
  state.craigMap = null;
  state.craigMapEditable = false;
}

async function loadCampaignData() {
  await loadSessions();
  await loadJobs();
  await loadCraigMap();
}

async function loadAuthProfile(session = null) {
  state.auth.profile = null;
  state.auth.memberships = [];
  state.auth.campaignRole = null;
  state.auth.capabilities = null;
  state.auth.profileError = null;
  if (!state.auth.user || !state.auth.client) {
    state.auth.profileLoading = false;
    renderAuthPanel();
    return;
  }
  try {
    state.auth.profileLoading = true;
    renderAuthPanel();
    let activeSession = session;
    if (!activeSession) {
      const { data, error } = await state.auth.client.auth.getSession();
      if (error) throw error;
      activeSession = data?.session || null;
    }
    if (!activeSession?.access_token) return;
    const expectedUserId = activeSession.user?.id;
    const payload = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${activeSession.access_token}` }
    });
    if (expectedUserId && state.auth.user?.id && expectedUserId !== state.auth.user.id) return;
    state.auth.profile = payload.profile || null;
    state.auth.memberships = payload.memberships || [];
    state.auth.campaignRole = payload.campaignRole || null;
    state.auth.capabilities = payload.capabilities || null;
  } catch (error) {
    state.auth.profileError = error.message;
  } finally {
    state.auth.profileLoading = false;
    renderAuthPanel();
  }
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
  return {
    discord: 'Discord',
    google: 'Google'
  }[provider] || 'OAuth';
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

function sessionStatusLabel(status) {
  return {
    planned: 'Planejada',
    recording: 'Gravando',
    uploaded: 'Upload feito',
    processing: 'Processando',
    ready_for_review: 'Pronta review',
    reviewing: 'Em review',
    approved: 'Aprovada',
    published: 'Publicada',
    archived: 'Arquivada',
    failed: 'Falhou'
  }[status] || status || 'Sem status';
}

function selectedSession() {
  return state.sessions.find(session => session.sourceSessionId === state.selectedSourceSessionId) || null;
}

function renderAuthPanel() {
  const panel = $('#authPanel');
  if (!panel) return;
  const user = state.auth.user;
  const profile = state.auth.profile;
  const profileName = profile?.displayName || authDisplayName(user);
  const profileDetail = [
    profile?.roll20Name ? `@${profile.roll20Name}` : '',
    profile?.defaultCharacterName || ''
  ].filter(Boolean).join(' • ');
  const role = roleLabel(state.auth.campaignRole);
  if (!state.auth.ready) {
    panel.innerHTML = `
      <span class="label">Acesso</span>
      <strong>Conectando</strong>
      <small>Preparando login da mesa.</small>
    `;
    return;
  }
  if (state.auth.error) {
    panel.innerHTML = `
      <span class="label">Acesso</span>
      <strong>Acesso fechado</strong>
      <small>${escapeHtml(state.auth.error)}</small>
      <div class="auth-actions">
        <button onclick="initAuth()">Tentar de novo</button>
      </div>
    `;
    return;
  }
  if (!user) {
    panel.innerHTML = `
      <span class="label">Acesso</span>
      <strong>Entrada da mesa</strong>
      <small>Discord e o login principal. Google fica como alternativa.</small>
      <div class="badges">${badge('RBAC ativo', 'green')}${badge('DM aprova', 'gold')}</div>
      <div class="auth-actions">
        <button class="primary" onclick="signInDiscord()">Entrar Discord</button>
        <button onclick="signInGoogle()">Google</button>
      </div>
    `;
    return;
  }
  const provider = authProviderName(user);
  if (!state.auth.campaignRole) {
    panel.innerHTML = `
      <span class="label">Acesso</span>
      <strong>${escapeHtml(profileName)}</strong>
      <small>${escapeHtml(profile ? profileDetail : 'Login conectado; vinculo da mesa pendente.')}</small>
      <div class="badges">
        ${badge(authProviderLabel(provider), provider === 'discord' ? 'violet' : 'green')}
        ${badge('Aguardando DM', 'orange')}
      </div>
      ${state.auth.profileLoading ? '<small>Atualizando perfil da mesa...</small>' : ''}
      ${state.auth.profileError ? `<small>${escapeHtml(state.auth.profileError)}</small>` : ''}
      <div class="auth-actions">
        <button class="primary" onclick="state.tab='access'; render();">Solicitar acesso</button>
        <button onclick="signOutAuth()">Sair</button>
      </div>
    `;
    return;
  }
  panel.innerHTML = `
    <span class="label">Acesso</span>
    <strong>${escapeHtml(profileName)}</strong>
    <small>${escapeHtml(profileDetail || 'Perfil da mesa aprovado.')}</small>
    <div class="badges">
      ${badge(authProviderLabel(provider), provider === 'discord' ? 'violet' : 'green')}
      ${badge(role, state.auth.campaignRole === 'master' ? 'gold' : 'blue')}
      ${badge('RBAC ativo', 'green')}
    </div>
    ${state.auth.profileLoading ? '<small>Atualizando perfil da mesa...</small>' : ''}
    ${state.auth.profileError ? `<small>${escapeHtml(state.auth.profileError)}</small>` : ''}
    <div class="auth-actions">
      <button onclick="signOutAuth()">Sair</button>
    </div>
  `;
}

async function signInProvider(provider) {
  if (!state.auth.client) {
    toast('Login ainda nao esta pronto.');
    return;
  }
  const { error } = await state.auth.client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin
    }
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

function initMusicDock() {
  renderMusicDock();
  state.music.ready = true;
}

function renderMusicDock() {
  const dock = $('#musicDock');
  if (!dock) return;
  dock.className = `music-dock ${state.music.expanded ? 'expanded' : 'collapsed'}`;
  if (dock.dataset.rendered === 'true') {
    const play = document.getElementById('musicPlayBtn');
    const volume = document.getElementById('musicVolumeLabel');
    const expand = document.getElementById('musicExpandBtn');
    if (play) play.textContent = state.music.playing ? '⏸' : '▶';
    if (volume) volume.textContent = `${state.music.volume}%`;
    if (expand) expand.textContent = state.music.expanded ? 'Ocultar' : 'Playlist';
    updateMusicPanel();
    return;
  }
  dock.innerHTML = `
    <div class="music-dock-main">
      <div class="music-dock-title">
        <span class="label">Palco</span>
        <strong>${escapeHtml(DandelionPlaylist.owner)}</strong>
      </div>
      <div class="music-dock-controls">
        <button title="Voltar" onclick="musicPrevious()">⏮</button>
        <button id="musicPlayBtn" class="primary" title="Play/Pause" onclick="musicToggle()">${state.music.playing ? '⏸' : '▶'}</button>
        <button title="Proxima" onclick="musicNext()">⏭</button>
        <button title="Baixar volume" onclick="musicVolume(-10)">−</button>
        <span id="musicVolumeLabel">${state.music.volume}%</span>
        <button title="Subir volume" onclick="musicVolume(10)">+</button>
        <button id="musicExpandBtn" title="Exibir playlist" onclick="musicToggleExpanded()">${state.music.expanded ? 'Ocultar' : 'Playlist'}</button>
      </div>
    </div>
    <div id="musicPlayerFrame" class="music-engine" aria-hidden="true"></div>
    <div id="musicDockPanel" class="music-dock-panel"></div>
  `;
  dock.dataset.rendered = 'true';
  updateMusicPanel();
}

function updateMusicPanel() {
  const panel = document.getElementById('musicDockPanel');
  if (!panel) return;
  if (!state.music.expanded) {
    panel.innerHTML = '';
    return;
  }
  panel.innerHTML = `
    <div class="music-dock-playlist">
      <strong>${escapeHtml(DandelionPlaylist.title)}</strong>
      <p>Playlist publica criada pelo Dandelion para usar como clima de mesa. O player fica pequeno; a tela do video nao ocupa o app.</p>
      <div class="music-dock-links">
        <a class="button-link" href="${escapeHtml(DandelionPlaylist.youtubeUrl)}" target="_blank" rel="noreferrer">Abrir playlist</a>
        <button onclick="copyText('${escapeHtml(DandelionPlaylist.youtubeUrl)}', 'Link da playlist copiado.')">Copiar link</button>
      </div>
    </div>
  `;
}

function ensureMusicFrame() {
  const frame = document.getElementById('musicPlayerFrame');
  if (!frame) return false;
  if (frame.querySelector('iframe')) return true;
  frame.innerHTML = `
    <iframe
      src="${escapeHtml(DandelionPlaylist.embedUrl)}&autoplay=1&origin=${encodeURIComponent(location.origin)}"
      title="${escapeHtml(DandelionPlaylist.title)}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen></iframe>
  `;
  window.setTimeout(() => musicCommand('setVolume', [state.music.volume]), 600);
  return false;
}

function musicToggle() {
  const frameExisted = ensureMusicFrame();
  if (state.music.playing) musicCommand('pauseVideo');
  else if (frameExisted) musicCommand('playVideo');
  else {
    toast('Carregando player...');
    window.setTimeout(() => {
      musicCommand('setVolume', [state.music.volume]);
      musicCommand('playVideo');
    }, 900);
  }
  state.music.playing = !state.music.playing;
  renderMusicDock();
}

function musicNext() {
  const frameExisted = ensureMusicFrame();
  if (frameExisted) musicCommand('nextVideo');
  else window.setTimeout(() => musicCommand('nextVideo'), 900);
}

function musicPrevious() {
  const frameExisted = ensureMusicFrame();
  if (frameExisted) musicCommand('previousVideo');
  else window.setTimeout(() => musicCommand('previousVideo'), 900);
}

function musicVolume(delta) {
  state.music.volume = Math.max(0, Math.min(100, state.music.volume + delta));
  musicCommand('setVolume', [state.music.volume]);
  renderMusicDock();
}

function musicToggleExpanded() {
  state.music.expanded = !state.music.expanded;
  renderMusicDock();
}

function musicCommand(func, args = []) {
  const iframe = document.querySelector('#musicPlayerFrame iframe');
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
}

async function loadSessions(force = false) {
  try {
    setBusy(true);
    const payload = await api(`/api/sessions?runId=${encodeURIComponent(DEFAULT_RUN)}`);
    state.sessions = payload.sessions || [];
    if (!state.selectedSourceSessionId || force) {
      state.selectedSourceSessionId = state.sessions[0]?.sourceSessionId || null;
    }
    renderSessions();
    if (state.selectedSourceSessionId) {
      await loadSession(state.selectedSourceSessionId);
    } else {
      render();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    setBusy(false);
  }
}

async function loadJobs(scheduleNext = true) {
  try {
    const payload = await api('/api/jobs');
    state.jobs = payload.jobs || [];
    render();
    const hasActive = state.jobs.some(job => (
      ['queued', 'running'].includes(job.status)
      && job.output?.workerStatus !== 'pending_worker_implementation'
    ));
    if (scheduleNext && hasActive && !state.jobsPolling) {
      state.jobsPolling = true;
      window.setTimeout(async () => {
        state.jobsPolling = false;
        await loadJobs(true);
      }, 2500);
    }
  } catch (_error) {
    state.jobs = state.jobs || [];
  }
}

async function loadCraigMap() {
  try {
    const payload = await api('/api/craig-map');
    state.craigMap = payload.map || null;
    state.craigMapEditable = Boolean(payload.editable);
    state.craigMapError = null;
    render();
  } catch (error) {
    state.craigMap = null;
    state.craigMapEditable = false;
    state.craigMapError = error.message;
    render();
  }
}

async function loadSession(sourceSessionId) {
  try {
    setBusy(true);
    state.loadingSession = true;
    state.selectedSourceSessionId = sourceSessionId;
    render();
    const payload = await api(`/api/session?sourceSessionId=${encodeURIComponent(sourceSessionId)}&runId=${encodeURIComponent(DEFAULT_RUN)}`);
    state.review = payload.review;
    state.summary = payload.summary || null;
    state.selectedSegmentId = state.review?.segments?.[0]?.id || null;
    state.segmentDecisions = {};
    state.candidateDecisions = {};
    state.audio = {
      segmentId: null,
      loading: false,
      error: null,
      url: null,
      trackKey: null,
      startSeconds: 0,
      expiresAt: null,
      file: null
    };
    const draft = restoreDraft(sourceSessionId);
    if (draft.restored && (draft.segments || draft.candidates)) {
      remember(`Rascunho restaurado: ${draft.segments} segmentos, ${draft.candidates} candidatos.`);
    }
    remember(`Sessao carregada: ${sourceSessionId}`, payload.summary);
    render();
  } catch (error) {
    toast(error.message);
  } finally {
    state.loadingSession = false;
    setBusy(false);
    render();
  }
}

function renderSessions() {
  $('#sessionList').innerHTML = state.sessions.map(session => `
    <button class="session-button ${session.sourceSessionId === state.selectedSourceSessionId ? 'active' : ''}" onclick="loadSession('${escapeHtml(session.sourceSessionId)}')">
      <strong>${escapeHtml(session.title || session.sourceSessionId)}</strong>
      <small>${escapeHtml(session.sourceSessionId)} • ${escapeHtml(session.status || '-')}</small>
      <div class="session-meta">
        ${badge(`${session.segments || 0} seg`, 'blue')}
        ${badge(`${session.aiCandidates || 0} IA`, 'violet')}
        ${badge(`${session.reviewDecisions || 0} decisoes`, 'gold')}
      </div>
    </button>
  `).join('') || `<div class="empty">Nenhuma sessao encontrada.</div>`;
}

function render() {
  renderSessions();
  renderHeader();
  renderStatusStrip();
  updateActionButtons();
  if (state.auth.ready && !canReadCampaign() && state.tab !== 'access') {
    $('#view').innerHTML = authGateView();
    return;
  }
  document.querySelectorAll('#tabs button').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === state.tab);
  });
  if (!state.review && state.tab !== 'sessions') {
    $('#view').innerHTML = loadingView();
    return;
  }
  if (state.loadingSession) {
    $('#view').innerHTML = loadingView('Atualizando sessao real do Supabase...');
    return;
  }
  const routes = {
    sessions: renderSessionsManager,
    review: renderReview,
    candidates: renderCandidates,
    publications: renderPublications,
    ops: renderOps
  };
  $('#view').innerHTML = (routes[state.tab] || renderReview)();
}

function loadingView(message = 'Carregando dados reais do Supabase...') {
  return `
    <section class="loading-panel">
      <div class="loader-line"></div>
      <h2>${escapeHtml(message)}</h2>
      <p>O backend esta buscando sessao, transcricao, candidatos, publicacoes e resumo operacional.</p>
    </section>
  `;
}

function authGateView() {
  if (!state.auth.user) {
    return `
      <section class="loading-panel auth-gate">
        <h2>Entrada da mesa</h2>
        <p>Entre com Discord para acessar sessoes, notas, audio e revisoes. Google fica disponivel como alternativa.</p>
        <div class="auth-actions">
          <button class="primary" onclick="signInDiscord()">Entrar Discord</button>
          <button onclick="signInGoogle()">Google</button>
        </div>
      </section>
    `;
  }
  return `
    <section class="loading-panel auth-gate">
      <h2>Acesso aguardando aprovacao</h2>
      <p>Seu login esta conectado, mas o perfil da mesa ainda precisa ser vinculado e aprovado pelo DM.</p>
      <div class="auth-actions">
        <button class="primary" onclick="state.tab='access'; render();">Abrir acesso</button>
        <button onclick="signOutAuth()">Sair</button>
      </div>
    </section>
  `;
}

function renderHeader() {
  const review = state.review;
  $('#eyebrow').textContent = review ? `${review.campaign.name} • ${review.session.status}` : 'Prod operator';
  $('#title').textContent = review ? review.session.title : 'DnD Scribe';
}

function renderStatusStrip() {
  const review = state.review;
  const summary = state.summary || {};
  const counts = decisionCounts();
  $('#statusStrip').innerHTML = `
    ${metric(review?.summary?.segments || 0, 'segmentos')}
    ${metric(review?.summary?.participants || 0, 'participantes')}
    ${metric(review?.ai?.summary?.canonCandidates || 0, 'canon IA')}
    ${metric((review?.ai?.summary?.quoteCandidates || 0) + (review?.ai?.summary?.outtakeCandidates || 0), 'falas/bastidores')}
    ${metric(summary.reviewDecisions || 0, 'decisoes salvas')}
    ${metric(counts.segments + counts.candidates, 'rascunho local', hasDraftChanges() ? 'dirty' : '')}
  `;
}

function metric(value, label, extraClass = '') {
  return `<div class="metric ${extraClass}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function sessionStatusOptions(selected = 'planned') {
  return SESSION_STATUSES.map(status => `
    <option value="${status}" ${selected === status ? 'selected' : ''}>${escapeHtml(sessionStatusLabel(status))}</option>
  `).join('');
}

function renderSessionsManager() {
  const session = selectedSession();
  return `
    <section class="session-manager">
      <div class="panel">
        <div class="panel-head"><h2>Nova sessao</h2>${badge('manual', 'blue')}</div>
        <div class="panel-body">
          <div class="field-grid">
            <label><span class="label">Titulo</span><input id="newSessionTitle" placeholder="Sessao 12 - Nome provisório" /></label>
            <label><span class="label">Data</span><input id="newSessionDate" type="date" /></label>
            <label><span class="label">Arco</span><input id="newSessionArc" placeholder="Arco atual" /></label>
            <label><span class="label">Status</span><select id="newSessionStatus">${sessionStatusOptions('planned')}</select></label>
          </div>
          <label><span class="label">Resumo curto</span><textarea id="newSessionSummary" placeholder="Opcional"></textarea></label>
          <div class="actions">
            <button class="primary" onclick="createSessionFromForm()">Criar sessao</button>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2>Sessao selecionada</h2>
          ${session ? badge(sessionStatusLabel(session.status), session.status === 'failed' ? 'red' : 'green') : ''}
        </div>
        <div class="panel-body">
          ${session ? editSessionForm(session) : `<div class="empty">Nenhuma sessao selecionada.</div>`}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Catalogo</h2><small>${state.sessions.length} sessoes</small></div>
        <div class="panel-body session-table">
          ${state.sessions.map(sessionCatalogRow).join('') || `<div class="empty">Nenhuma sessao encontrada.</div>`}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Ingestao Craig</h2>${badge('prod upload', 'green')}</div>
        <div class="panel-body">
          ${renderCraigIngestPanel()}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2>Mapa Craig</h2>
          <button onclick="loadCraigMap()">Atualizar</button>
        </div>
        <div class="panel-body">
          ${renderCraigMapPanel()}
        </div>
      </div>
    </section>
  `;
}

function renderCraigMapPanel() {
  if (state.craigMapError) return `<div class="empty">${escapeHtml(state.craigMapError)}</div>`;
  const tracks = state.craigMap?.tracks || {};
  const keys = Object.keys(tracks).sort();
  return `
    <div class="craig-map-list">
      ${!state.craigMapEditable ? `<div class="empty">Mapa carregado da producao em modo leitura. Edicao cloud entra na proxima etapa.</div>` : ''}
      ${keys.map(key => craigTrackRow(key, tracks[key])).join('') || `<div class="empty">Nenhum mapeamento Craig encontrado.</div>`}
      ${state.craigMapEditable ? `<div class="job-row">
        <span class="label">Nova faixa</span>
        ${craigTrackForm('new', {
          person_name: '',
          default_character: '',
          role: 'guest',
          status: 'guest_or_unknown',
          character_aliases: []
        }, true)}
      </div>` : ''}
    </div>
  `;
}

function craigTrackRow(trackKey, item) {
  return `
    <div class="job-row">
      <div class="row between">
        <strong>${escapeHtml(trackKey)}</strong>
        <div class="badges">${badge(item.status || 'unknown', item.status === 'known' ? 'green' : 'orange')}${badge(item.role || 'guest', 'blue')}</div>
      </div>
      ${craigTrackForm(trackKey, item, false)}
    </div>
  `;
}

function craigTrackForm(trackKey, item, editableKey) {
  const prefix = `craig_${safeId(trackKey)}`;
  return `
    <div class="field-grid">
      <label><span class="label">Track</span><input id="${prefix}_key" value="${editableKey ? '' : escapeHtml(trackKey)}" ${editableKey ? '' : 'disabled'} /></label>
      <label><span class="label">Pessoa</span><input id="${prefix}_person" value="${escapeHtml(item.person_name || '')}" /></label>
      <label><span class="label">Personagem padrao</span><input id="${prefix}_character" value="${escapeHtml(item.default_character || '')}" /></label>
      <label><span class="label">Aliases</span><input id="${prefix}_aliases" value="${escapeHtml((item.character_aliases || []).join(', '))}" /></label>
      <label><span class="label">Role</span><select id="${prefix}_role">
        ${['player', 'dm', 'guest'].map(role => `<option value="${role}" ${item.role === role ? 'selected' : ''}>${escapeHtml(role)}</option>`).join('')}
      </select></label>
      <label><span class="label">Status</span><select id="${prefix}_status">
        ${['known', 'guest_or_unknown'].map(status => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}
      </select></label>
    </div>
    <div class="actions">
      <button onclick="saveCraigTrack('${escapeHtml(trackKey)}', ${editableKey ? 'true' : 'false'})" ${state.craigMapEditable ? '' : 'disabled'}>Salvar mapa</button>
    </div>
  `;
}

function renderCraigIngestPanel() {
  return `
    <div class="detail-grid">
      <label><span class="label">Sessao alvo</span>
        <select id="ingestSessionId">
          <option value="">Criar sessao pelo nome do ZIP</option>
          ${state.sessions.map(session => `<option value="${escapeHtml(session.sourceSessionId)}" ${session.sourceSessionId === state.selectedSourceSessionId ? 'selected' : ''}>${escapeHtml(session.title || session.sourceSessionId)}</option>`).join('')}
        </select>
      </label>
      <label><span class="label">ZIP Craig</span><input id="craigZipFile" type="file" accept=".zip,application/zip" /></label>
      <div class="field-grid">
        <label><span class="label">Chunk segundos</span><input id="ingestChunkSeconds" type="number" min="60" step="30" value="600" /></label>
        <label><span class="label">Amostra segundos</span><input id="ingestSampleSeconds" type="number" min="0" step="30" placeholder="vazio" /></label>
      </div>
      <label class="check-row"><input id="ingestSkipChunks" type="checkbox" /> <span>Somente manifest quando o worker cloud estiver ativo</span></label>
      <div class="actions">
        <button class="primary" onclick="uploadCraigFromForm()" ${state.ingest.busy ? 'disabled' : ''}>Enviar ZIP para producao</button>
      </div>
      ${state.ingest.busy ? `<div class="loading-panel"><div class="loader-line"></div><h2>Enviando ZIP Craig para R2...</h2></div>` : ''}
      ${state.ingest.error ? `<div class="empty">${escapeHtml(state.ingest.error)}</div>` : ''}
      ${state.ingest.result ? renderIngestResult(state.ingest.result) : ''}
    </div>
  `;
}

function renderIngestResult(result) {
  if (result.job) {
    return `
      <div class="ops-card">
        <span class="label">Job</span>
        <strong>${escapeHtml(result.job.type)}</strong>
        <div class="badges">${badge(result.job.status, result.job.status === 'failed' ? 'red' : 'blue')}${badge(result.job.id.slice(0, 8), 'gold')}</div>
        ${result.upload ? `<pre>${escapeHtml(JSON.stringify({
          bucket: result.upload.storageBucket,
          path: result.upload.storagePath,
          file: result.upload.originalFilename,
          cost: result.cost?.paidAiCostUsd ?? 0
        }, null, 2))}</pre>` : ''}
      </div>
    `;
  }
  const ingest = result.ingest || {};
  return `
    <div class="ops-card">
      <span class="label">Resultado</span>
      <div class="badges">
        ${badge(`${ingest.tracks || 0} tracks`, 'blue')}
        ${badge(`${ingest.participants || 0} participantes`, 'green')}
        ${badge(`${ingest.chunks || 0} chunks`, 'violet')}
      </div>
      <pre>${escapeHtml(JSON.stringify({
        sessionDir: ingest.sessionDir,
        manifest: ingest.manifest,
        upload: result.upload?.savedPath
      }, null, 2))}</pre>
    </div>
  `;
}

function editSessionForm(session) {
  return `
    <div class="detail-grid">
      <label><span class="label">Source ID</span><input value="${escapeHtml(session.sourceSessionId || '')}" disabled /></label>
      <div class="field-grid">
        <label><span class="label">Titulo</span><input id="editSessionTitle" value="${escapeHtml(session.title || '')}" /></label>
        <label><span class="label">Data</span><input id="editSessionDate" type="date" value="${escapeHtml(session.sessionDate || '')}" /></label>
        <label><span class="label">Arco</span><input id="editSessionArc" value="${escapeHtml(session.arc || '')}" /></label>
        <label><span class="label">Status</span><select id="editSessionStatus">${sessionStatusOptions(session.status || 'planned')}</select></label>
      </div>
      <label><span class="label">Resumo curto</span><textarea id="editSessionSummary">${escapeHtml(session.summary || '')}</textarea></label>
      <div class="badges">
        ${badge(session.sourceSystem || 'manual', 'blue')}
        ${badge(`${session.segments || 0} segmentos`, 'violet')}
        ${badge(`${session.recordingFiles || 0} arquivos`, 'gold')}
      </div>
      <div class="actions">
        <button class="success" onclick="updateSessionFromForm()">Salvar sessao</button>
        <button onclick="loadSession('${escapeHtml(session.sourceSessionId)}')">Abrir review</button>
      </div>
    </div>
  `;
}

function sessionCatalogRow(session) {
  return `
    <button class="session-row ${session.sourceSessionId === state.selectedSourceSessionId ? 'active' : ''}" onclick="loadSession('${escapeHtml(session.sourceSessionId)}')">
      <div>
        <strong>${escapeHtml(session.title || session.sourceSessionId)}</strong>
        <small>${escapeHtml(session.sessionDate || 'sem data')} • ${escapeHtml(session.sourceSessionId || '')}</small>
      </div>
      <div class="badges">
        ${badge(sessionStatusLabel(session.status), session.status === 'failed' ? 'red' : 'blue')}
        ${badge(`${session.participants || 0} participantes`, 'green')}
        ${badge(`${session.segments || 0} seg`, 'violet')}
      </div>
    </button>
  `;
}

async function createSessionFromForm() {
  const title = $('#newSessionTitle')?.value || '';
  if (!title.trim()) {
    toast('Informe um titulo para a sessao.');
    return;
  }
  try {
    setBusy(true);
    const payload = await api('/api/sessions/create', {
      method: 'POST',
      body: JSON.stringify({
        title,
        sessionDate: $('#newSessionDate')?.value || null,
        arc: $('#newSessionArc')?.value || '',
        status: $('#newSessionStatus')?.value || 'planned',
        summary: $('#newSessionSummary')?.value || '',
        runId: DEFAULT_RUN
      })
    });
    state.sessions = payload.sessions || state.sessions;
    state.selectedSourceSessionId = payload.session?.sourceSessionId || state.selectedSourceSessionId;
    remember(`Sessao criada: ${payload.session?.sourceSessionId || title}`);
    toast('Sessao criada.');
    if (state.selectedSourceSessionId) await loadSession(state.selectedSourceSessionId);
    state.tab = 'sessions';
    render();
  } catch (error) {
    toast(error.message);
  } finally {
    setBusy(false);
  }
}

async function updateSessionFromForm() {
  const session = selectedSession();
  if (!session) return;
  const title = $('#editSessionTitle')?.value || '';
  if (!title.trim()) {
    toast('Informe um titulo para a sessao.');
    return;
  }
  try {
    setBusy(true);
    const payload = await api('/api/sessions/update', {
      method: 'POST',
      body: JSON.stringify({
        sourceSessionId: session.sourceSessionId,
        title,
        sessionDate: $('#editSessionDate')?.value || null,
        arc: $('#editSessionArc')?.value || '',
        status: $('#editSessionStatus')?.value || 'planned',
        summary: $('#editSessionSummary')?.value || '',
        runId: DEFAULT_RUN
      })
    });
    state.sessions = payload.sessions || state.sessions;
    state.review = null;
    state.summary = null;
    remember(`Sessao atualizada: ${session.sourceSessionId}`);
    toast('Sessao salva.');
    await loadSession(session.sourceSessionId);
    state.tab = 'sessions';
    render();
  } catch (error) {
    toast(error.message);
  } finally {
    setBusy(false);
  }
}

async function uploadCraigFromForm() {
  const file = $('#craigZipFile')?.files?.[0];
  if (!file) {
    toast('Selecione o ZIP Craig.');
    return;
  }
  state.ingest = { busy: true, error: null, result: null };
  setBusy(true);
  render();
  try {
    const planned = await api('/api/uploads/craig-url', {
      method: 'POST',
      body: JSON.stringify({
        sourceSessionId: $('#ingestSessionId')?.value || '',
        fileName: file.name,
        sizeBytes: file.size,
        contentType: file.type || 'application/zip',
        chunkSeconds: $('#ingestChunkSeconds')?.value || '600',
        sampleSeconds: $('#ingestSampleSeconds')?.value || '',
        skipChunks: $('#ingestSkipChunks')?.checked || false,
        runId: DEFAULT_RUN
      })
    });
    remember(`URL R2 criada: ${planned.upload?.storagePath || file.name}`);
    const uploadResponse = await fetch(planned.upload.signedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': planned.upload.contentType || file.type || 'application/zip'
      }
    });
    if (!uploadResponse.ok) {
      throw new Error(`Upload R2 falhou (${uploadResponse.status}). Verifique CORS do bucket e tente novamente.`);
    }
    const payload = await api('/api/uploads/craig-complete', {
      method: 'POST',
      body: JSON.stringify({
        sourceSessionId: planned.session.sourceSessionId,
        recordingFileId: planned.upload.recordingFileId,
        jobId: planned.job.id,
        sizeBytes: file.size,
        runId: DEFAULT_RUN
      })
    });
    state.ingest = { busy: false, error: null, result: payload };
    if (payload.sessions) state.sessions = payload.sessions;
    if (payload.jobs) state.jobs = payload.jobs;
    state.selectedSourceSessionId = planned.session.sourceSessionId || state.selectedSourceSessionId;
    if (payload.job) {
      state.jobs = [payload.job, ...state.jobs.filter(job => job.id !== payload.job.id)];
      remember(`Upload Craig confirmado: ${payload.upload?.storagePath || file.name}`);
      toast('ZIP salvo no R2. Job de ingestao cloud criado.');
      await loadJobs(true);
    } else {
      remember(`Upload Craig: ${file.name}`);
      toast('ZIP Craig enviado.');
    }
  } catch (error) {
    state.ingest = { busy: false, error: error.message, result: null };
    toast(error.message);
  } finally {
    setBusy(false);
    state.tab = 'sessions';
    render();
  }
}

async function saveCraigTrack(trackKey, editableKey = false) {
  const prefix = `craig_${safeId(trackKey)}`;
  const actualKey = editableKey ? $(`#${prefix}_key`)?.value : trackKey;
  if (!actualKey?.trim()) {
    toast('Informe a track.');
    return;
  }
  try {
    setBusy(true);
    const payload = await api('/api/craig-map/update', {
      method: 'POST',
      body: JSON.stringify({
        trackKey: actualKey,
        personName: $(`#${prefix}_person`)?.value || '',
        defaultCharacter: $(`#${prefix}_character`)?.value || '',
        characterAliases: $(`#${prefix}_aliases`)?.value || '',
        role: $(`#${prefix}_role`)?.value || 'guest',
        status: $(`#${prefix}_status`)?.value || 'guest_or_unknown'
      })
    });
    state.craigMap = payload.map || state.craigMap;
    state.craigMapError = null;
    toast('Mapa Craig salvo.');
    render();
  } catch (error) {
    toast(error.message);
  } finally {
    setBusy(false);
  }
}

function reviewDecision(segment) {
  const local = state.segmentDecisions[segment.id];
  if (local) return local;
  const ai = segment.ai || {};
  const flags = ai.metadata?.candidate_flags || {};
  let status = segment.review_status || 'pending';
  if (flags.canon && status === 'pending') status = 'canon_candidate';
  if (flags.quote && status === 'pending') status = 'quote_candidate';
  if (flags.outtake && status === 'pending') status = 'outtake';
  if ((segment.needs_review || ai.needs_review) && status === 'pending') status = 'needs_review';
  return {
    status,
    characterName: segment.character_name || '',
    textOverride: '',
    note: ''
  };
}

function statusLabel(status) {
  const labels = {
    pending: ['Pendente', 'blue'],
    needs_review: ['Revisar', 'orange'],
    approved: ['Aprovado', 'green'],
    canon_candidate: ['Canon?', 'gold'],
    quote_candidate: ['Fala', 'violet'],
    outtake: ['Bastidor', 'orange'],
    private_note: ['Privado', 'red'],
    rejected: ['Rejeitado', 'red']
  };
  return labels[status] || [status, ''];
}

function statusBadge(status) {
  const [label, color] = statusLabel(status);
  return badge(label, color);
}

function filteredSegments() {
  const query = state.query.trim().toLowerCase();
  return (state.review?.segments || []).filter(segment => {
    const decision = reviewDecision(segment);
    const text = [
      segment.text,
      segment.speaker_name,
      segment.character_name,
      segment.track_key,
      decision.status,
      decision.characterName,
      decision.note
    ].join(' ').toLowerCase();
    return (state.speaker === 'all' || segment.track_key === state.speaker)
      && (state.status === 'all' || decision.status === state.status)
      && (!query || text.includes(query));
  });
}

function renderReview() {
  const segments = filteredSegments();
  const tracks = [{ track_key: 'all', speaker_name: 'Todos' }, ...(state.review.tracks || [])];
  const statuses = ['all', 'pending', 'needs_review', 'approved', 'canon_candidate', 'quote_candidate', 'outtake', 'private_note', 'rejected'];
  if (!state.selectedSegmentId || !segments.some(segment => segment.id === state.selectedSegmentId)) {
    state.selectedSegmentId = segments[0]?.id || state.review.segments?.[0]?.id || null;
  }
  const selected = state.review.segments.find(segment => segment.id === state.selectedSegmentId);
  return `
    <section class="toolbar">
      <input value="${escapeHtml(state.query)}" placeholder="Buscar texto, speaker, personagem..." oninput="state.query=this.value; render();" />
      <select onchange="state.speaker=this.value; render();">
        ${tracks.map(track => `<option value="${escapeHtml(track.track_key)}" ${state.speaker === track.track_key ? 'selected' : ''}>${escapeHtml(track.track_key === 'all' ? 'Todos speakers' : track.speaker_name || track.track_key)}</option>`).join('')}
      </select>
      <select onchange="state.status=this.value; render();">
        ${statuses.map(status => {
          const label = status === 'all' ? 'Todos status' : statusLabel(status)[0];
          return `<option value="${status}" ${state.status === status ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        }).join('')}
      </select>
    </section>
    <section class="review-layout">
      <div class="panel">
        <div class="panel-head"><h2>Timeline</h2><small>${segments.length}/${state.review.segments.length}</small></div>
        <div class="segment-list">
          ${segments.map(segmentRow).join('') || `<div class="empty">Nenhum segmento nesse filtro.</div>`}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Decisao do segmento</h2>${selected ? statusBadge(reviewDecision(selected).status) : ''}</div>
        <div class="panel-body">${selected ? segmentDetail(selected) : `<div class="empty">Selecione um segmento.</div>`}</div>
      </div>
    </section>
  `;
}

function segmentRow(segment) {
  const decision = reviewDecision(segment);
  const active = segment.id === state.selectedSegmentId ? 'active' : '';
  const dirty = state.segmentDecisions[segment.id] ? 'dirty' : '';
  return `
    <button class="segment-row ${active} ${dirty}" onclick="selectSegment('${segment.id}')">
      <div class="row between">
        <strong>${fmtDuration(segment.start_ms)} • ${escapeHtml(decision.characterName || segment.character_name || segment.track_key)}</strong>
        <span class="badges">${state.segmentDecisions[segment.id] ? badge('rascunho', 'gold') : ''}${statusBadge(decision.status)}</span>
      </div>
      <p>${escapeHtml((decision.textOverride || segment.text || '').slice(0, 260))}</p>
      <div class="badges">
        ${badge(segment.track_key, 'blue')}
        ${badge(segment.speaker_name || '-', '')}
        ${segment.ai ? badge(segment.ai.segment_type, 'green') : ''}
        ${segment.ai?.canon_relevance && segment.ai.canon_relevance !== 'none' ? badge(`canon ${segment.ai.canon_relevance}`, 'gold') : ''}
      </div>
    </button>
  `;
}

function segmentDetail(segment) {
  const decision = reviewDecision(segment);
  return `
    <div class="detail-grid">
      <div class="row between">
        <div>
          <span class="label">${fmtDuration(segment.start_ms)} - ${fmtDuration(segment.end_ms)}</span>
          <h2>${escapeHtml(segment.speaker_name || segment.track_key)}</h2>
        </div>
        <div class="badges">${badge(segment.track_key, 'blue')}${segment.needs_review ? badge('speaker?', 'orange') : ''}</div>
      </div>
      <div class="field-grid">
        <label><span class="label">Personagem</span><input id="segmentCharacter" value="${escapeHtml(decision.characterName || segment.character_name || '')}" /></label>
        <label><span class="label">Status</span>${segmentStatusSelect(decision.status)}</label>
      </div>
      <label><span class="label">Texto revisado</span><textarea id="segmentText">${escapeHtml(decision.textOverride || segment.text || '')}</textarea></label>
      <label><span class="label">Nota</span><textarea id="segmentNote" placeholder="Anote contexto, duvida, corte ou motivo da decisao">${escapeHtml(decision.note || '')}</textarea></label>
      ${segmentAudioPanel(segment)}
      <div class="actions">
        <button onclick="loadSegmentAudio('${segment.id}')">Ouvir trecho</button>
        <button class="success" onclick="saveSegmentDecision('${segment.id}')">Salvar local</button>
        <button onclick="quickSegmentDecision('${segment.id}', 'approved')">Aprovar</button>
        <button onclick="quickSegmentDecision('${segment.id}', 'canon_candidate')">Canon?</button>
        <button onclick="quickSegmentDecision('${segment.id}', 'private_note')">Privado</button>
        <button class="danger" onclick="quickSegmentDecision('${segment.id}', 'rejected')">Rejeitar</button>
      </div>
      ${segment.ai ? `
        <div class="ops-card">
          <span class="label">IA</span>
          <p>${escapeHtml(segment.ai.reason || 'Sem motivo registrado.')}</p>
          <div class="badges">${badge(segment.ai.segment_type, 'green')}${badge(`conf ${Math.round(Number(segment.ai.confidence || 0) * 100)}%`, 'blue')}</div>
        </div>
      ` : ''}
    </div>
  `;
}

function segmentAudioPanel(segment) {
  const active = state.audio.segmentId === segment.id;
  if (!active) {
    return `
      <div class="audio-card">
        <span class="label">Audio</span>
        <p>Carregue a faixa original para conferir este trecho a partir de ${fmtDuration(segment.start_ms)}.</p>
      </div>
    `;
  }
  if (state.audio.loading) {
    return `
      <div class="audio-card">
        <span class="label">Audio</span>
        <p>Gerando URL assinada da faixa ${escapeHtml(segment.track_key)}...</p>
      </div>
    `;
  }
  if (state.audio.error) {
    return `
      <div class="audio-card error">
        <span class="label">Audio</span>
        <p>${escapeHtml(state.audio.error)}</p>
      </div>
    `;
  }
  if (!state.audio.url) return '';
  const fragment = `${state.audio.url}#t=${Math.floor(state.audio.startSeconds)}`;
  return `
    <div class="audio-card">
      <div class="row between">
        <div>
          <span class="label">Audio</span>
          <strong>${escapeHtml(state.audio.trackKey || segment.track_key)}</strong>
          <small>Inicio sugerido: ${fmtDuration(segment.start_ms)}</small>
        </div>
        <div class="badges">${badge('R2 assinado', 'green')}${badge(`${Math.round((state.audio.file?.sizeBytes || 0) / 1024 / 1024)} MB`, 'blue')}</div>
      </div>
      <audio id="segmentAudio" controls preload="metadata" src="${escapeHtml(fragment)}"></audio>
    </div>
  `;
}

async function loadSegmentAudio(id) {
  const segment = state.review?.segments?.find(item => item.id === id);
  if (!segment) return;
  state.audio = {
    segmentId: id,
    loading: true,
    error: null,
    url: null,
    trackKey: segment.track_key,
    startSeconds: Number(segment.start_ms || 0) / 1000,
    expiresAt: null,
    file: null
  };
  render();
  try {
    const payload = await api(`/api/audio-url?sourceSessionId=${encodeURIComponent(state.selectedSourceSessionId)}&trackKey=${encodeURIComponent(segment.track_key)}&expires=900`);
    state.audio = {
      segmentId: id,
      loading: false,
      error: null,
      url: payload.url,
      trackKey: payload.trackKey || segment.track_key,
      startSeconds: Number(segment.start_ms || 0) / 1000,
      expiresAt: new Date(Date.now() + Number(payload.expiresSeconds || 900) * 1000).toISOString(),
      file: payload.file || null
    };
    render();
    window.setTimeout(() => {
      const player = document.getElementById('segmentAudio');
      if (!player) return;
      const seekAndPlay = () => {
        try {
          player.currentTime = state.audio.startSeconds;
        } catch (_error) {}
        player.play().catch(() => {});
      };
      if (player.readyState >= 1) seekAndPlay();
      else player.addEventListener('loadedmetadata', seekAndPlay, { once: true });
    }, 120);
  } catch (error) {
    state.audio = {
      ...state.audio,
      loading: false,
      error: error.message
    };
    render();
  }
}

function segmentStatusSelect(status) {
  const statuses = ['pending', 'needs_review', 'approved', 'canon_candidate', 'quote_candidate', 'outtake', 'private_note', 'rejected'];
  return `<select id="segmentStatus">${statuses.map(value => `<option value="${value}" ${status === value ? 'selected' : ''}>${escapeHtml(statusLabel(value)[0])}</option>`).join('')}</select>`;
}

function selectSegment(id) {
  state.selectedSegmentId = id;
  render();
}

function quickSegmentDecision(id, status) {
  const segment = state.review.segments.find(item => item.id === id);
  const previous = reviewDecision(segment);
  state.segmentDecisions[id] = { ...previous, status, updatedAt: new Date().toISOString() };
  persistDraft();
  render();
}

function saveSegmentDecision(id) {
  const segment = state.review.segments.find(item => item.id === id);
  state.segmentDecisions[id] = {
    status: $('#segmentStatus').value,
    characterName: $('#segmentCharacter').value,
    textOverride: $('#segmentText').value,
    note: $('#segmentNote').value,
    updatedAt: new Date().toISOString()
  };
  persistDraft();
  toast('Decisao local salva.');
  render();
}

function allCandidates() {
  const ai = state.review?.ai || {};
  return [
    ...(ai.canonCandidates || []).map(item => ({ ...item, targetType: 'canon_candidates', kind: 'Canon', title: item.title, body: item.claim })),
    ...(ai.quoteCandidates || []).map(item => ({ ...item, targetType: 'quote_candidates', kind: 'Fala', title: item.character_name || 'Fala candidata', body: item.quote_text })),
    ...(ai.outtakeCandidates || []).map(item => ({ ...item, targetType: 'outtake_candidates', kind: 'Bastidor', title: item.title, body: item.description }))
  ];
}

function candidateKey(item) {
  return `${item.targetType}:${item.source_candidate_id}`;
}

function candidateDecision(item) {
  return state.candidateDecisions[candidateKey(item)] || {
    targetType: item.targetType,
    sourceCandidateId: item.source_candidate_id,
    decision: item.status || 'candidate',
    note: '',
    approvedForPublic: false
  };
}

function filteredCandidates() {
  const query = state.query.trim().toLowerCase();
  return allCandidates().filter(item => {
    const decision = candidateDecision(item);
    const text = [
      item.kind,
      item.title,
      item.source_candidate_id,
      item.body,
      decision.decision,
      decision.note,
      ...(item.source_segment_ids || [])
    ].join(' ').toLowerCase();
    return (state.candidateKind === 'all' || item.targetType === state.candidateKind)
      && (state.candidateStatus === 'all' || decision.decision === state.candidateStatus)
      && (!query || text.includes(query));
  });
}

function renderCandidates() {
  const all = allCandidates();
  const candidates = filteredCandidates();
  const kinds = [
    ['all', 'Todos tipos'],
    ['canon_candidates', 'Canon'],
    ['quote_candidates', 'Falas'],
    ['outtake_candidates', 'Bastidores']
  ];
  const statuses = ['all', ...Array.from(new Set(all.map(item => candidateDecision(item).decision))).sort()];
  return `
    <section class="toolbar">
      <input value="${escapeHtml(state.query)}" placeholder="Buscar candidato, trecho, nota..." oninput="state.query=this.value; render();" />
      <select onchange="state.candidateKind=this.value; render();">
        ${kinds.map(([value, label]) => `<option value="${value}" ${state.candidateKind === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
      </select>
      <select onchange="state.candidateStatus=this.value; render();">
        ${statuses.map(status => `<option value="${status}" ${state.candidateStatus === status ? 'selected' : ''}>${escapeHtml(status === 'all' ? 'Todos status' : status)}</option>`).join('')}
      </select>
    </section>
    <section class="candidate-grid">
      ${candidates.map(candidateCard).join('') || `<div class="empty">Nenhum candidato nesse filtro.</div>`}
    </section>
  `;
}

function candidateCard(item) {
  const decision = candidateDecision(item);
  const noteId = `note_${safeId(candidateKey(item))}`;
  const dirty = state.candidateDecisions[candidateKey(item)] ? 'dirty' : '';
  return `
    <article class="candidate-card ${dirty}">
      <div class="row between">
        <h2>${escapeHtml(item.title || item.source_candidate_id)}</h2>
        <div class="badges">${dirty ? badge('rascunho', 'gold') : ''}${candidateStatusBadge(decision.decision)}</div>
      </div>
      <small>${escapeHtml(item.kind)} • ${escapeHtml(item.source_candidate_id)} • ${escapeHtml((item.source_segment_ids || []).join(', '))}</small>
      <p>${escapeHtml(item.body || '')}</p>
      <textarea id="${noteId}" placeholder="Nota para auditoria">${escapeHtml(decision.note || '')}</textarea>
      <div class="actions">${candidateActions(item, noteId)}</div>
    </article>
  `;
}

function candidateStatusBadge(status) {
  const colors = {
    candidate: 'blue',
    approved: 'green',
    approved_canon: 'green',
    approved_by_speaker: 'green',
    approved_by_all: 'green',
    rejected: 'red',
    private: 'red',
    interpretation: 'violet',
    possible_hook: 'gold',
    retcon_pending: 'orange'
  };
  return badge(status || 'candidate', colors[status] || '');
}

function candidateActions(item, noteId) {
  const id = `'${item.targetType}','${item.source_candidate_id}','${noteId}'`;
  if (item.targetType === 'canon_candidates') {
    return `
      <button class="success" onclick="setCandidateDecision(${id}, 'approved')">Canon</button>
      <button onclick="setCandidateDecision(${id}, 'interpretation')">Interpretacao</button>
      <button onclick="setCandidateDecision(${id}, 'possible_hook')">Gancho</button>
      <button onclick="setCandidateDecision(${id}, 'private')">Privado</button>
      <button class="danger" onclick="setCandidateDecision(${id}, 'rejected')">Rejeitar</button>
    `;
  }
  if (item.targetType === 'quote_candidates') {
    return `
      <button class="success" onclick="setCandidateDecision(${id}, 'approved')">Aprovar</button>
      <button onclick="setCandidateDecision(${id}, 'private')">Privado</button>
      <button class="danger" onclick="setCandidateDecision(${id}, 'rejected')">Rejeitar</button>
    `;
  }
  return `
    <button class="success" onclick="setCandidateDecision(${id}, 'approved_by_speaker')">Speaker ok</button>
    <button class="success" onclick="setCandidateDecision(${id}, 'approved_by_all')">Mesa ok</button>
    <button onclick="setCandidateDecision(${id}, 'private')">Privado</button>
    <button class="danger" onclick="setCandidateDecision(${id}, 'rejected')">Rejeitar</button>
  `;
}

function setCandidateDecision(targetType, sourceCandidateId, noteId, decision) {
  const key = `${targetType}:${sourceCandidateId}`;
  state.candidateDecisions[key] = {
    targetType,
    sourceCandidateId,
    decision,
    note: document.getElementById(noteId)?.value || '',
    approvedForPublic: false,
    updatedAt: new Date().toISOString()
  };
  persistDraft();
  toast(`Candidato ${sourceCandidateId} marcado como ${decision}.`);
  render();
}

function renderPublications() {
  const publications = state.review?.ai?.publications || [];
  return `
    <section class="publication-grid">
      ${publications.map(publicationCard).join('') || `<div class="empty">Nenhuma publicacao gerada.</div>`}
    </section>
  `;
}

function publicationCard(item) {
  return `
    <article class="publication-card">
      <div class="row between">
        <h2>${escapeHtml(item.title || item.source_publication_id)}</h2>
        <div class="badges">${badge(item.visibility, item.visibility === 'review_only' ? 'gold' : 'green')}${badge(item.status, item.status === 'draft' ? 'orange' : 'green')}</div>
      </div>
      <small>${escapeHtml(item.publication_type)} • ${escapeHtml(item.source_publication_id)}</small>
      <pre>${escapeHtml((item.content || '').slice(0, 1400))}${(item.content || '').length > 1400 ? '\n...' : ''}</pre>
    </article>
  `;
}

function renderOps() {
  const payload = buildDecisionPayload();
  return `
    <section class="ops-grid">
      <article class="ops-card">
        <h2>Pacote local</h2>
        <p>Decisoes ainda nao aplicadas no banco.</p>
        <div class="badges">
          ${badge(`${payload.segmentDecisions.length} segmentos`, 'blue')}
          ${badge(`${payload.candidateDecisions.length} candidatos`, 'violet')}
        </div>
        <div class="actions">
          <button class="danger" ${hasDraftChanges() ? '' : 'disabled'} onclick="confirmClearDraft()">Limpar rascunho</button>
        </div>
      </article>
      <article class="ops-card">
        <h2>Resumo Supabase</h2>
        <pre>${escapeHtml(JSON.stringify(state.summary || {}, null, 2))}</pre>
      </article>
      <article class="ops-card">
        <h2>Eventos Roll20</h2>
        ${renderRoll20Events()}
      </article>
      <article class="ops-card">
        <div class="row between">
          <h2>Jobs de producao</h2>
          <button onclick="loadJobs(false)">Atualizar</button>
        </div>
        ${renderJobsList()}
      </article>
      <article class="ops-card">
        <h2>Log da tela</h2>
        <pre>${escapeHtml(state.log.map(item => `[${item.at}] ${item.message}`).join('\n') || 'Sem eventos ainda.')}</pre>
      </article>
    </section>
  `;
}

function renderRoll20Events() {
  const events = state.review?.roll20Events || [];
  if (!events.length) return `<div class="empty">Nenhum evento Roll20 importado.</div>`;
  return `
    <div class="job-list">
      ${events.slice(0, 10).map(event => `
        <div class="job-row">
          <div class="row between">
            <strong>${escapeHtml(event.event_type || 'evento')}</strong>
            ${event.approx_start_ms !== null && event.approx_start_ms !== undefined ? badge(fmtDuration(event.approx_start_ms), 'blue') : ''}
          </div>
          <small>${escapeHtml(event.roll20_who || 'Roll20')}</small>
          <p>${escapeHtml(event.text || '')}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderJobsList() {
  if (!state.jobs.length) return `<div class="empty">Nenhum job de producao registrado.</div>`;
  return `
    <div class="job-list">
      ${state.jobs.slice(0, 8).map(job => `
        <div class="job-row">
          <div>
            <strong>${escapeHtml(job.type || 'job')}</strong>
            <small>${escapeHtml(job.createdAt || '')}</small>
          </div>
          <div class="badges">
            ${badge(job.status || 'unknown', job.status === 'failed' ? 'red' : job.status === 'succeeded' ? 'green' : 'gold')}
            ${badge(String(job.id || '').slice(0, 8), 'blue')}
          </div>
          ${job.error ? `<p>${escapeHtml(job.error.slice(0, 240))}</p>` : ''}
          ${job.output ? `<pre>${escapeHtml(JSON.stringify(job.output, null, 2).slice(0, 900))}</pre>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function buildDecisionPayload() {
  return {
    schemaVersion: 1,
    sourceSessionId: state.review?.session?.sourceSessionId || state.selectedSourceSessionId,
    aiRunId: state.review?.ai?.runId || DEFAULT_RUN,
    exportedAt: new Date().toISOString(),
    actor: {
      userId: 'yuhara',
      displayName: 'Yuhara / DM',
      role: 'dm',
      trackKey: 'renanyuhara'
    },
    segmentDecisions: Object.entries(state.segmentDecisions)
      .map(([sourceSegmentId, item]) => ({
        sourceSegmentId,
        decision: item.status,
        characterName: item.characterName || '',
        textOverride: item.textOverride || '',
        note: item.note || '',
        updatedAt: item.updatedAt || null
      }))
      .sort((a, b) => a.sourceSegmentId.localeCompare(b.sourceSegmentId)),
    candidateDecisions: Object.values(state.candidateDecisions)
      .map(item => ({
        targetType: item.targetType,
        sourceCandidateId: item.sourceCandidateId,
        decision: item.decision,
        note: item.note || '',
        approvedForPublic: Boolean(item.approvedForPublic),
        updatedAt: item.updatedAt || null
      }))
      .sort((a, b) => `${a.targetType}:${a.sourceCandidateId}`.localeCompare(`${b.targetType}:${b.sourceCandidateId}`))
  };
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadDecisions() {
  const payload = buildDecisionPayload();
  downloadJson(`review_decisions_${payload.sourceSessionId || 'session'}.json`, payload);
}

async function downloadTemplate() {
  if (!state.selectedSourceSessionId) return;
  try {
    setBusy(true);
    const payload = await api(`/api/review-template?sourceSessionId=${encodeURIComponent(state.selectedSourceSessionId)}&runId=${encodeURIComponent(DEFAULT_RUN)}`);
    downloadJson(`review_template_${state.selectedSourceSessionId}.json`, payload.template);
    remember('Template DM baixado.', { candidates: payload.template.candidateDecisions.length });
  } catch (error) {
    toast(error.message);
  } finally {
    setBusy(false);
  }
}

async function applyDecisions() {
  const payload = buildDecisionPayload();
  if (!payload.segmentDecisions.length && !payload.candidateDecisions.length) {
    toast('Nenhuma decisao local para aplicar.');
    return;
  }
  try {
    setBusy(true);
    const response = await api('/api/review-decisions/apply', {
      method: 'POST',
      body: JSON.stringify({
        sourceSessionId: payload.sourceSessionId,
        runId: payload.aiRunId,
        rebuildPublications: true,
        decisions: payload
      })
    });
    state.review = response.review;
    state.summary = response.summary;
    state.segmentDecisions = {};
    state.candidateDecisions = {};
    persistDraft();
    remember('Decisoes aplicadas e publicacoes regeneradas.', response.summary);
    toast('Decisoes aplicadas no Supabase.');
    render();
  } catch (error) {
    toast(error.message);
  } finally {
    setBusy(false);
  }
}

window.state = state;
window.render = render;
window.loadSession = loadSession;
window.loadJobs = loadJobs;
window.loadCraigMap = loadCraigMap;
window.selectSegment = selectSegment;
window.quickSegmentDecision = quickSegmentDecision;
window.saveSegmentDecision = saveSegmentDecision;
window.setCandidateDecision = setCandidateDecision;
window.loadSegmentAudio = loadSegmentAudio;
window.createSessionFromForm = createSessionFromForm;
window.updateSessionFromForm = updateSessionFromForm;
window.uploadCraigFromForm = uploadCraigFromForm;
window.saveCraigTrack = saveCraigTrack;
window.initAuth = initAuth;
window.loadAuthProfile = loadAuthProfile;
window.signInProvider = signInProvider;
window.signInDiscord = signInDiscord;
window.signInGoogle = signInGoogle;
window.signOutAuth = signOutAuth;
window.signOutGoogle = signOutAuth;
window.confirmClearDraft = confirmClearDraft;

boot();
