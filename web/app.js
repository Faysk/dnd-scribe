const DEFAULT_RUN = 'classify_candidates_v2_gpt-4o';
const CRAIG_UPLOAD_POLICY = {
  sessionRetainedTargetBytes: 250 * 1024 * 1024,
  uploadZipWarningBytes: 1200 * 1024 * 1024,
  maxCraigZipBytes: 2 * 1024 * 1024 * 1024
};
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
  roll20Type: 'all',
  roll20Query: '',
  selectedSegmentId: null,
  segmentDecisions: {},
  candidateDecisions: {},
  busy: false,
  loadingSession: false,
  log: [],
  ingest: {
    busy: false,
    phase: null,
    progress: null,
    error: null,
    result: null
  },
  timeline: {
    sourceSessionId: null,
    loading: false,
    error: null,
    data: null,
    selectedItemId: null,
    filter: 'all',
    query: '',
    zoom: 1,
    discord: {
      busy: false,
      error: null,
      result: null,
      limit: 50,
      maxPages: 6,
      syncMode: 'page',
      channel: 'dnd',
      cursorMode: 'latest',
      cursorMessageId: '',
      includeBeforeStart: false,
      includeAfterEnd: false
    }
  },
  jobs: [],
  jobsPolling: false,
  pipelineControl: null,
  pipelineControlLoading: false,
  pipelineControlError: null,
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
    rbac: null,
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

function fmtBytes(bytes = 0) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function recordingIdFromCraigName(fileName = '') {
  const match = String(fileName || '').match(/^craig-([a-zA-Z0-9]+)-/);
  return match ? match[1] : '';
}

function craigUploadSizeAssessment(sizeBytes = 0) {
  const size = Number(sizeBytes || 0);
  if (!Number.isFinite(size) || size <= 0) return null;
  if (size > CRAIG_UPLOAD_POLICY.maxCraigZipBytes) {
    return {
      level: 'critical',
      tone: 'red',
      title: 'ZIP acima do limite operacional',
      detail: `Arquivo tem ${fmtBytes(size)}; limite atual ${fmtBytes(CRAIG_UPLOAD_POLICY.maxCraigZipBytes)}. Divida ou compacte antes de enviar.`
    };
  }
  if (size >= CRAIG_UPLOAD_POLICY.uploadZipWarningBytes) {
    return {
      level: 'attention',
      tone: 'orange',
      title: 'ZIP grande para R2',
      detail: `Arquivo tem ${fmtBytes(size)}. A esteira deve extrair, compactar e liberar raw depois para nao acumular storage.`
    };
  }
  if (size >= CRAIG_UPLOAD_POLICY.sessionRetainedTargetBytes) {
    return {
      level: 'attention',
      tone: 'gold',
      title: 'Acima da meta retida por sessao',
      detail: `Arquivo tem ${fmtBytes(size)}; meta de acervo final e ${fmtBytes(CRAIG_UPLOAD_POLICY.sessionRetainedTargetBytes)} por sessao apos compactacao/limpeza.`
    };
  }
  return {
    level: 'ok',
    tone: 'green',
    title: 'Tamanho dentro da meta inicial',
    detail: `Arquivo tem ${fmtBytes(size)}. Ainda assim, raw ZIP deve ser tratado como temporario apos processamento.`
  };
}

function renderCraigUploadPreflight(fileLike = null) {
  const assessment = craigUploadSizeAssessment(fileLike?.size || fileLike?.sizeBytes || 0);
  if (!assessment) return '';
  return `
    <div class="upload-size-notice ${assessment.level}">
      <div>
        <strong>${escapeHtml(assessment.title)}</strong>
        <small>${escapeHtml(assessment.detail)}</small>
      </div>
      ${badge(assessment.level === 'ok' ? 'ok' : 'confirmar', assessment.tone)}
    </div>
  `;
}

function updateCraigUploadPreflight(fileLike = null) {
  const target = document.getElementById('uploadSizeNotice');
  if (target) target.innerHTML = renderCraigUploadPreflight(fileLike);
}

function dateTimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function localDateTimeToIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function fmtDateTime(value) {
  if (!value) return 'sem ancora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'data invalida';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function setDateTimeNow(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.value = dateTimeLocalValue(new Date().toISOString());
}

function clearDateTime(inputId) {
  const input = document.getElementById(inputId);
  if (input) input.value = '';
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

function setDocumentLocked(locked) {
  document.body.classList.toggle('auth-locked', locked);
  const shell = document.getElementById('appShell');
  if (shell) shell.setAttribute('aria-hidden', locked ? 'true' : 'false');
}

function siteGateFrame(label, title, body, actions = '', footer = '') {
  return [
    '<div class="site-gate-card">',
    '<div class="site-gate-brand">',
    '<div class="brand-mark">d20</div>',
    '<div><span class="label">' + escapeHtml(label) + '</span><h1>' + escapeHtml(title) + '</h1></div>',
    '</div>',
    '<p>' + escapeHtml(body) + '</p>',
    actions,
    footer ? '<small>' + escapeHtml(footer) + '</small>' : '',
    '</div>'
  ].join('');
}

function renderSiteGate() {
  const gate = document.getElementById('siteGate');
  if (!gate) return;
  const locked = !state.auth.ready || !state.auth.user;
  setDocumentLocked(locked);
  if (!locked) {
    gate.innerHTML = '';
    return;
  }
  if (!state.auth.ready) {
    gate.innerHTML = siteGateFrame('DnD Scribe', 'Entrada da mesa', 'Conectando Discord e Google com o Supabase Auth.', '<div class="loader-line"></div>');
    return;
  }
  if (state.auth.error) {
    gate.innerHTML = siteGateFrame('Acesso fechado', 'Login indisponivel', state.auth.error, '<div class="site-gate-actions"><button class="primary" onclick="initAuth()">Tentar de novo</button></div>');
    return;
  }
  gate.innerHTML = siteGateFrame(
    'Acesso fechado',
    'Entrada da mesa',
    'Entre para acessar sessoes, notas, Roll20, audio e revisoes. Discord e o login preferencial; Google fica como alternativa.',
    '<div class="site-gate-actions"><button class="primary discord-login" onclick="signInDiscord()">Entrar com Discord</button><button onclick="signInGoogle()">Entrar com Google</button></div>',
    'Depois do login, o DM controla o vinculo e as permissoes da campanha.'
  );
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

window.api = api;

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
      state.auth.ready = true;
      state.auth.error = 'Config publica do Supabase ausente.';
      renderSiteGate();
      renderAuthPanel();
      return;
    }
    if (!window.supabase?.createClient) {
      state.auth.ready = true;
      state.auth.error = 'Cliente Supabase nao carregou no navegador.';
      renderSiteGate();
      renderAuthPanel();
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
      renderSiteGate();
      renderAuthPanel();
      await loadAuthProfile(session);
      if (canReadCampaign()) await loadCampaignData();
      else {
        resetCampaignData();
        render();
      }
    });
    state.auth.ready = true;
    renderSiteGate();
    renderAuthPanel();
    await loadAuthProfile(data?.session || null);
  } catch (error) {
    state.auth.ready = true;
    state.auth.error = error.message;
    renderSiteGate();
    renderAuthPanel();
  }
}

function canReadCampaign() {
  return Boolean(state.auth.capabilities?.canReadCampaign);
}

function canManageCampaign() {
  return Boolean(state.auth.capabilities?.canManageCampaign);
}

function canManageAccess() {
  return Boolean(state.auth.capabilities?.canManageAccess);
}

function canViewMonitoring() {
  return Boolean(state.auth.capabilities?.canViewMonitoring);
}

function canReviewRoll20Events() {
  return ['owner', 'master', 'reviewer'].includes(state.auth.campaignRole || '');
}

function canSyncDiscordTimeline() {
  return ['owner', 'master', 'reviewer'].includes(state.auth.campaignRole || '');
}

function resetCampaignData() {
  state.sessions = [];
  state.selectedSourceSessionId = null;
  state.review = null;
  state.summary = null;
  state.timeline = {
    sourceSessionId: null,
    loading: false,
    error: null,
    data: null,
    selectedItemId: null,
    filter: 'all',
    query: '',
    zoom: 1,
    discord: {
      busy: false,
      error: null,
      result: null,
      limit: 50,
      channel: 'dnd',
      includeBeforeStart: false
    }
  };
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
  state.auth.rbac = null;
  state.auth.capabilities = null;
  state.auth.profileError = null;
  if (!state.auth.user || !state.auth.client) {
    state.auth.profileLoading = false;
    renderSiteGate();
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
    state.auth.rbac = payload.rbac || null;
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

function technicalRoleBadges() {
  const assignments = state.auth.rbac?.assignments || [];
  return assignments
    .filter(item => item.plane === 'technical' || item.roleSlug?.startsWith('platform_') || item.roleSlug === 'security_admin' || item.roleSlug === 'billing_observer')
    .slice(0, 3)
    .map(item => badge(item.roleName || item.roleSlug, 'blue'))
    .join('');
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

function sessionTimeRange(session = {}) {
  const start = session.startedAt ? fmtDateTime(session.startedAt) : 'sem inicio';
  const end = session.endedAt ? fmtDateTime(session.endedAt) : 'sem fim';
  return `${start} -> ${end}`;
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
  const techBadges = technicalRoleBadges();
  if (!state.auth.campaignRole) {
    panel.innerHTML = `
      <span class="label">Acesso</span>
      <strong>${escapeHtml(profileName)}</strong>
      <small>${escapeHtml(profile ? (profileDetail || 'Perfil tecnico vinculado.') : 'Login conectado; vinculo da mesa pendente.')}</small>
      <div class="badges">
        ${badge(authProviderLabel(provider), provider === 'discord' ? 'violet' : 'green')}
        ${techBadges || badge('Aguardando DM', 'orange')}
      </div>
      ${state.auth.profileLoading ? '<small>Atualizando perfil da mesa...</small>' : ''}
      ${state.auth.profileError ? `<small>${escapeHtml(state.auth.profileError)}</small>` : ''}
      <div class="auth-actions">
        <button class="primary" onclick="state.tab='access'; render();">${techBadges ? 'Abrir acesso' : 'Solicitar acesso'}</button>
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
      ${techBadges}
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
    if (typeof window.refreshPipelineControl === 'function') {
      await window.refreshPipelineControl(false);
    }
    render();
    const hasActive = state.jobs.some(job => ['running', 'retrying'].includes(job.status));
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
    state.pipelineControl = null;
    state.pipelineControlError = null;
    render();
    const payload = await api(`/api/session?sourceSessionId=${encodeURIComponent(sourceSessionId)}&runId=${encodeURIComponent(DEFAULT_RUN)}`);
    state.review = payload.review;
    state.summary = payload.summary || null;
    state.selectedSegmentId = state.review?.segments?.[0]?.id || null;
    state.segmentDecisions = {};
    state.candidateDecisions = {};
    state.timeline = {
      sourceSessionId,
      loading: false,
      error: null,
      data: null,
      selectedItemId: null,
      filter: 'all',
      query: '',
      zoom: 1,
      discord: {
        busy: false,
        error: null,
        result: null,
        limit: 50,
        channel: 'dnd',
        cursorMode: 'latest',
        cursorMessageId: '',
        includeBeforeStart: false
      }
    };
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
    if (typeof window.refreshPipelineControl === 'function') {
      await window.refreshPipelineControl(false);
    }
    render();
  } catch (error) {
    toast(error.message);
  } finally {
    state.loadingSession = false;
    setBusy(false);
    render();
  }
}

async function loadTimelineData(force = false) {
  const sourceSessionId = state.selectedSourceSessionId;
  if (!sourceSessionId || state.timeline.loading) return;
  if (!force && state.timeline.data && state.timeline.sourceSessionId === sourceSessionId) return;
  state.timeline = {
    ...state.timeline,
    sourceSessionId,
    loading: true,
    error: null
  };
  render();
  try {
    const payload = await api(`/api/timeline?sourceSessionId=${encodeURIComponent(sourceSessionId)}`);
    const firstItem = (payload.items || [])[0] || null;
    state.timeline = {
      ...state.timeline,
      sourceSessionId,
      loading: false,
      error: null,
      data: payload,
      selectedItemId: state.timeline.selectedItemId || firstItem?.id || null
    };
  } catch (error) {
    state.timeline = {
      ...state.timeline,
      loading: false,
      error: error.message
    };
  }
  render();
}

function renderSessions() {
  $('#sessionList').innerHTML = state.sessions.map(session => `
    <button class="session-button ${session.sourceSessionId === state.selectedSourceSessionId ? 'active' : ''}" onclick="loadSession('${escapeHtml(session.sourceSessionId)}')">
      <strong>${escapeHtml(session.title || session.sourceSessionId)}</strong>
      <small>${escapeHtml(session.sourceSessionId)} • ${escapeHtml(session.status || '-')}</small>
      <div class="session-meta">
        ${badge(`${session.segments || 0} seg`, 'blue')}
        ${badge(`${session.aiCandidates || 0} IA`, 'violet')}
        ${badge(`${session.roll20Events || 0} Roll20`, 'green')}
        ${badge(`${session.reviewDecisions || 0} decisoes`, 'gold')}
      </div>
    </button>
  `).join('') || `<div class="empty">Nenhuma sessao encontrada.</div>`;
}

function render() {
  renderSiteGate();
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
  if (!state.review && !['sessions', 'upload', 'ops'].includes(state.tab)) {
    $('#view').innerHTML = loadingView();
    return;
  }
  if (state.loadingSession) {
    $('#view').innerHTML = loadingView('Atualizando sessao real do Supabase...');
    return;
  }
  const routes = {
    sessions: renderSessionsManager,
    upload: renderUploadView,
    review: renderReview,
    timeline: renderTimeline,
    candidates: renderCandidates,
    roll20: renderRoll20Review,
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
    ${metric(review?.roll20Events?.length || 0, 'eventos Roll20')}
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
          <label><span class="label">Inicio real</span><input id="newSessionStartedAt" type="datetime-local" /></label>
          <label><span class="label">Fim real</span><input id="newSessionEndedAt" type="datetime-local" /></label>
          <div class="actions">
            <button onclick="setDateTimeNow('newSessionStartedAt')">Usar agora</button>
            <button onclick="clearDateTime('newSessionStartedAt')">Limpar inicio</button>
            <button onclick="clearDateTime('newSessionEndedAt')">Limpar fim</button>
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

function renderUploadView() {
  const sourceSessionId = ingestSourceSessionId();
  const session = state.sessions.find(item => item.sourceSessionId === sourceSessionId) || selectedSession();
  return `
    <section class="upload-page">
      <div class="upload-page-head">
        <div>
          <span class="label">Upload Craig</span>
          <h2>Nova sessao gravada</h2>
          <p>Envio direto para R2, manifest e extracao preparados para producao.</p>
        </div>
        <div class="badges">
          ${badge('Discord/Google auth', 'green')}
          ${badge('OpenAI sob controle', 'blue')}
          ${badge('sessao por inicio local', 'gold')}
        </div>
      </div>
      <div class="upload-workspace">
        <section class="panel upload-main-panel">
          <div class="panel-head">
            <h2>Preparar upload</h2>
            ${badge('prod upload', 'green')}
          </div>
          <div class="panel-body">
            ${renderCraigIngestPanel()}
          </div>
        </section>
        <aside class="upload-side-panel">
          ${renderUploadSessionCard(session)}
          ${renderUploadJobsCard()}
          ${renderUploadMapCard()}
        </aside>
      </div>
    </section>
  `;
}

function renderUploadSessionCard(session) {
  const sourceSessionId = ingestSourceSessionId();
  if (!session && !sourceSessionId) {
    return `
      <section class="panel">
        <div class="panel-head"><h2>Sessao</h2>${badge('nova', 'blue')}</div>
        <div class="panel-body">
          <div class="empty">A sessao sera criada depois que a URL R2 for planejada. O manifest Craig ancora data, inicio e fim.</div>
        </div>
      </section>
    `;
  }
  const target = session || { sourceSessionId };
  return `
    <section class="panel">
      <div class="panel-head"><h2>Sessao</h2>${badge(sessionStatusLabel(target.status || 'uploaded'), target.status === 'archived' ? 'orange' : 'green')}</div>
      <div class="panel-body upload-summary-grid">
        <div><span class="label">Source</span><strong>${escapeHtml(target.sourceSessionId || sourceSessionId)}</strong></div>
        <div><span class="label">Data logica</span><strong>${escapeHtml(target.sessionDate || 'aguardando manifest')}</strong></div>
        <div><span class="label">Inicio</span><strong>${escapeHtml(fmtDateTime(target.startedAt))}</strong></div>
        <div><span class="label">Fim</span><strong>${escapeHtml(fmtDateTime(target.endedAt))}</strong></div>
        <div><span class="label">Arquivos</span><strong>${escapeHtml(target.recordingFiles || 0)}</strong></div>
        <div><span class="label">Duracao</span><strong>${escapeHtml(target.durationMs ? fmtDuration(target.durationMs) : 'pendente')}</strong></div>
      </div>
      ${session ? `
        <div class="actions">
          ${session.status === 'archived'
            ? `<button onclick="setSessionArchived(false)">Restaurar</button>`
            : `<button class="danger" onclick="setSessionArchived(true)">Arquivar</button>`}
          <button onclick="state.tab='sessions'; render();">Editar</button>
        </div>
      ` : ''}
    </section>
  `;
}

function uploadRelevantJobs() {
  const sourceSessionId = ingestSourceSessionId();
  const uploadTypes = new Set(['craig_direct_upload', 'cloud_ingest_craig', 'cloud_extract_craig_tracks', 'cloud_plan_audio_chunks', 'cloud_detect_speech_slices']);
  return (state.jobs || [])
    .filter(job => uploadTypes.has(job.type))
    .filter(job => !sourceSessionId || job.session?.sourceSessionId === sourceSessionId)
    .slice(0, 8);
}

function renderUploadJobsCard() {
  const jobs = uploadRelevantJobs();
  const sourceSessionId = ingestSourceSessionId();
  const runnable = jobs.find(job => ['cloud_ingest_craig', 'cloud_extract_craig_tracks', 'cloud_plan_audio_chunks'].includes(job.type) && ['queued', 'retrying'].includes(job.status));
  const blocked = jobs.find(job => job.type === 'cloud_detect_speech_slices' && ['queued', 'retrying', 'running', 'failed'].includes(job.status));
  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Pipeline</h2>
        <button onclick="loadJobs(true)">Atualizar</button>
      </div>
        <div class="panel-body">
        ${window.renderPipelineControl ? window.renderPipelineControl('upload') : ''}
        <div class="pipeline-control upload-pipeline-control">
          <div>
            <span class="label">Continuacao zero-cost</span>
            <strong>${escapeHtml(runnable ? `Proxima: ${runnable.type}` : blocked ? 'Aguardando worker de fala' : 'Sem etapa pendente')}</strong>
            <small>${escapeHtml(sourceSessionId || 'Selecione ou envie um ZIP Craig para acompanhar a esteira.')}</small>
          </div>
          <div class="job-actions">
            <label class="inline-job-limit"><span class="label">Faixas/vez</span><input id="pipelineMaxTracks" type="number" min="1" max="3" value="1" /></label>
            <button onclick="continueUploadPipeline(true)" ${sourceSessionId ? '' : 'disabled'}>Simular</button>
            <button class="primary" onclick="continueUploadPipeline(false)" ${runnable ? '' : 'disabled'}>Continuar</button>
          </div>
        </div>
        ${jobs.length ? `<div class="job-list">${jobs.map(renderUploadJobRow).join('')}</div>` : `<div class="empty">Sem jobs para esta sessao ainda.</div>`}
      </div>
    </section>
  `;
}

function renderUploadJobRow(job) {
  const canRun = ['cloud_ingest_craig', 'cloud_extract_craig_tracks', 'cloud_plan_audio_chunks'].includes(job.type);
  const canExecute = canRun && ['queued', 'retrying'].includes(job.status);
  const canDryRun = canRun && ['queued', 'retrying', 'running'].includes(job.status);
  const canRetry = ['failed', 'cancelled'].includes(job.status);
  const workerStatus = job.output?.workerStatus || job.output?.uploadStatus || '';
  const stepStatus = job.stepSummary?.status || '';
  const stepRows = window.renderJobSteps ? window.renderJobSteps(job) : '';
  const limit = job.type === 'cloud_extract_craig_tracks'
    ? `<label class="inline-job-limit"><span class="label">Faixas</span><input id="jobLimit_${escapeHtml(job.id)}" type="number" min="1" max="3" value="1" /></label>`
    : job.type === 'cloud_plan_audio_chunks'
      ? `<label class="inline-job-limit"><span class="label">Chunk s</span><input id="jobChunkSeconds_${escapeHtml(job.id)}" type="number" min="60" max="1800" step="60" value="600" /></label>`
    : '';
  const actionText = {
    cloud_ingest_craig: 'Ler manifest',
    cloud_extract_craig_tracks: 'Extrair',
    cloud_plan_audio_chunks: 'Planejar chunks'
  }[job.type] || 'Executar';
  return `
    <div class="job-row upload-job-row">
      <div class="row between">
        <div>
          <strong>${escapeHtml(job.type || 'job')}</strong>
          <small>${escapeHtml(job.createdAt || '')}</small>
        </div>
        <div class="badges">
          ${badge(job.status || 'unknown', job.status === 'failed' ? 'red' : job.status === 'succeeded' ? 'green' : job.status === 'running' ? 'orange' : 'gold')}
          ${stepStatus ? badge(`steps: ${stepStatus}`, stepStatus === 'failed' ? 'red' : stepStatus === 'succeeded' ? 'green' : stepStatus === 'running' || stepStatus === 'retrying' ? 'orange' : 'gold') : ''}
          ${workerStatus ? badge(workerStatus, 'blue') : ''}
          ${badge(String(job.id || '').slice(0, 8), 'gold')}
        </div>
      </div>
      ${stepRows}
      ${canRun ? `<div class="job-actions">
        ${limit}
        <button onclick="runCloudJob('${escapeHtml(job.id)}', '${escapeHtml(job.type)}', true)" ${canDryRun ? '' : 'disabled'}>Simular</button>
        <button class="primary" onclick="runCloudJob('${escapeHtml(job.id)}', '${escapeHtml(job.type)}', false)" ${canExecute ? '' : 'disabled'}>${escapeHtml(actionText)}</button>
        ${canRetry ? `<button onclick="retryCloudJob('${escapeHtml(job.id)}')">Tentar novamente</button>` : ''}
      </div>` : ''}
      ${!canRun && canRetry ? `<div class="job-actions"><button class="primary" onclick="retryCloudJob('${escapeHtml(job.id)}')">Tentar novamente</button></div>` : ''}
      ${job.error ? `<p>${escapeHtml(String(job.error).slice(0, 220))}</p>` : ''}
    </div>
  `;
}

function renderUploadMapCard() {
  const tracks = state.craigMap?.tracks || {};
  const values = Object.values(tracks);
  const known = values.filter(item => item.status === 'known').length;
  const unknown = Math.max(0, values.length - known);
  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Mapa Craig</h2>
        <button onclick="loadCraigMap()">Atualizar</button>
      </div>
      <div class="panel-body">
        ${state.craigMapError ? `<div class="empty">${escapeHtml(state.craigMapError)}</div>` : `
          <div class="upload-summary-grid">
            <div><span class="label">Tracks</span><strong>${escapeHtml(values.length)}</strong></div>
            <div><span class="label">Conhecidas</span><strong>${escapeHtml(known)}</strong></div>
            <div><span class="label">Revisar</span><strong>${escapeHtml(unknown)}</strong></div>
          </div>
          <div class="actions"><button onclick="state.tab='sessions'; render();">Abrir mapa completo</button></div>
        `}
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
  const upload = state.ingest.result?.upload || state.ingest.planned?.upload || null;
  const fileName = state.ingest.file?.name || upload?.originalFilename || '';
  const recordingId = recordingIdFromCraigName(fileName);
  return `
    <div class="detail-grid">
      <div class="upload-brief">
        <div>
          <span class="label">Fluxo Craig</span>
          <strong>ZIP direto para R2, jobs em producao</strong>
          <small>Data logica vem do inicio da gravacao em Europe/London; se acabar depois da meia-noite, continua sendo a mesma sessao.</small>
        </div>
        <div class="badges">
          ${badge('OpenAI $0 nesta etapa', 'green')}
          ${badge('R2 direto', 'blue')}
          ${badge(recordingId ? `Craig ${recordingId}` : 'novo ZIP', 'gold')}
        </div>
      </div>
      <label><span class="label">Sessao alvo</span>
        <select id="ingestSessionId">
          <option value="">Criar nova sessao pelo ZIP (recomendado)</option>
          ${state.sessions.map(session => `<option value="${escapeHtml(session.sourceSessionId)}">${escapeHtml(session.title || session.sourceSessionId)}</option>`).join('')}
        </select>
        <small>Use uma sessao existente apenas para corrigir/reprocessar um upload ja conhecido.</small>
      </label>
      <div class="upload-form-section">
        <div class="row between">
          <div>
            <span class="label">Arquivo</span>
            <strong>ZIP Craig</strong>
          </div>
          ${badge(fileName ? fmtBytes(state.ingest.file?.size || upload?.sizeBytes || 0) : 'aguardando arquivo', fileName ? 'blue' : 'gold')}
        </div>
        <input id="craigZipFile" type="file" accept=".zip,application/zip" onchange="rememberCraigFileSelection(this)" />
        <div id="uploadFilePreview" class="upload-file-preview">
          ${fileName ? `${escapeHtml(fileName)}${recordingId ? ` • Craig ${escapeHtml(recordingId)}` : ''}` : 'Nenhum arquivo escolhido.'}
        </div>
        <div id="uploadSizeNotice">${renderCraigUploadPreflight(state.ingest.file || upload)}</div>
      </div>
      <div class="upload-form-section">
        <span class="label">Metadados opcionais</span>
        <div class="field-grid">
          <label><span class="label">Titulo</span><input id="ingestSessionTitle" placeholder="vazio = Sessao Craig pelo ID do ZIP" /></label>
          <label><span class="label">Data manual</span><input id="ingestSessionDate" type="date" /></label>
          <label><span class="label">Arco</span><input id="ingestSessionArc" placeholder="Arco atual" /></label>
          <label><span class="label">Resumo curto</span><input id="ingestSessionSummary" placeholder="Opcional para catalogo" /></label>
        </div>
      </div>
      <div class="upload-form-section">
        <span class="label">Processamento</span>
        <div class="field-grid">
          <label><span class="label">Chunk segundos</span><input id="ingestChunkSeconds" type="number" min="60" step="30" value="600" /></label>
          <label><span class="label">Amostra segundos</span><input id="ingestSampleSeconds" type="number" min="0" step="30" placeholder="vazio" /></label>
        </div>
        <label class="check-row"><input id="ingestSkipChunks" type="checkbox" /> <span>Somente manifest quando o worker cloud estiver ativo</span></label>
      </div>
      ${renderIngestChecklist()}
      <div class="actions">
        <button class="primary" onclick="uploadCraigFromForm()" ${state.ingest.busy ? 'disabled' : ''}>Enviar ZIP para producao</button>
        <button onclick="continueUploadPipeline(false)" ${ingestSourceSessionId() ? '' : 'disabled'}>Continuar pipeline</button>
        <button onclick="loadJobs(true)">Atualizar jobs</button>
      </div>
      ${state.ingest.busy ? renderIngestProgress() : ''}
      ${state.ingest.error ? `<div class="empty">${escapeHtml(state.ingest.error)}</div>` : ''}
      ${state.ingest.result ? renderIngestResult(state.ingest.result) : ''}
    </div>
  `;
}

function ingestSourceSessionId() {
  return state.ingest.planned?.session?.sourceSessionId
    || state.ingest.result?.session?.sourceSessionId
    || state.ingest.result?.sourceSessionId
    || state.ingest.lastJobResult?.sourceSessionId
    || state.selectedSourceSessionId
    || '';
}

function ingestJob(type) {
  const sourceSessionId = ingestSourceSessionId();
  return (state.jobs || []).find(job => {
    const jobSource = job.session?.sourceSessionId || job.sourceSessionId || '';
    return job.type === type && (!sourceSessionId || jobSource === sourceSessionId);
  }) || null;
}

function jobStepState(job, readyLabel = 'pronto') {
  if (!job) return { status: 'waiting', label: 'aguardando' };
  if (job.status === 'succeeded') return { status: 'done', label: 'ok' };
  if (job.status === 'failed') return { status: 'error', label: 'falhou' };
  if (job.status === 'running') return { status: 'active', label: 'rodando' };
  return { status: 'ready', label: readyLabel };
}

function sessionWindowText(windowData) {
  const start = fmtDateTime(windowData.started_at);
  const end = windowData.ended_at ? fmtDateTime(windowData.ended_at) : 'fim pendente';
  const date = windowData.logical_date || 'data pendente';
  const duration = windowData.duration_ms ? fmtDuration(windowData.duration_ms) : 'duracao pendente';
  const midnight = windowData.crosses_midnight ? ' atravessa meia-noite.' : '';
  return `${date} | ${start} -> ${end} | ${duration}.${midnight}`;
}

function ingestStepRows() {
  const phase = state.ingest.phase;
  const result = state.ingest.result || null;
  const planned = state.ingest.planned || null;
  const lastJob = state.ingest.lastJobResult || null;
  const manifestJob = ingestJob('cloud_ingest_craig');
  const extractJob = ingestJob('cloud_extract_craig_tracks');
  const chunkJob = ingestJob('cloud_plan_audio_chunks');
  const manifestResult = lastJob?.mode === 'cloud_manifest_only' ? lastJob : null;
  const extractResult = lastJob?.mode === 'cloud_extract_craig_tracks' ? lastJob : null;
  const sessionWindow = manifestResult?.summary?.sessionWindow || manifestResult?.manifest?.sessionWindow || null;
  const manifestState = manifestResult
    ? { status: manifestResult.dryRun ? 'ready' : 'done', label: manifestResult.dryRun ? 'simulado' : 'ok' }
    : jobStepState(manifestJob, result?.job?.type === 'cloud_ingest_craig' ? 'pronto' : 'aguardando');
  const extractState = extractResult
    ? { status: extractResult.summary?.remainingTracks > 0 ? 'active' : 'done', label: extractResult.summary?.remainingTracks > 0 ? 'parcial' : 'ok' }
    : jobStepState(extractJob, manifestState.status === 'done' ? 'pronto' : 'aguardando');
  const chunkState = jobStepState(chunkJob, extractState.status === 'done' ? 'pronto' : 'aguardando');
  return [
    {
      title: 'Sessao e metadados',
      detail: planned?.session?.sourceSessionId || result?.session?.sourceSessionId || 'Nova sessao sera inferida pelo nome do ZIP.',
      state: phase === 'planning' ? { status: 'active', label: 'criando' } : (planned || result ? { status: 'done', label: 'ok' } : { status: 'waiting', label: 'aguardando' })
    },
    {
      title: 'Upload R2',
      detail: state.ingest.file ? `${state.ingest.file.name} - ${fmtBytes(state.ingest.file.size)}` : 'Arquivo vai direto do navegador para o bucket.',
      state: phase === 'uploading' ? { status: 'active', label: `${Math.round(Number(state.ingest.progress || 0))}%` } : (['confirming', 'done'].includes(phase) || result ? { status: 'done', label: 'ok' } : { status: 'waiting', label: 'aguardando' })
    },
    {
      title: 'Confirmar banco e fila',
      detail: result?.job?.id ? `Job ${result.job.type} ${String(result.job.id).slice(0, 8)}` : 'Confirma o arquivo e cria o primeiro job cloud.',
      state: phase === 'confirming' ? { status: 'active', label: 'salvando' } : (result?.job ? { status: 'done', label: 'ok' } : { status: 'waiting', label: 'aguardando' })
    },
    {
      title: 'Manifest Craig',
      detail: sessionWindow ? sessionWindowText(sessionWindow) : 'Le info.txt, participantes, faixas e duracao FLAC quando disponivel.',
      state: manifestState
    },
    {
      title: 'Extrair faixas',
      detail: extractResult?.summary ? `${extractResult.summary.extractedThisRun || 0} extraidas agora, ${extractResult.summary.remainingTracks || 0} restantes.` : 'Copia cada FLAC do ZIP para objeto R2 individual.',
      state: extractState
    },
    {
      title: 'Chunks e OpenAI',
      detail: 'So entra depois de faixas extraidas; speech slicing reduz minutos pagos antes da transcricao.',
      state: chunkState.status === 'done' ? chunkState : (chunkState.status === 'ready' ? chunkState : { status: 'waiting', label: 'depois' })
    }
  ];
}

function renderIngestChecklist() {
  return `
    <div class="upload-step-list">
      ${ingestStepRows().map(step => `
        <div class="upload-step ${step.state.status}">
          <span class="upload-step-dot"></span>
          <div>
            <strong>${escapeHtml(step.title)}</strong>
            <small>${escapeHtml(step.detail)}</small>
          </div>
          ${badge(step.state.label, step.state.status === 'done' ? 'green' : step.state.status === 'error' ? 'red' : step.state.status === 'active' ? 'orange' : step.state.status === 'ready' ? 'blue' : '')}
        </div>
      `).join('')}
    </div>
  `;
}

function ingestPhaseLabel(phase) {
  return {
    planning: 'Criando URL segura no R2...',
    uploading: 'Enviando ZIP direto para o R2...',
    confirming: 'Confirmando upload e criando job cloud...',
    'pipeline-dry-run': 'Simulando proxima etapa do pipeline...',
    'pipeline-running': 'Continuando pipeline Craig em producao...',
    done: 'Upload confirmado.'
  }[phase] || 'Preparando upload Craig...';
}

function renderIngestProgress() {
  const progress = Number(state.ingest.progress);
  const hasProgress = Number.isFinite(progress);
  const width = Math.min(100, Math.max(0, hasProgress ? progress : 15));
  return `
    <div class="loading-panel ingest-progress">
      <div class="loader-line"></div>
      <div class="row between">
        <h2>${escapeHtml(ingestPhaseLabel(state.ingest.phase))}</h2>
        ${hasProgress ? badge(`${Math.round(width)}%`, 'blue') : badge('preparando', 'gold')}
      </div>
      <div class="progress-bar"><span style="width:${width}%"></span></div>
      <p>${escapeHtml(state.ingest.file ? `${state.ingest.file.name} - ${fmtBytes(state.ingest.file.size)}` : 'O arquivo grande nao passa pela Vercel Function; o navegador envia direto para o bucket R2.')}</p>
    </div>
  `;
}

function renderIngestResult(result) {
  const lastJob = state.ingest.lastJobResult || null;
  if (lastJob?.mode === 'cloud_manifest_only') {
    const summary = lastJob.summary || {};
    const sessionWindow = summary.sessionWindow || lastJob.manifest?.sessionWindow || null;
    return `
      <div class="ops-card upload-result-card">
        <span class="label">Manifest Craig</span>
        <div class="badges">
          ${badge(lastJob.dryRun ? 'simulacao' : 'processado', lastJob.dryRun ? 'blue' : 'green')}
          ${badge(`${summary.tracks || 0} tracks`, 'blue')}
          ${badge(`${summary.participants || 0} participantes`, 'green')}
          ${badge('OpenAI $0', 'green')}
        </div>
        ${sessionWindow ? `<div class="empty">${escapeHtml(sessionWindowText(sessionWindow))}</div>` : ''}
        <div class="actions">
          <button onclick="openOperations()">Abrir Operacao</button>
          <button onclick="loadJobs(true)">Atualizar jobs</button>
        </div>
      </div>
    `;
  }
  if (lastJob?.mode === 'cloud_extract_craig_tracks') {
    const summary = lastJob.summary || {};
    return `
      <div class="ops-card upload-result-card">
        <span class="label">Extracao Craig</span>
        <div class="badges">
          ${badge(summary.remainingTracks > 0 ? 'parcial' : 'processado', summary.remainingTracks > 0 ? 'orange' : 'green')}
          ${badge(`${summary.extractedThisRun || 0} agora`, 'blue')}
          ${badge(`${summary.remainingTracks || 0} restantes`, summary.remainingTracks > 0 ? 'orange' : 'green')}
          ${badge('OpenAI $0', 'green')}
        </div>
        <div class="actions">
          <button onclick="openOperations()">Abrir Operacao</button>
          <button onclick="loadJobs(true)">Atualizar jobs</button>
        </div>
      </div>
    `;
  }
  if (result.job) {
    return `
      <div class="ops-card upload-result-card">
        <span class="label">Upload confirmado</span>
        <strong>${escapeHtml(result.upload?.originalFilename || result.job.type)}</strong>
        <div class="badges">
          ${badge(result.job.status, result.job.status === 'failed' ? 'red' : 'blue')}
          ${badge(result.job.id.slice(0, 8), 'gold')}
          ${badge(fmtBytes(result.upload?.sizeBytes || state.ingest.file?.size || 0), 'blue')}
          ${badge('OpenAI $0', 'green')}
        </div>
        ${result.upload ? `<div class="source-detail-grid">
          <div><span class="label">Bucket</span><strong>${escapeHtml(result.upload.storageBucket || '-')}</strong></div>
          <div><span class="label">Sessao</span><strong>${escapeHtml(result.session?.sourceSessionId || state.ingest.planned?.session?.sourceSessionId || '-')}</strong></div>
          <div><span class="label">R2 path</span><strong>${escapeHtml(result.upload.storagePath || '-')}</strong></div>
        </div>` : ''}
        <div class="actions">
          <button onclick="runUploadedCraigJob(true)">Simular job</button>
          <button class="primary" onclick="runUploadedCraigJob(false)">Executar job</button>
          <button onclick="openOperations()">Abrir Operacao</button>
          <button onclick="copyText(state.ingest.result?.upload?.storagePath || '', 'Caminho R2 copiado.')">Copiar caminho R2</button>
        </div>
      </div>
    `;
  }
  const ingest = result.ingest || {};
  return `
    <div class="ops-card upload-result-card">
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

function rememberCraigFileSelection(input) {
  const file = input?.files?.[0] || null;
  const preview = document.getElementById('uploadFilePreview');
  if (!file) {
    state.ingest = { ...state.ingest, file: null };
    if (preview) preview.textContent = 'Nenhum arquivo escolhido.';
    updateCraigUploadPreflight(null);
    return;
  }
  state.ingest = {
    ...state.ingest,
    file: {
      name: file.name,
      size: file.size,
      type: file.type || 'application/zip'
    }
  };
  const recordingId = recordingIdFromCraigName(file.name);
  if (preview) {
    preview.textContent = `${file.name} - ${fmtBytes(file.size)}${recordingId ? ` - Craig ${recordingId}` : ''}`;
  }
  updateCraigUploadPreflight(file);
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
      <label><span class="label">Inicio real da sessao</span><input id="editSessionStartedAt" type="datetime-local" value="${escapeHtml(dateTimeLocalValue(session.startedAt))}" /></label>
      <label><span class="label">Fim real/estimado</span><input id="editSessionEndedAt" type="datetime-local" value="${escapeHtml(dateTimeLocalValue(session.endedAt))}" /></label>
      <div class="actions">
        <button onclick="setDateTimeNow('editSessionStartedAt')">Usar agora</button>
        <button onclick="clearDateTime('editSessionStartedAt')">Limpar inicio</button>
        <button onclick="clearDateTime('editSessionEndedAt')">Limpar fim</button>
      </div>
      <label><span class="label">Resumo curto</span><textarea id="editSessionSummary">${escapeHtml(session.summary || '')}</textarea></label>
      <div class="badges">
        ${badge(session.sourceSystem || 'manual', 'blue')}
        ${badge(`inicio: ${fmtDateTime(session.startedAt)}`, session.startedAt ? 'green' : 'orange')}
        ${badge(`fim: ${fmtDateTime(session.endedAt)}`, session.endedAt ? 'green' : 'orange')}
        ${session.durationMs ? badge(`duracao: ${fmtDuration(session.durationMs)}`, 'blue') : ''}
        ${badge(`${session.segments || 0} segmentos`, 'violet')}
        ${badge(`${session.recordingFiles || 0} arquivos`, 'gold')}
      </div>
      <div class="actions">
        <button class="success" onclick="updateSessionFromForm()">Salvar sessao</button>
        <button onclick="loadSession('${escapeHtml(session.sourceSessionId)}')">Abrir review</button>
        ${session.status === 'archived'
          ? `<button onclick="setSessionArchived(false)">Restaurar</button>`
          : `<button class="danger" onclick="setSessionArchived(true)">Arquivar</button>`}
      </div>
    </div>
  `;
}

function sessionCatalogRow(session) {
  return `
    <button class="session-row ${session.sourceSessionId === state.selectedSourceSessionId ? 'active' : ''}" onclick="loadSession('${escapeHtml(session.sourceSessionId)}')">
      <div>
        <strong>${escapeHtml(session.title || session.sourceSessionId)}</strong>
        <small>${escapeHtml(session.sessionDate || 'sem data')} • ${escapeHtml(sessionTimeRange(session))} • ${escapeHtml(session.sourceSessionId || '')}</small>
      </div>
      <div class="badges">
        ${badge(sessionStatusLabel(session.status), session.status === 'failed' ? 'red' : session.status === 'archived' ? 'orange' : 'blue')}
        ${badge(session.startedAt ? 'ancorada' : 'sem inicio', session.startedAt ? 'green' : 'orange')}
        ${badge(`${session.participants || 0} participantes`, 'green')}
        ${badge(`${session.segments || 0} seg`, 'violet')}
        ${badge(`${session.roll20Events || 0} Roll20`, 'green')}
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
        startedAt: localDateTimeToIso($('#newSessionStartedAt')?.value || ''),
        endedAt: localDateTimeToIso($('#newSessionEndedAt')?.value || ''),
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
        startedAt: localDateTimeToIso($('#editSessionStartedAt')?.value || ''),
        endedAt: localDateTimeToIso($('#editSessionEndedAt')?.value || ''),
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

async function setSessionArchived(archived) {
  const session = selectedSession();
  if (!session) return;
  const nextStatus = archived ? 'archived' : (Number(session.recordingFiles || 0) > 0 ? 'uploaded' : 'planned');
  const action = archived ? 'arquivar' : 'restaurar';
  const ok = window.confirm(`Deseja ${action} a sessao "${session.title || session.sourceSessionId}"? Isso nao apaga arquivos nem historico.`);
  if (!ok) return;
  try {
    setBusy(true);
    const payload = await api('/api/sessions/update', {
      method: 'POST',
      body: JSON.stringify({
        sourceSessionId: session.sourceSessionId,
        title: $('#editSessionTitle')?.value || session.title || session.sourceSessionId,
        sessionDate: $('#editSessionDate')?.value || session.sessionDate || null,
        startedAt: localDateTimeToIso($('#editSessionStartedAt')?.value || '') || session.startedAt || null,
        endedAt: localDateTimeToIso($('#editSessionEndedAt')?.value || '') || session.endedAt || null,
        arc: $('#editSessionArc')?.value || session.arc || '',
        status: nextStatus,
        summary: $('#editSessionSummary')?.value || session.summary || '',
        runId: DEFAULT_RUN
      })
    });
    state.sessions = payload.sessions || state.sessions;
    state.review = null;
    state.summary = null;
    remember(`Sessao ${archived ? 'arquivada' : 'restaurada'}: ${session.sourceSessionId}`);
    toast(archived ? 'Sessao arquivada.' : 'Sessao restaurada.');
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
  const fileInfo = {
    name: file.name,
    size: file.size,
    type: file.type || 'application/zip'
  };
  const sizeAssessment = craigUploadSizeAssessment(file.size);
  if (sizeAssessment?.level === 'critical') {
    toast(sizeAssessment.detail);
    return;
  }
  if (sizeAssessment?.level === 'attention') {
    const okSize = window.confirm(`${sizeAssessment.title}: ${sizeAssessment.detail} Continuar upload mesmo assim?`);
    if (!okSize) return;
  }
  const targetSessionId = $('#ingestSessionId')?.value || '';
  if (targetSessionId) {
    const ok = window.confirm(`Anexar este ZIP Craig na sessao existente "${targetSessionId}"? Para uma nova gravacao, cancele e deixe "Criar nova sessao pelo ZIP".`);
    if (!ok) return;
  }
  state.ingest = { busy: true, phase: 'planning', progress: null, error: null, result: null, planned: null, lastJobResult: null, file: fileInfo };
  setBusy(true);
  render();
  try {
    const planned = await api('/api/uploads/craig-url', {
      method: 'POST',
      body: JSON.stringify({
        sourceSessionId: targetSessionId,
        attachToExisting: Boolean(targetSessionId),
        title: $('#ingestSessionTitle')?.value || '',
        sessionDate: $('#ingestSessionDate')?.value || null,
        arc: $('#ingestSessionArc')?.value || '',
        summary: $('#ingestSessionSummary')?.value || '',
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
    state.ingest = { ...state.ingest, busy: true, phase: 'uploading', progress: 0, error: null, result: null, planned, file: fileInfo };
    render();
    const uploadResponse = await uploadFileToSignedUrl(
      planned.upload.signedUrl,
      file,
      planned.upload.contentType || file.type || 'application/zip'
    );
    if (!uploadResponse.ok) {
      throw new Error(`Upload R2 falhou (${uploadResponse.status}). Verifique CORS do bucket e tente novamente.`);
    }
    state.ingest = { ...state.ingest, busy: true, phase: 'confirming', progress: 100, error: null, result: null, planned, file: fileInfo };
    render();
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
    state.ingest = { ...state.ingest, busy: false, phase: 'done', progress: 100, error: null, result: payload, planned, file: fileInfo };
    if (payload.sessions) state.sessions = payload.sessions;
    if (payload.jobs) state.jobs = payload.jobs;
    state.selectedSourceSessionId = planned.session.sourceSessionId || state.selectedSourceSessionId;
    if (payload.job) {
      state.jobs = [payload.job, ...state.jobs.filter(job => job.id !== payload.job.id)];
      remember(`Upload Craig confirmado: ${payload.upload?.storagePath || file.name}`);
      toast('ZIP salvo no R2. Job de ingestao cloud criado.');
      await loadJobs(true);
      if (typeof window.continuePipeline === 'function') {
        const chunkSeconds = Number($('#ingestChunkSeconds')?.value || 600);
        await window.continuePipeline(planned.session.sourceSessionId, {
          auto: true,
          maxRuns: 12,
          maxTracks: 1,
          chunkSeconds
        });
      }
    } else {
      remember(`Upload Craig: ${file.name}`);
      toast('ZIP Craig enviado.');
    }
  } catch (error) {
    state.ingest = { ...state.ingest, busy: false, phase: null, progress: null, error: error.message, result: null, file: fileInfo };
    toast(error.message);
  } finally {
    setBusy(false);
    state.tab = 'upload';
    render();
  }
}

function uploadFileToSignedUrl(url, file, contentType) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url, true);
    request.setRequestHeader('Content-Type', contentType || 'application/zip');
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      state.ingest = {
        ...state.ingest,
        busy: true,
        phase: 'uploading',
        progress: Math.round((event.loaded / event.total) * 100)
      };
      render();
    };
    request.onload = () => {
      resolve({
        ok: request.status >= 200 && request.status < 300,
        status: request.status,
        statusText: request.statusText,
        text: request.responseText || ''
      });
    };
    request.onerror = () => reject(new Error('Upload R2 falhou por erro de rede ou CORS.'));
    request.onabort = () => reject(new Error('Upload R2 cancelado.'));
    request.send(file);
  });
}

async function openOperations() {
  state.tab = 'ops';
  if (state.selectedSourceSessionId && !state.review) {
    await loadSession(state.selectedSourceSessionId);
  }
  await loadJobs(true);
  render();
}

async function runUploadedCraigJob(dryRun = false) {
  const job = state.ingest.result?.job;
  if (!job?.id || !job?.type) {
    toast('Nenhum job Craig recente encontrado.');
    return;
  }
  if (typeof window.runCloudJob !== 'function') {
    await openOperations();
    toast('Abra Operacao para executar este job.');
    return;
  }
  const payload = await window.runCloudJob(job.id, job.type, dryRun);
  if (payload) {
    state.ingest = { ...state.ingest, lastJobResult: payload };
    if (payload.sourceSessionId) state.selectedSourceSessionId = payload.sourceSessionId;
    render();
  }
}

async function continueUploadPipeline(dryRun = false) {
  if (typeof window.continuePipeline !== 'function') {
    await openOperations();
    toast('Modulo de jobs ainda esta carregando. Tente novamente em instantes.');
    return null;
  }
  const payload = await window.continuePipeline(ingestSourceSessionId(), {
    dryRun,
    maxRuns: dryRun ? 1 : 12
  });
  if (payload?.sourceSessionId) state.selectedSourceSessionId = payload.sourceSessionId;
  render();
  return payload;
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

function renderTimeline() {
  if (!state.selectedSourceSessionId) return loadingView('Escolha uma sessao para abrir a timeline.');
  const timeline = state.timeline;
  if (!timeline.data && !timeline.loading && !timeline.error) {
    window.setTimeout(() => loadTimelineData(false), 0);
  }
  if (timeline.loading && !timeline.data) return loadingView('Montando timeline sincronizada...');
  if (timeline.error) {
    return `
      <section class="loading-panel">
        <h2>Timeline indisponivel</h2>
        <p>${escapeHtml(timeline.error)}</p>
        <button onclick="loadTimelineData(true)">Tentar de novo</button>
      </section>
    `;
  }
  const data = timeline.data;
  if (!data) return loadingView('Preparando timeline...');
  const items = filteredTimelineItems();
  if (!timeline.selectedItemId || !items.some(item => item.id === timeline.selectedItemId)) {
    timeline.selectedItemId = items[0]?.id || data.items?.[0]?.id || null;
  }
  const selected = timelineSelectedItem();
  const stats = data.stats || {};
  const anchorNotice = data.session?.startedAt
    ? `<div class="timeline-anchor-ok">${badge('ancora ativa', 'green')}<small>Inicio real: ${escapeHtml(fmtDateTime(data.session.startedAt))}</small></div>`
    : '<div class="timeline-anchor-warning"><strong>Defina o inicio real da sessao</strong><small>Sem essa ancora, mensagens do Discord e eventos externos podem ficar sem tempo confiavel.</small></div>';
  return `
    <section class="timeline-workbench">
      <div class="panel timeline-command">
        <div class="panel-head">
          <div>
            <h2>Timeline da sessao</h2>
            <small>${escapeHtml(data.session?.title || data.sourceSessionId)} • ${escapeHtml(data.stats?.timingNote || '')}</small>
          </div>
          <div class="badges">
            ${badge(`${stats.syncedItems || 0}/${stats.totalItems || 0} sincronizados`, 'green')}
            ${badge(`${stats.phraseItems || 0} frases`, 'blue')}
            ${badge(`${stats.roll20Events || 0} Roll20`, 'violet')}
            ${badge(`${stats.discordEvents || 0} Discord`, 'green')}
          </div>
        </div>
        ${anchorNotice}
        <div class="timeline-toolbar">
          <select onchange="state.timeline.filter=this.value; render();">
            ${['all', 'speech', 'roll20', 'discord'].map(value => `<option value="${value}" ${state.timeline.filter === value ? 'selected' : ''}>${escapeHtml(timelineFilterLabel(value))}</option>`).join('')}
          </select>
          <input value="${escapeHtml(state.timeline.query || '')}" placeholder="Buscar fala, jogador, Discord, Roll20..." oninput="state.timeline.query=this.value; render();" />
          <label><span class="label">Zoom</span><input type="range" min="1" max="6" step="1" value="${Number(state.timeline.zoom || 1)}" oninput="state.timeline.zoom=Number(this.value); render();" /></label>
          ${renderTimelineNavigation(items)}
          <button onclick="loadTimelineData(true)">Atualizar</button>
        </div>
        ${renderDiscordSyncControls()}
      </div>

      ${renderTimelineOverview(data, items)}
      ${renderTimelineAudioDock(selected)}

      <section class="timeline-layout">
        <div class="timeline-main">
          ${renderTimelineScale(data, items)}
          ${renderTimelineLanes(data, items)}
          ${renderTimelineTranscript(items)}
          ${renderTimelineEvents(items)}
        </div>
        ${renderTimelineInspector(selected)}
      </section>
    </section>
  `;
}

function timelineFilterLabel(value) {
  return { all: 'Tudo', speech: 'Falas', roll20: 'Roll20', discord: 'Discord' }[value] || value;
}

function renderDiscordSyncControls() {
  const discord = state.timeline.discord || {};
  if (!canSyncDiscordTimeline()) {
    return '<div class="timeline-discord-sync muted"><span class="label">Discord</span><small>Sincronizacao do canal exige papel owner, master ou reviewer.</small></div>';
  }
  const result = discord.result;
  const summary = result
    ? discordSyncResultText(result)
    : 'Puxa as ultimas mensagens do canal DnD configurado e salva como notas da sessao.';
  const cursorMode = discord.cursorMode || 'latest';
  const syncMode = discord.syncMode || 'page';
  const needsCursor = syncMode !== 'session_window' && cursorMode !== 'latest';
  return `
    <div class="timeline-discord-sync">
      <div class="discord-sync-intro">
        <span class="label">Discord</span>
        <strong>Sincronizar canal da mesa</strong>
        <small>${escapeHtml(discord.error || summary)}</small>
      </div>
      <div class="discord-sync-fields">
        <label>
          <span class="label">Canal</span>
          <select onchange="state.timeline.discord.channel=this.value">
            ${[
              ['dnd', 'Mesa DnD'],
              ['recording', 'Gravacoes'],
              ['ops', 'Logs/Ops']
            ].map(([value, label]) => `<option value="${value}" ${(discord.channel || 'dnd') === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
          </select>
        </label>
        <label>
          <span class="label">Modo</span>
          <select onchange="state.timeline.discord.syncMode=this.value; render();">
            ${[
              ['page', 'Bloco atual'],
              ['session_window', 'Janela da sessao']
            ].map(([value, label]) => `<option value="${value}" ${syncMode === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
          </select>
        </label>
        <label>
          <span class="label">Mensagens</span>
          <input type="number" min="1" max="100" value="${Number(discord.limit || 50)}" oninput="state.timeline.discord.limit=Number(this.value || 50)" />
        </label>
        <label class="${syncMode === 'session_window' ? '' : 'muted-field'}">
          <span class="label">Paginas</span>
          <input type="number" min="1" max="10" ${syncMode === 'session_window' ? '' : 'disabled'} value="${Number(discord.maxPages || 6)}" oninput="state.timeline.discord.maxPages=Number(this.value || 6)" />
        </label>
        <label>
          <span class="label">Janela</span>
          <select ${syncMode === 'session_window' ? 'disabled' : ''} onchange="state.timeline.discord.cursorMode=this.value; render();">
            ${[
              ['latest', 'Ultimas'],
              ['before', 'Antes do ID'],
              ['after', 'Depois do ID'],
              ['around', 'Ao redor do ID']
            ].map(([value, label]) => `<option value="${value}" ${cursorMode === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
          </select>
        </label>
        <label class="${needsCursor ? '' : 'muted-field'}">
          <span class="label">ID base</span>
          <input ${needsCursor ? '' : 'disabled'} value="${escapeHtml(discord.cursorMessageId || '')}" placeholder="${needsCursor ? 'ID da mensagem Discord' : 'sem cursor'}" oninput="state.timeline.discord.cursorMessageId=this.value.trim()" />
        </label>
        <label class="check-row">
          <input type="checkbox" ${discord.includeBeforeStart ? 'checked' : ''} onchange="state.timeline.discord.includeBeforeStart=this.checked" />
          <span>Incluir antes do inicio</span>
        </label>
        <label class="check-row">
          <input type="checkbox" ${discord.includeAfterEnd ? 'checked' : ''} onchange="state.timeline.discord.includeAfterEnd=this.checked" />
          <span>Incluir depois do fim</span>
        </label>
      </div>
      <div class="discord-sync-actions">
        <button ${discord.busy ? 'disabled' : ''} onclick="syncDiscordTimeline()">${discord.busy ? 'Sincronizando...' : 'Sincronizar Discord'}</button>
        <button onclick="setDiscordCursor('latest', '')">Ultimas</button>
      </div>
      ${discordSyncWindowDetails(result)}
    </div>
  `;
}

function discordSyncResultText(result = {}) {
  if (result.warning) return result.warning;
  const parts = [
    `${result.fetched || 0} buscadas`,
    `${result.accepted || 0} aceitas`,
    `${result.persisted || 0} novas`,
    `${result.updated || 0} atualizadas`,
    `${result.skipped || 0} ignoradas`
  ];
  if (result.syncMode === 'session_window' && Array.isArray(result.pages) && result.pages.length) {
    parts.push(`${result.pages.length} paginas`);
  }
  return parts.join(', ');
}

function discordCursorLabel(value) {
  return {
    latest: 'Ultimas',
    before: 'Antes do ID',
    after: 'Depois do ID',
    around: 'Ao redor do ID'
  }[value] || value || 'Ultimas';
}

function discordSyncWindowDetails(result) {
  const page = result?.window;
  if (!page) return '';
  const pages = Array.isArray(result.pages) ? result.pages : [];
  const oldest = page.oldestMessageId || '';
  const newest = page.newestMessageId || '';
  const copyValue = [
    `channel=${page.channelId || result.channelId || ''}`,
    `oldest=${oldest}`,
    `newest=${newest}`,
    `mode=${page.cursorMode || result.cursor?.mode || 'latest'}`
  ].join(' ');
  const sessionRange = result.sessionStartedAt || result.sessionEndedAt
    ? `${fmtDateTime(result.sessionStartedAt || '')} -> ${fmtDateTime(result.sessionEndedAt || '')}`
    : '-';
  return `
    <div class="discord-sync-window">
      <div class="source-detail-grid">
        <div><span class="label">Janela</span><strong>${escapeHtml(discordCursorLabel(page.cursorMode))}</strong></div>
        <div><span class="label">Modo</span><strong>${escapeHtml(result.syncMode || 'page')}${pages.length ? ` (${pages.length} paginas)` : ''}</strong></div>
        <div><span class="label">Sessao</span><strong>${escapeHtml(sessionRange)}</strong></div>
        ${result.sessionWindowBeforeMessageId ? `<div><span class="label">Cursor tecnico</span><strong>${escapeHtml(result.sessionWindowBeforeMessageId)}</strong></div>` : ''}
        <div><span class="label">Conteudo visivel</span><strong>${Number(page.contentVisible || 0)}/${Number(page.fetched || 0)}</strong></div>
        <div><span class="label">Mais antiga</span><strong>${oldest ? `${escapeHtml(fmtDateTime(page.oldestCreatedAt))} ${escapeHtml(oldest)}` : '-'}</strong></div>
        <div><span class="label">Mais nova</span><strong>${newest ? `${escapeHtml(fmtDateTime(page.newestCreatedAt))} ${escapeHtml(newest)}` : '-'}</strong></div>
      </div>
      <div class="discord-window-actions">
        <button ${oldest && page.canLoadOlder ? '' : 'disabled'} onclick="syncDiscordTimelineWithCursor('before','${escapeHtml(oldest)}')">Sincronizar anteriores</button>
        <button ${newest ? '' : 'disabled'} onclick="syncDiscordTimelineWithCursor('after','${escapeHtml(newest)}')">Checar novas</button>
        <button ${oldest || newest ? '' : 'disabled'} onclick="copyText('${escapeHtml(copyValue)}', 'IDs do Discord copiados.')">Copiar IDs</button>
      </div>
    </div>
  `;
}

function filteredTimelineItems() {
  const data = state.timeline.data;
  const filter = state.timeline.filter || 'all';
  const query = String(state.timeline.query || '').trim().toLowerCase();
  return (data?.items || []).filter(item => {
    const sourceOk = filter === 'all' || item.kind === filter;
    if (!sourceOk) return false;
    if (!query) return true;
    const text = [
      item.kind,
      item.title,
      item.subtitle,
      item.text,
      item.raw?.sourceId,
      item.raw?.sourceEventId,
      item.raw?.authorName,
      item.raw?.authorDiscordId,
      item.raw?.eventType,
      item.raw?.characterName,
      item.raw?.speaker
    ].filter(Boolean).join(' ').toLowerCase();
    return text.includes(query);
  });
}

function timelineSelectedItem() {
  const data = state.timeline.data;
  const id = state.timeline.selectedItemId;
  return (data?.items || []).find(item => item.id === id) || null;
}

function timelineSortedItems(items = filteredTimelineItems()) {
  return [...items].sort((a, b) => {
    const aRange = timelineItemRange(a);
    const bRange = timelineItemRange(b);
    return aRange.start - bRange.start
      || aRange.end - bRange.end
      || String(a.kind || '').localeCompare(String(b.kind || ''))
      || String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function timelineNavigationState(items = filteredTimelineItems()) {
  const sorted = timelineSortedItems(items);
  const index = sorted.findIndex(item => item.id === state.timeline.selectedItemId);
  return {
    sorted,
    total: sorted.length,
    index,
    previous: index > 0 ? sorted[index - 1] : null,
    next: index >= 0 && index < sorted.length - 1 ? sorted[index + 1] : null
  };
}

function timelineDuration(data, items) {
  return Math.max(
    Number(data?.session?.durationMs || 0),
    ...items.map(item => Number(item.endMs || item.startMs || 0)),
    60000
  );
}

function timelineItemRange(item) {
  const start = Number(item?.startMs || 0);
  const end = Number(item?.endMs || item?.startMs || start + 500);
  return {
    start: Number.isFinite(start) ? Math.max(0, start) : 0,
    end: Number.isFinite(end) ? Math.max(0, end) : 500
  };
}

function timelineOverviewBins(items, duration) {
  const binCount = Math.max(24, Math.min(96, Math.ceil(Number(state.timeline.zoom || 1) * 18)));
  const binSize = duration / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    index,
    startMs: Math.round(index * binSize),
    endMs: Math.round((index + 1) * binSize),
    speech: 0,
    roll20: 0,
    discord: 0,
    other: 0,
    total: 0
  }));
  items.forEach(item => {
    const range = timelineItemRange(item);
    const startIndex = Math.max(0, Math.min(binCount - 1, Math.floor(range.start / binSize)));
    const endIndex = Math.max(startIndex, Math.min(binCount - 1, Math.floor(Math.max(range.start, range.end - 1) / binSize)));
    const kind = ['speech', 'roll20', 'discord'].includes(item.kind) ? item.kind : 'other';
    for (let index = startIndex; index <= endIndex; index += 1) {
      bins[index][kind] += 1;
      bins[index].total += 1;
    }
  });
  return bins;
}

function renderTimelineOverview(data, items) {
  const duration = timelineDuration(data, items);
  const bins = timelineOverviewBins(items, duration);
  const maxTotal = Math.max(1, ...bins.map(bin => bin.total));
  const selected = timelineSelectedItem();
  const selectedStart = selected ? timelineItemRange(selected).start : null;
  const selectedLeft = selectedStart === null ? null : Math.min(100, Math.max(0, (selectedStart / duration) * 100));
  const speechMs = items
    .filter(item => item.kind === 'speech')
    .reduce((sum, item) => sum + Math.max(0, timelineItemRange(item).end - timelineItemRange(item).start), 0);
  const externalEvents = items.filter(item => item.kind !== 'speech').length;
  const unsynced = items.filter(item => item.startMs === null || item.startMs === undefined).length;
  return `
    <section class="panel timeline-overview">
      <div class="timeline-overview-head">
        <div>
          <span class="label">Mapa da sessao</span>
          <h2>Densidade sincronizada</h2>
        </div>
        <div class="timeline-overview-kpis">
          <div><span class="label">Duracao</span><strong>${escapeHtml(fmtDuration(duration))}</strong></div>
          <div><span class="label">Itens visiveis</span><strong>${items.length}</strong></div>
          <div><span class="label">Falas</span><strong>${escapeHtml(fmtDuration(speechMs))}</strong></div>
          <div><span class="label">Eventos</span><strong>${externalEvents}</strong></div>
          <div><span class="label">Sem tempo</span><strong>${unsynced}</strong></div>
        </div>
      </div>
      <div class="timeline-overview-legend">
        <span class="speech">Falas</span>
        <span class="roll20">Roll20</span>
        <span class="discord">Discord</span>
      </div>
      ${renderTimelineTimingLegend(items)}
      <div class="timeline-overview-track" style="--overview-bins:${bins.length}">
        ${bins.map(bin => renderTimelineOverviewBin(bin, maxTotal)).join('')}
        ${selectedLeft === null ? '' : `<span class="timeline-overview-marker" style="left:${selectedLeft}%"></span>`}
      </div>
    </section>
  `;
}

function renderTimelineOverviewBin(bin, maxTotal) {
  const density = bin.total ? Math.max(5, Math.round((bin.total / maxTotal) * 44)) : 2;
  const title = `${fmtDuration(bin.startMs)} - ${fmtDuration(bin.endMs)} | ${bin.speech} falas, ${bin.roll20} Roll20, ${bin.discord} Discord`;
  return `
    <button class="timeline-overview-bin ${bin.total ? '' : 'empty'}" ${bin.total ? '' : 'disabled'} onclick="selectTimelineNearest(${bin.startMs}, ${bin.endMs})" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">
      <span class="timeline-overview-stack" style="height:${density}px">
        ${renderOverviewSegment('speech', bin.speech, bin.total)}
        ${renderOverviewSegment('roll20', bin.roll20, bin.total)}
        ${renderOverviewSegment('discord', bin.discord, bin.total)}
        ${renderOverviewSegment('other', bin.other, bin.total)}
      </span>
    </button>
  `;
}

function renderOverviewSegment(kind, value, total) {
  if (!value || !total) return '';
  return `<span class="${kind}" style="height:${Math.max(8, Math.round((value / total) * 100))}%"></span>`;
}

function renderTimelineNavigation(items) {
  const nav = timelineNavigationState(items);
  const label = nav.total ? `${Math.max(0, nav.index + 1)}/${nav.total}` : '0/0';
  return `
    <div class="timeline-nav" aria-label="Navegacao da timeline">
      <button ${nav.previous ? '' : 'disabled'} onclick="navigateTimeline(-1)" title="Item anterior">Anterior</button>
      <strong>${escapeHtml(label)}</strong>
      <button ${nav.next ? '' : 'disabled'} onclick="navigateTimeline(1)" title="Proximo item">Proximo</button>
    </div>
  `;
}

function timelineTimingConfidence(item) {
  const mode = String(item?.timingMode || '');
  const missingTime = item?.startMs === null || item?.startMs === undefined || mode.includes('unsynced');
  if (missingTime) {
    return {
      key: 'unsynced',
      label: 'sem tempo',
      tone: 'orange',
      detail: 'Item ainda nao tem posicao confiavel dentro da sessao.'
    };
  }
  if (mode === 'segment_exact') {
    return {
      key: 'exact',
      label: 'tempo exato',
      tone: 'green',
      detail: 'Tempo vem diretamente do segmento transcrito.'
    };
  }
  if (mode === 'phrase_estimated_from_segment') {
    return {
      key: 'estimated',
      label: 'frase estimada',
      tone: 'orange',
      detail: 'Frase foi dividida localmente dentro de um segmento transcrito, sem custo extra de IA.'
    };
  }
  if (mode.includes('before_session_start')) {
    return {
      key: 'outside',
      label: 'fora da janela',
      tone: 'orange',
      detail: 'Timestamp existe, mas caiu antes do inicio real da sessao.'
    };
  }
  if (item?.kind === 'roll20' || item?.kind === 'discord') {
    return {
      key: 'anchored',
      label: 'ancorado',
      tone: 'blue',
      detail: 'Tempo calculado a partir do inicio real da sessao e do timestamp da fonte.'
    };
  }
  return {
    key: 'timed',
    label: 'sincronizado',
    tone: 'blue',
    detail: 'Item tem posicao sincronizada na sessao.'
  };
}

function timelineTimingCounts(items) {
  return items.reduce((counts, item) => {
    const key = timelineTimingConfidence(item).key;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function renderTimelineTimingLegend(items) {
  const counts = timelineTimingCounts(items);
  const entries = [
    ['exact', 'Exato'],
    ['estimated', 'Estimado'],
    ['anchored', 'Ancorado'],
    ['unsynced', 'Sem tempo'],
    ['outside', 'Fora da janela']
  ].filter(([key]) => counts[key]);
  if (!entries.length) return '';
  return `
    <div class="timeline-confidence-legend">
      ${entries.map(([key, label]) => `<span class="${key}">${escapeHtml(label)} <strong>${counts[key]}</strong></span>`).join('')}
    </div>
  `;
}

function renderTimelineScale(data, items) {
  const duration = timelineDuration(data, items);
  const markers = Array.from({ length: 7 }, (_, index) => Math.round(duration * (index / 6)));
  return `
    <div class="timeline-scale" style="--timeline-zoom:${Number(state.timeline.zoom || 1)}">
      ${markers.map(ms => `<span style="left:${Math.min(100, Math.max(0, (ms / duration) * 100))}%">${escapeHtml(fmtDuration(ms))}</span>`).join('')}
    </div>
  `;
}

function renderTimelineLanes(data, items) {
  const lanes = data.lanes || [];
  const duration = timelineDuration(data, items);
  return `
    <div class="timeline-lanes" style="--timeline-zoom:${Number(state.timeline.zoom || 1)}">
      ${lanes.map(lane => renderTimelineLane(lane, items.filter(item => item.laneId === lane.id), duration)).join('')}
    </div>
  `;
}

function renderTimelineLane(lane, laneItems, duration) {
  const stats = timelineLaneStats(laneItems);
  const meta = [`${stats.count} itens`];
  if (stats.speechMs) meta.push(`${fmtDuration(stats.speechMs)} fala`);
  if (stats.events) meta.push(`${stats.events} eventos`);
  if (stats.overlaps) meta.push(`${stats.overlaps} sobreposicoes`);
  if (stats.clusters) meta.push(`${stats.clusters} clusters`);
  const layout = timelineLaneLayout(laneItems);
  const trackHeight = Math.max(54, 14 + (layout.rowCount * 28));
  const hasSelection = laneItems.some(item => item.id === state.timeline.selectedItemId);
  return `
    <div class="timeline-lane ${hasSelection ? 'has-selection' : ''}" style="--lane-track-height:${trackHeight}px">
      <div class="timeline-lane-label">
        <strong>${escapeHtml(lane.label || lane.id)}</strong>
        <small>${escapeHtml(lane.subtitle || lane.trackKey || lane.type || '')}</small>
        <small class="timeline-lane-metrics">${escapeHtml(meta.join(' / '))}</small>
      </div>
      <div class="timeline-lane-track">
        ${layout.items.map(item => renderTimelineBlock(item, duration)).join('')}
      </div>
    </div>
  `;
}

function timelineLaneLayout(laneItems) {
  const activeRows = [];
  const clusterMap = timelineDenseClusterMap(laneItems);
  const items = [...laneItems]
    .map((item, originalIndex) => ({ ...item, _range: timelineItemRange(item), _originalIndex: originalIndex }))
    .sort((a, b) => a._range.start - b._range.start || a._range.end - b._range.end || a._originalIndex - b._originalIndex)
    .map(item => {
      const row = activeRows.findIndex(end => end <= item._range.start);
      const targetRow = row >= 0 ? row : activeRows.length;
      activeRows[targetRow] = item._range.end;
      return { ...item, timelineRow: targetRow, timelineCluster: clusterMap.get(item.id) || null };
    });
  return { items, rowCount: Math.max(1, activeRows.length) };
}

function timelineDenseClusterMap(laneItems, windowMs = 2000) {
  const timedEvents = laneItems
    .filter(item => item.kind !== 'speech')
    .map(item => ({ item, range: timelineItemRange(item) }))
    .filter(entry => Number.isFinite(entry.range.start))
    .sort((a, b) => a.range.start - b.range.start || String(a.item.id || '').localeCompare(String(b.item.id || '')));
  const clusters = [];
  let current = [];
  timedEvents.forEach(entry => {
    if (!current.length || entry.range.start - current[current.length - 1].range.start <= windowMs) {
      current.push(entry);
      return;
    }
    clusters.push(current);
    current = [entry];
  });
  if (current.length) clusters.push(current);
  const clusterMap = new Map();
  clusters
    .filter(cluster => cluster.length > 1)
    .forEach(cluster => {
      const startMs = Math.min(...cluster.map(entry => entry.range.start));
      const endMs = Math.max(...cluster.map(entry => entry.range.end));
      const members = cluster.map(entry => entry.item);
      members.forEach((member, index) => {
        clusterMap.set(member.id, { size: members.length, index, startMs, endMs, members });
      });
    });
  return clusterMap;
}

function timelineLaneStats(laneItems) {
  const speech = laneItems.filter(item => item.kind === 'speech');
  const clusterKeys = new Set([...timelineDenseClusterMap(laneItems).values()].map(cluster => `${cluster.startMs}:${cluster.endMs}:${cluster.size}`));
  return {
    count: laneItems.length,
    speechMs: speech.reduce((sum, item) => sum + Math.max(0, timelineItemRange(item).end - timelineItemRange(item).start), 0),
    events: laneItems.filter(item => item.kind !== 'speech').length,
    overlaps: timelineOverlapCount(laneItems),
    clusters: clusterKeys.size
  };
}

function timelineOverlapCount(items) {
  const ranges = items
    .map(timelineItemRange)
    .filter(range => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  let activeEnds = [];
  let overlaps = 0;
  ranges.forEach(range => {
    activeEnds = activeEnds.filter(end => end > range.start);
    if (activeEnds.length) overlaps += 1;
    activeEnds.push(range.end);
  });
  return overlaps;
}

function renderTimelineBlock(item, duration) {
  const start = Number(item.startMs || 0);
  const end = Number(item.endMs || item.startMs || start + 500);
  const left = Math.min(99.5, Math.max(0, (start / duration) * 100));
  const width = item.kind === 'roll20' || item.kind === 'discord'
    ? 1.2
    : Math.max(.8, Math.min(100 - left, ((Math.max(400, end - start) / duration) * 100)));
  const selected = item.id === state.timeline.selectedItemId;
  const title = item.kind === 'roll20' ? eventTypeLabel(item.title) : item.title;
  const row = Math.max(0, Number(item.timelineRow || 0));
  const top = 9 + (row * 28);
  const timing = timelineTimingConfidence(item);
  const cluster = item.timelineCluster;
  const visualWidth = cluster ? Math.max(width, Math.min(6, 1.6 + (cluster.size * .45))) : width;
  const clusterTitle = cluster ? ` / cluster ${cluster.index + 1}/${cluster.size}` : '';
  return `
    <button class="timeline-block ${item.kind} timing-${timing.key} ${cluster ? 'has-cluster' : ''} ${selected ? 'selected' : ''}" data-timeline-block-id="${escapeHtml(item.id)}" aria-pressed="${selected ? 'true' : 'false'}" style="left:${left}%;width:${visualWidth}%;top:${top}px;" onclick="selectTimelineItem('${escapeHtml(item.id)}')" title="${escapeHtml(`${timing.label}${clusterTitle}: ${item.text || title || item.kind}`)}">
      <span>${escapeHtml(title || item.kind)}</span>
      ${cluster ? `<small>${cluster.size}</small>` : ''}
    </button>
  `;
}

function renderTimelineTranscript(items) {
  const speechItems = items.filter(item => item.kind === 'speech');
  return `
    <section class="panel timeline-transcript">
      <div class="panel-head">
        <h2>Transcricao sincronizada</h2>
        <small>${speechItems.length} frases estimadas sem nova IA</small>
      </div>
      <div class="timeline-table">
        ${speechItems.map(item => `
          <button class="${item.id === state.timeline.selectedItemId ? 'active' : ''}" data-timeline-row-id="${escapeHtml(item.id)}" onclick="selectTimelineItem('${escapeHtml(item.id)}')">
            <span>${escapeHtml(fmtDuration(item.startMs))}</span>
            <strong>${escapeHtml(item.title || '-')}</strong>
            <p>${escapeHtml(item.text || '')}</p>
          </button>
        `).join('') || '<div class="empty">Nenhuma fala transcrita para esta sessao.</div>'}
      </div>
    </section>
  `;
}

function renderTimelineEvents(items) {
  const eventItems = items.filter(item => item.kind !== 'speech');
  return `
    <section class="panel timeline-events">
      <div class="panel-head">
        <h2>Eventos sincronizados</h2>
        <small>${eventItems.length} itens de Roll20, Discord e outras fontes</small>
      </div>
      <div class="timeline-table event-table">
        ${eventItems.map(item => `
          <button class="${item.id === state.timeline.selectedItemId ? 'active' : ''}" data-timeline-row-id="${escapeHtml(item.id)}" onclick="selectTimelineItem('${escapeHtml(item.id)}')">
            <span>${escapeHtml(item.startMs === null || item.startMs === undefined ? '--:--:--' : fmtDuration(item.startMs))}</span>
            <strong>${escapeHtml(item.kind === 'roll20' ? eventTypeLabel(item.title) : item.title || item.kind)}</strong>
            <p>${escapeHtml(item.text || '')}</p>
          </button>
        `).join('') || '<div class="empty">Nenhum evento externo sincronizado ainda.</div>'}
      </div>
    </section>
  `;
}

function renderTimelineAudioDock(item) {
  if (!item) return '';
  const canPlay = item.kind === 'speech' && item.trackKey;
  const active = state.audio.segmentId === item.id;
  const timing = timelineTimingConfidence(item);
  if (!canPlay) {
    return `
      <section class="panel timeline-audio-dock muted">
        <div>
          <span class="label">Audio do item selecionado</span>
          <strong>${escapeHtml(item.title || item.kind)}</strong>
          <small>Este item nao possui faixa de audio direta.</small>
        </div>
        <div class="badges">${badge(item.kind, item.kind === 'roll20' ? 'green' : item.kind === 'discord' ? 'violet' : 'blue')}${badge(timing.label, timing.tone)}</div>
      </section>
    `;
  }
  const loading = active && state.audio.loading;
  const error = active && state.audio.error;
  const ready = active && state.audio.url;
  const fragment = ready ? `${state.audio.url}#t=${Math.floor(state.audio.startSeconds)}` : '';
  return `
    <section class="panel timeline-audio-dock">
      <div class="timeline-audio-summary">
        <span class="label">Audio do item selecionado</span>
        <strong>${escapeHtml(item.title || item.trackKey || 'Fala')}</strong>
        <small>${escapeHtml(item.trackKey)} / ${escapeHtml(fmtDuration(item.startMs))} / ${escapeHtml(timing.label)}</small>
      </div>
      <div class="timeline-audio-control">
        ${loading ? '<p>Gerando URL assinada...</p>' : ''}
        ${error ? `<p class="error-text">${escapeHtml(state.audio.error)}</p>` : ''}
        ${ready ? `<audio id="timelineDockAudio" controls preload="metadata" src="${escapeHtml(fragment)}"></audio>` : ''}
        ${ready ? '' : `<button ${loading ? 'disabled' : ''} onclick="loadTimelineAudio('${escapeHtml(item.id)}')">${loading ? 'Carregando...' : 'Ouvir trecho'}</button>`}
      </div>
      <div class="badges">
        ${ready ? badge('R2 assinado', 'green') : badge('sob demanda', 'blue')}
        ${ready && state.audio.file?.sizeBytes ? badge(`${Math.round(state.audio.file.sizeBytes / 1024 / 1024)} MB`, 'blue') : ''}
      </div>
    </section>
  `;
}

function selectTimelineNearest(startMs, endMs) {
  const items = filteredTimelineItems();
  const target = (Number(startMs || 0) + Number(endMs || 0)) / 2;
  const candidates = items
    .filter(item => {
      const range = timelineItemRange(item);
      return range.end >= startMs && range.start <= endMs;
    })
    .sort((a, b) => Math.abs(timelineItemRange(a).start - target) - Math.abs(timelineItemRange(b).start - target));
  const selected = candidates[0];
  if (selected) selectTimelineItem(selected.id);
}

function renderTimelineInspector(item) {
  if (!item) {
    return `
      <aside class="panel timeline-inspector">
        <div class="panel-head"><h2>Detalhe</h2></div>
        <div class="panel-body"><div class="empty">Selecione um item na timeline.</div></div>
      </aside>
    `;
  }
  const canPlay = item.kind === 'speech' && item.trackKey;
  const timing = timelineTimingConfidence(item);
  return `
    <aside class="panel timeline-inspector">
      <div class="panel-head">
        <div>
          <span class="label">${escapeHtml(item.kind)}</span>
          <h2>${escapeHtml(item.title || item.kind)}</h2>
        </div>
        <div class="badges">${badge(item.kind, item.kind === 'roll20' ? 'green' : item.kind === 'discord' ? 'violet' : 'blue')}${badge(timing.label, timing.tone)}</div>
      </div>
      <div class="panel-body detail-grid">
        <div class="field-grid">
          <div><span class="label">Inicio</span><strong>${escapeHtml(fmtDuration(item.startMs))}</strong></div>
          <div><span class="label">Fim</span><strong>${escapeHtml(fmtDuration(item.endMs || item.startMs))}</strong></div>
          <div><span class="label">Duracao</span><strong>${escapeHtml(fmtDuration(item.durationMs || 0))}</strong></div>
          <div><span class="label">Lane</span><strong>${escapeHtml(item.laneId || '-')}</strong></div>
          <div><span class="label">Precisao</span><strong>${escapeHtml(timing.label)}</strong></div>
          <div><span class="label">Modo</span><strong>${escapeHtml(item.timingMode || timing.key)}</strong></div>
        </div>
        <small class="timeline-confidence-note">${escapeHtml(timing.detail)}</small>
        <div>
          <span class="label">${item.kind === 'speech' ? 'Fala' : 'Evento'}</span>
          <p>${escapeHtml(item.text || '-')}</p>
        </div>
        ${timelineSourceDetails(item)}
        ${timelineClusterDetails(item)}
        ${timelineAttachmentLinks(item)}
        ${item.subtitle ? `<small>${escapeHtml(item.subtitle)}</small>` : ''}
        ${canPlay ? timelineAudioPanel(item) : '<div class="audio-card"><span class="label">Audio</span><p>Item sem faixa de audio direta.</p></div>'}
        <div class="actions">
          ${canPlay ? `<button onclick="loadTimelineAudio('${escapeHtml(item.id)}')">Ouvir aqui</button>` : ''}
          <button onclick="copyTimelineSelected()">Copiar texto</button>
        </div>
      </div>
    </aside>
  `;
}

function timelineClusterForItem(item) {
  if (!item || item.kind === 'speech') return null;
  const laneItems = (state.timeline.data?.items || []).filter(entry => entry.laneId === item.laneId);
  return timelineDenseClusterMap(laneItems).get(item.id) || null;
}

function timelineClusterDetails(item) {
  const cluster = timelineClusterForItem(item);
  if (!cluster) return '';
  const members = cluster.members || [];
  return `
    <div class="timeline-cluster-card">
      <span class="label">Cluster de eventos</span>
      <strong>${members.length} eventos entre ${escapeHtml(fmtDuration(cluster.startMs))} e ${escapeHtml(fmtDuration(cluster.endMs))}</strong>
      <div>
        ${members.slice(0, 5).map(member => `<small>${escapeHtml(fmtDuration(member.startMs))} / ${escapeHtml(member.kind)} / ${escapeHtml(member.title || member.text || member.id)}</small>`).join('')}
        ${members.length > 5 ? `<small>+${members.length - 5} eventos no mesmo cluster</small>` : ''}
      </div>
    </div>
  `;
}

function timelineSourceDetails(item) {
  const raw = item.raw || {};
  const dice = raw.payload?.diceRoll || raw.diceRoll || null;
  const rows = [
    ['Fonte', raw.sourceSystem || item.kind],
    ['Source ID', raw.sourceId || raw.sourceEventId],
    ['Autor Discord', raw.authorName || raw.authorDiscordId],
    ['Formula', dice?.formula],
    ['Resultado', dice?.result],
    ['Critico', dice?.criticalHint],
    ['Status', raw.reviewStatus || raw.visibility],
    ['Criado', raw.createdAt || raw.createdAtRoll20]
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (!rows.length) return '';
  return `
    <div class="source-detail-grid">
      ${rows.map(([label, value]) => `<div><span class="label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}
    </div>
  `;
}

function timelineAttachmentLinks(item) {
  const attachments = item.raw?.metadata?.discord?.attachments || [];
  const valid = attachments.filter(attachment => attachment?.url);
  if (!valid.length) return '';
  return `
    <div class="audio-card">
      <span class="label">Anexos Discord</span>
      <div class="attachment-list">
        ${valid.map(attachment => `
          <a class="button-link" href="${escapeHtml(attachment.url)}" target="_blank" rel="noreferrer">
            ${escapeHtml(attachment.filename || attachment.id || 'Anexo')}
          </a>
        `).join('')}
      </div>
    </div>
  `;
}

function timelineAudioPanel(item) {
  const active = state.audio.segmentId === item.id;
  if (!active) {
    return `
      <div class="audio-card">
        <span class="label">Audio</span>
        <p>Carregue a faixa ${escapeHtml(item.trackKey)} a partir de ${escapeHtml(fmtDuration(item.startMs))}.</p>
      </div>
    `;
  }
  if (state.audio.loading) {
    return `<div class="audio-card"><span class="label">Audio</span><p>Gerando URL assinada da faixa...</p></div>`;
  }
  if (state.audio.error) {
    return `<div class="audio-card error"><span class="label">Audio</span><p>${escapeHtml(state.audio.error)}</p></div>`;
  }
  if (!state.audio.url) return '';
  const fragment = `${state.audio.url}#t=${Math.floor(state.audio.startSeconds)}`;
  return `
    <div class="audio-card">
      <div class="row between">
        <div>
          <span class="label">Audio</span>
          <strong>${escapeHtml(state.audio.trackKey || item.trackKey)}</strong>
          <small>Inicio sugerido: ${escapeHtml(fmtDuration(item.startMs))}</small>
        </div>
        <div class="badges">${badge('R2 assinado', 'green')}${badge(`${Math.round((state.audio.file?.sizeBytes || 0) / 1024 / 1024)} MB`, 'blue')}</div>
      </div>
      <audio id="segmentAudio" controls preload="metadata" src="${escapeHtml(fragment)}"></audio>
    </div>
  `;
}

function selectTimelineItem(id) {
  state.timeline.selectedItemId = id;
  render();
  window.setTimeout(scrollSelectedTimelineItemIntoView, 0);
}

function navigateTimeline(direction) {
  const nav = timelineNavigationState();
  if (!nav.total) return;
  const currentIndex = nav.index >= 0 ? nav.index : 0;
  const nextIndex = Math.max(0, Math.min(nav.total - 1, currentIndex + Number(direction || 0)));
  const item = nav.sorted[nextIndex];
  if (item) selectTimelineItem(item.id);
}

function timelineAttributeSelector(attribute, value) {
  const escaped = String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `[${attribute}="${escaped}"]`;
}

function scrollSelectedTimelineItemIntoView() {
  const id = state.timeline.selectedItemId;
  if (!id || typeof document === 'undefined') return;
  const block = document.querySelector(timelineAttributeSelector('data-timeline-block-id', id));
  if (block) {
    block.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

function copyTimelineSelected() {
  const item = timelineSelectedItem();
  copyText(item?.text || '', 'Texto copiado.');
}

async function syncDiscordTimeline() {
  if (!state.selectedSourceSessionId || !canSyncDiscordTimeline()) return;
  const discord = state.timeline.discord || {};
  const syncMode = discord.syncMode || 'page';
  const cursorMode = syncMode === 'session_window' ? 'latest' : (discord.cursorMode || 'latest');
  const cursorMessageId = String(discord.cursorMessageId || '').trim();
  if (cursorMode !== 'latest' && !cursorMessageId) {
    toast('Informe o ID base da mensagem Discord.');
    return;
  }
  const body = {
    sourceSessionId: state.selectedSourceSessionId,
    limit: Math.min(100, Math.max(1, Number(discord.limit || 50))),
    maxPages: Math.min(10, Math.max(1, Number(discord.maxPages || 6))),
    syncMode,
    includeBeforeStart: Boolean(discord.includeBeforeStart),
    includeAfterEnd: Boolean(discord.includeAfterEnd),
    channel: discord.channel || 'dnd'
  };
  if (cursorMode !== 'latest') body[cursorMode] = cursorMessageId;
  state.timeline.discord = {
    ...discord,
    busy: true,
    error: null,
    result: null
  };
  render();
  try {
    const payload = await api('/api/discord-sync-channel', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    state.timeline.discord = {
      ...(state.timeline.discord || {}),
      busy: false,
      error: null,
      result: payload
    };
    remember('Discord sincronizado na timeline.', payload);
    await loadTimelineData(true);
  } catch (error) {
    state.timeline.discord = {
      ...(state.timeline.discord || {}),
      busy: false,
      error: error.message,
      result: null
    };
    toast(error.message);
    render();
  }
}

function setDiscordCursor(mode, messageId = '') {
  state.timeline.discord = {
    ...(state.timeline.discord || {}),
    cursorMode: mode || 'latest',
    cursorMessageId: messageId || ''
  };
  render();
}

async function syncDiscordTimelineWithCursor(mode, messageId = '') {
  state.timeline.discord = {
    ...(state.timeline.discord || {}),
    cursorMode: mode || 'latest',
    cursorMessageId: messageId || ''
  };
  await syncDiscordTimeline();
}

async function loadTimelineAudio(id) {
  const item = (state.timeline.data?.items || []).find(entry => entry.id === id);
  if (!item?.trackKey) return;
  state.audio = {
    segmentId: id,
    loading: true,
    error: null,
    url: null,
    trackKey: item.trackKey,
    startSeconds: Number(item.startMs || 0) / 1000,
    expiresAt: null,
    file: null
  };
  render();
  try {
    const payload = await api(`/api/audio-url?sourceSessionId=${encodeURIComponent(state.selectedSourceSessionId)}&trackKey=${encodeURIComponent(item.trackKey)}&expires=900`);
    state.audio = {
      segmentId: id,
      loading: false,
      error: null,
      url: payload.url,
      trackKey: payload.trackKey || item.trackKey,
      startSeconds: Number(item.startMs || 0) / 1000,
      expiresAt: new Date(Date.now() + Number(payload.expiresSeconds || 900) * 1000).toISOString(),
      file: payload.file || null
    };
    render();
    window.setTimeout(() => {
      const player = document.getElementById('timelineDockAudio') || document.getElementById('segmentAudio');
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
    state.audio = { ...state.audio, loading: false, error: error.message };
    render();
  }
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

function eventTypeLabel(type = '') {
  return {
    session_marker: 'Sessao',
    character_action_candidate: 'Acao',
    canon_candidate: 'Canon',
    dm_backstage_note: 'DM',
    audio_processing_hint: 'Audio',
    raw_roll20_note: 'Nota',
    roll20_chat_message: 'Chat',
    roll20_dice_roll: 'Rolagem',
    invalid_roll20_command: 'Invalido'
  }[type] || type || 'Evento';
}

function eventTypeTone(type = '') {
  if (type === 'dm_backstage_note') return 'gold';
  if (type === 'canon_candidate') return 'violet';
  if (type === 'character_action_candidate') return 'green';
  if (type === 'audio_processing_hint') return 'blue';
  if (type === 'roll20_chat_message') return 'blue';
  if (type === 'roll20_dice_roll') return 'violet';
  if (type === 'invalid_roll20_command') return 'red';
  return 'blue';
}

function roll20EventText(event) {
  const dice = event.payload?.diceRoll || null;
  if (dice) {
    const title = [dice.formula || 'dados', dice.result !== null && dice.result !== undefined ? `= ${dice.result}` : ''].filter(Boolean).join(' ');
    if (title) return title;
  }
  return event.text
    || event.payload?.text
    || event.payload?.args?.motivo
    || event.payload?.args?.titulo
    || event.payload?.rawCommand
    || event.raw_line
    || '';
}

function roll20EventCommand(event) {
  return event.payload?.command || event.payload?.rawCommand?.split(/\s+/)?.[0] || '';
}

function roll20TypeOptions(events) {
  const types = Array.from(new Set(events.map(event => event.event_type).filter(Boolean))).sort();
  return ['all', ...types].map(type => {
    const label = type === 'all' ? 'Todos tipos' : eventTypeLabel(type);
    return `<option value="${escapeHtml(type)}" ${state.roll20Type === type ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
}

function filteredRoll20Events() {
  const query = state.roll20Query.trim().toLowerCase();
  return (state.review?.roll20Events || []).filter(event => {
    const text = [
      event.event_type,
      event.roll20_who,
      event.character_name,
      event.source_event_id,
      roll20EventCommand(event),
      roll20EventText(event),
      event.raw_line
    ].join(' ').toLowerCase();
    return (state.roll20Type === 'all' || event.event_type === state.roll20Type)
      && (!query || text.includes(query));
  });
}

function renderRoll20Review() {
  const allEvents = state.review?.roll20Events || [];
  const events = filteredRoll20Events();
  const counts = allEvents.reduce((acc, event) => {
    acc[event.event_type || 'raw_roll20_note'] = (acc[event.event_type || 'raw_roll20_note'] || 0) + 1;
    return acc;
  }, {});
  return `
    <section class="toolbar roll20-toolbar">
      <input value="${escapeHtml(state.roll20Query)}" placeholder="Buscar speaker, personagem, texto, source id..." oninput="state.roll20Query=this.value; render();" />
      <select onchange="state.roll20Type=this.value; render();">
        ${roll20TypeOptions(allEvents)}
      </select>
      <a class="button-link" href="/roll20.html">Importar chat</a>
    </section>
    <section class="roll20-review-layout">
      <article class="panel">
        <div class="panel-head">
          <h2>Eventos Roll20</h2>
          <div class="badges">${badge(`${events.length}/${allEvents.length}`, 'blue')}${badge('producao', 'green')}</div>
        </div>
        <div class="panel-body roll20-event-list">
          ${events.map(roll20EventCard).join('') || renderRoll20Empty()}
        </div>
      </article>
      <article class="panel">
        <div class="panel-head"><h2>Resumo</h2>${badge('sem IA', 'green')}</div>
        <div class="panel-body">
          <div class="roll20-metric-grid">
            ${metric(allEvents.length, 'total')}
            ${metric(counts.canon_candidate || 0, 'canon')}
            ${metric(counts.dm_backstage_note || 0, 'DM')}
            ${metric(counts.character_action_candidate || 0, 'acoes')}
          </div>
          <div class="empty">Eventos gravados aqui ainda sao materia-prima de review. Nada vira canon final sem decisao do DM.</div>
          <div class="actions">
            <a class="button-link primary" href="/roll20.html">Validar ou gravar novo chat</a>
          </div>
        </div>
      </article>
    </section>
  `;
}

function renderRoll20Empty() {
  return `
    <div class="empty">
      Nenhum evento Roll20 nesta sessao.
    </div>
  `;
}

function roll20EventCard(event) {
  const text = roll20EventText(event);
  const command = roll20EventCommand(event);
  const raw = event.payload?.rawLine || event.raw_line || '';
  const note = event.note || null;
  const dice = event.payload?.diceRoll || null;
  return `
    <article class="roll20-review-card ${event.event_type === 'dm_backstage_note' ? 'private' : ''}">
      <div class="row between">
        <div>
          <span class="label">${escapeHtml(event.source_event_id || event.id || '')}</span>
          <h2>${escapeHtml(text || eventTypeLabel(event.event_type))}</h2>
        </div>
        <div class="badges">
          ${badge(eventTypeLabel(event.event_type), eventTypeTone(event.event_type))}
          ${command ? badge(command, 'blue') : ''}
          ${dice ? badge('dado', 'violet') : ''}
          ${dice?.criticalHint ? badge(dice.criticalHint.replace('possible_', ''), 'gold') : ''}
          ${note?.id ? badge('nota ' + (note.review_status || 'pending'), 'green') : ''}
        </div>
      </div>
      <div class="roll20-review-meta">
        <div><span class="label">Speaker</span><strong>${escapeHtml(event.roll20_who || '-')}</strong></div>
        <div><span class="label">Personagem</span><strong>${escapeHtml(event.character_name || event.payload?.targetCharacter || '-')}</strong></div>
        ${dice ? `<div><span class="label">Dado</span><strong>${escapeHtml([dice.formula || 'dados', dice.result !== null && dice.result !== undefined ? `= ${dice.result}` : ''].filter(Boolean).join(' '))}</strong></div>` : ''}
        <div><span class="label">Criado</span><strong>${escapeHtml(event.created_at_roll20 || event.created_at || '-')}</strong></div>
        ${note?.id ? `<div><span class="label">Nota</span><strong>${escapeHtml(note.review_status || note.note_type || note.id)}</strong></div>` : ''}
      </div>
      ${raw ? `<code>${escapeHtml(raw)}</code>` : ''}
      <div class="actions">
        <button ${canReviewRoll20Events() && !note?.id ? '' : 'disabled'} onclick="convertRoll20EventToNote('${escapeHtml(event.id)}')">${note?.id ? 'Nota criada' : 'Criar nota'}</button>
        ${note?.id ? `<button onclick="copyText('${escapeHtml(note.id)}', 'ID da nota copiado.')">Copiar nota</button>` : ''}
        <button onclick="copyText('${escapeHtml(event.source_event_id || event.id || '')}', 'ID Roll20 copiado.')">Copiar ID</button>
      </div>
    </article>
  `;
}

async function convertRoll20EventToNote(eventId) {
  if (!eventId) return;
  if (!canReviewRoll20Events()) {
    toast('Apenas DM, owner ou reviewer pode criar nota Roll20.');
    return;
  }
  try {
    setBusy(true);
    const payload = await api('/api/roll20-event-note', {
      method: 'POST',
      body: JSON.stringify({
        campaignSlug: state.review?.campaign?.slug || 'yuhara-main',
        sourceSessionId: state.review?.session?.sourceSessionId || state.selectedSourceSessionId,
        eventId
      })
    });
    toast('Nota criada a partir do evento Roll20.');
    remember('Nota Roll20 criada: ' + (payload.note?.id || eventId));
    if (state.selectedSourceSessionId) await loadSession(state.selectedSourceSessionId);
    if (window.notesState) window.notesState.loaded = false;
    if (window.loadNotesDirectory) await window.loadNotesDirectory(true);
  } catch (error) {
    toast(error.message);
  } finally {
    setBusy(false);
    render();
  }
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
          <h2>Esteira automatica</h2>
          <button onclick="refreshPipelineControl(true)">Atualizar</button>
        </div>
        ${window.renderPipelineControl ? window.renderPipelineControl('ops') : '<div class="empty">Modulo de esteira carregando.</div>'}
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
            <strong>${escapeHtml(eventTypeLabel(event.event_type))}</strong>
            <div class="badges">${badge(event.event_type || 'evento', eventTypeTone(event.event_type))}</div>
          </div>
          <small>${escapeHtml(event.roll20_who || 'Roll20')}</small>
          <p>${escapeHtml(roll20EventText(event))}</p>
        </div>
      `).join('')}
      ${events.length > 10 ? `<div class="empty">Mais ${events.length - 10} eventos na aba Roll20.</div>` : ''}
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
window.setSessionArchived = setSessionArchived;
window.uploadCraigFromForm = uploadCraigFromForm;
window.rememberCraigFileSelection = rememberCraigFileSelection;
window.continueUploadPipeline = continueUploadPipeline;
window.saveCraigTrack = saveCraigTrack;
window.initAuth = initAuth;
window.loadAuthProfile = loadAuthProfile;
window.convertRoll20EventToNote = convertRoll20EventToNote;
window.signInProvider = signInProvider;
window.signInDiscord = signInDiscord;
window.signInGoogle = signInGoogle;
window.signOutAuth = signOutAuth;
window.signOutGoogle = signOutAuth;
window.confirmClearDraft = confirmClearDraft;
window.setDateTimeNow = setDateTimeNow;
window.clearDateTime = clearDateTime;
window.setDiscordCursor = setDiscordCursor;
window.syncDiscordTimelineWithCursor = syncDiscordTimelineWithCursor;
window.openOperations = openOperations;
window.runUploadedCraigJob = runUploadedCraigJob;

boot();
