const CAMPAIGN_SLUG = 'yuhara-main';
const PAGE_SIZE = 120;

const state = {
  auth: {
    client: null,
    ready: false,
    user: null,
    profile: null,
    campaignRole: null,
    capabilities: null
  },
  sessions: [],
  sessionsLoaded: false,
  reader: {
    sourceSessionId: '',
    session: null,
    segments: [],
    speakers: [],
    total: 0,
    cursor: null,
    query: '',
    speaker: '',
    loading: false
  }
};

const app = document.querySelector('#app');
const identity = document.querySelector('#sessionIdentity');
const signOutButton = document.querySelector('#signOutButton');
const toast = document.querySelector('#toast');

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sourceRoute(sourceSessionId) {
  return `#/sessao/${encodeURIComponent(sourceSessionId)}`;
}

function currentRoute() {
  const match = window.location.hash.match(/^#\/sessao\/(.+)$/);
  return match
    ? { name: 'reader', sourceSessionId: decodeURIComponent(match[1]) }
    : { name: 'home' };
}

function authDisplayName(user = state.auth.user) {
  return state.auth.profile?.displayName
    || user?.user_metadata?.full_name
    || user?.user_metadata?.global_name
    || user?.user_metadata?.name
    || user?.email
    || 'Membro da mesa';
}

function statusLabel(status) {
  return {
    published: 'Publicada',
    approved: 'Aprovada',
    ready_for_review: 'Transcrição disponível',
    reviewing: 'Em revisão',
    processing: 'Processando',
    uploaded: 'Importada',
    archived: 'Arquivada'
  }[status] || 'No arquivo';
}

function formatSessionTitle(session = {}) {
  const raw = String(session.title || '').trim();
  if (!raw) return 'Sessão sem título';
  if (/^sess[aã]o craig /i.test(raw)) return `Sessão de ${formatDate(session.sessionDate)}`;
  if (/^\d{8}-sessao$/i.test(raw)) return `Sessão de ${formatDate(session.sessionDate)}`;
  return raw
    .replaceAll('_', ' ')
    .replace(/\bsessao\b/gi, 'Sessão')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDate(value) {
  if (!value) return 'Data não registrada';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function formatDuration(durationMs) {
  const totalMinutes = Math.round(Number(durationMs || 0) / 60000);
  if (!totalMinutes) return '';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h${String(minutes).padStart(2, '0')}` : `${minutes} min`;
}

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

async function accessToken() {
  if (!state.auth.client) return '';
  const { data, error } = await state.auth.client.auth.getSession();
  if (error) throw error;
  return data?.session?.access_token || '';
}

async function api(path, options = {}) {
  const token = await accessToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Erro HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function renderLoading(title = 'Abrindo as memórias…') {
  app.innerHTML = `
    <div class="loading-state">
      <span class="eyebrow">Arquivo da campanha</span>
      <h1>${escapeHtml(title)}</h1>
      <div class="loading-line" aria-hidden="true"></div>
    </div>
  `;
}

function renderLogin(error = '') {
  identity.hidden = true;
  signOutButton.hidden = true;
  app.innerHTML = `
    <section class="auth-card">
      <span class="eyebrow">Arquivo reservado</span>
      <h1>As histórias da mesa vivem aqui.</h1>
      <p>Entre com sua conta da campanha para consultar as sessões e ler todas as transcrições disponíveis.</p>
      ${error ? `<p class="error-message">${escapeHtml(error)}</p>` : ''}
      <div class="auth-actions">
        <button class="primary-button" type="button" data-login="discord">Entrar com Discord</button>
        <button class="secondary-button" type="button" data-login="google">Entrar com Google</button>
      </div>
    </section>
  `;
}

function renderPendingAccess() {
  identity.textContent = authDisplayName();
  identity.hidden = false;
  signOutButton.hidden = false;
  app.innerHTML = `
    <section class="auth-card">
      <span class="eyebrow">Acesso pendente</span>
      <h1>Você chegou ao arquivo.</h1>
      <p>Seu login está conectado, mas o perfil ainda precisa ser aprovado como membro da campanha.</p>
      <div class="auth-actions">
        <button class="secondary-button" type="button" data-refresh-access>Verificar novamente</button>
      </div>
    </section>
  `;
}

function sessionCard(session) {
  const metadata = [
    `${Number(session.segments || 0).toLocaleString('pt-BR')} falas`,
    Number(session.participants || 0) ? `${session.participants} participantes` : '',
    formatDuration(session.durationMs)
  ].filter(Boolean);
  return `
    <a class="session-card" href="${sourceRoute(session.sourceSessionId)}">
      <div>
        <div class="session-card-top">
          <span class="session-date">${escapeHtml(formatDate(session.sessionDate))}</span>
          <span class="status-pill">${escapeHtml(statusLabel(session.status))}</span>
        </div>
        <h2>${escapeHtml(formatSessionTitle(session))}</h2>
        ${session.summary ? `<p class="session-summary">${escapeHtml(session.summary)}</p>` : ''}
      </div>
      <div class="session-meta">
        ${metadata.map(item => `<span>${escapeHtml(item)}</span>`).join('')}
      </div>
    </a>
  `;
}

function renderHome() {
  identity.textContent = authDisplayName();
  identity.hidden = false;
  signOutButton.hidden = false;
  const segmentTotal = state.sessions.reduce((total, session) => total + Number(session.segments || 0), 0);
  app.innerHTML = `
    <section class="library-hero">
      <div>
        <span class="eyebrow">Campanha Yuhara</span>
        <h1>Nossas sessões</h1>
        <p class="lede">Um registro cronológico das escolhas, encontros e histórias construídas pela mesa.</p>
      </div>
      <div class="archive-count" aria-label="${state.sessions.length} sessões no arquivo">
        <strong>${state.sessions.length}</strong>
        <span>sessões · ${segmentTotal.toLocaleString('pt-BR')} falas</span>
      </div>
    </section>
    ${state.sessions.length
      ? `<section class="session-grid" aria-label="Sessões da campanha">${state.sessions.map(sessionCard).join('')}</section>`
      : `<section class="empty-state"><h2>Nenhuma sessão importada</h2><p>Quando uma transcrição for publicada, ela aparecerá aqui.</p></section>`}
  `;
}

function readerHeader(session) {
  const metadata = [
    formatDate(session.sessionDate),
    formatDuration(session.durationMs),
    `${state.reader.total.toLocaleString('pt-BR')} falas`
  ].filter(Boolean);
  return `
    <a class="reader-back" href="#/" aria-label="Voltar para todas as sessões">← Todas as sessões</a>
    <header class="reader-title">
      <span class="eyebrow">${escapeHtml(session.arc || 'Transcrição da sessão')}</span>
      <h1>${escapeHtml(formatSessionTitle(session))}</h1>
      <div class="reader-meta">${metadata.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
      ${session.summary ? `<p class="reader-summary">${escapeHtml(session.summary)}</p>` : ''}
    </header>
  `;
}

function transcriptRow(segment) {
  return `
    <li class="transcript-row" id="fala-${escapeHtml(segment.id)}">
      <time class="transcript-time" datetime="PT${Math.floor(Number(segment.startMs || 0) / 1000)}S">${escapeHtml(formatTime(segment.startMs))}</time>
      <strong class="transcript-speaker">${escapeHtml(segment.speaker)}</strong>
      <p class="transcript-text">${escapeHtml(segment.text)}</p>
    </li>
  `;
}

function renderReader() {
  const reader = state.reader;
  if (!reader.session) {
    renderLoading('Preparando a sessão…');
    return;
  }
  const loadedLabel = reader.query || reader.speaker
    ? `${reader.segments.length.toLocaleString('pt-BR')} resultado${reader.segments.length === 1 ? '' : 's'}`
    : `${reader.segments.length.toLocaleString('pt-BR')} de ${reader.total.toLocaleString('pt-BR')} falas`;
  app.innerHTML = `
    <article class="reader">
      ${readerHeader(reader.session)}
      <div class="transcript-tools">
        <form class="search-form" id="transcriptSearch">
          <label class="sr-only" for="searchInput">Buscar na transcrição</label>
          <input id="searchInput" name="q" type="search" maxlength="120" value="${escapeHtml(reader.query)}" placeholder="Buscar nesta sessão…" autocomplete="off" />
          <button class="icon-button" type="submit" aria-label="Buscar">⌕</button>
        </form>
        <label>
          <span class="sr-only">Filtrar por personagem</span>
          <select class="speaker-select" id="speakerFilter">
            <option value="">Todas as vozes</option>
            ${reader.speakers.map(speaker => `<option value="${escapeHtml(speaker)}" ${speaker === reader.speaker ? 'selected' : ''}>${escapeHtml(speaker)}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="transcript-status">
        <span>${escapeHtml(loadedLabel)}</span>
        ${(reader.query || reader.speaker) ? '<button class="text-button" type="button" data-clear-filters>Limpar filtros</button>' : ''}
      </div>
      <ol class="transcript-list" id="transcriptList">${reader.segments.map(transcriptRow).join('')}</ol>
      ${reader.cursor ? `
        <div class="load-more">
          <button class="secondary-button" type="button" data-load-more ${reader.loading ? 'disabled' : ''}>
            ${reader.loading ? 'Carregando…' : 'Carregar mais falas'}
          </button>
        </div>
      ` : ''}
      ${!reader.segments.length ? '<section class="empty-state"><h2>Nenhuma fala encontrada</h2><p>Tente outro termo ou remova o filtro de personagem.</p></section>' : ''}
    </article>
  `;
}

function renderError(error, retry = 'route') {
  app.innerHTML = `
    <section class="error-state">
      <span class="eyebrow">Algo interrompeu a leitura</span>
      <h1>Não conseguimos abrir o arquivo.</h1>
      <p>Tente novamente. Nenhum conteúdo local ou áudio foi alterado.</p>
      <code>${escapeHtml(error?.message || String(error))}</code>
      <div class="auth-actions">
        <button class="secondary-button" type="button" data-retry="${escapeHtml(retry)}">Tentar novamente</button>
        <a class="primary-button" href="#/">Voltar às sessões</a>
      </div>
    </section>
  `;
}

async function loadProfile() {
  const payload = await api(`/api/auth/me?campaignSlug=${encodeURIComponent(CAMPAIGN_SLUG)}`);
  state.auth.profile = payload.profile || null;
  state.auth.campaignRole = payload.campaignRole || null;
  state.auth.capabilities = payload.capabilities || null;
  return payload;
}

async function loadSessions(force = false) {
  if (state.sessionsLoaded && !force) return;
  const payload = await api(`/api/library-sessions?campaignSlug=${encodeURIComponent(CAMPAIGN_SLUG)}`);
  state.sessions = payload.sessions || [];
  state.sessionsLoaded = true;
}

async function loadTranscript({ append = false } = {}) {
  const reader = state.reader;
  if (reader.loading) return;
  reader.loading = true;
  if (!append) {
    reader.segments = [];
    reader.cursor = null;
  }
  renderReader();
  const params = new URLSearchParams({
    campaignSlug: CAMPAIGN_SLUG,
    sourceSessionId: reader.sourceSessionId,
    limit: String(PAGE_SIZE)
  });
  if (append && reader.cursor) params.set('cursor', reader.cursor);
  if (reader.query) params.set('q', reader.query);
  if (reader.speaker) params.set('speaker', reader.speaker);
  try {
    const payload = await api(`/api/library-transcript?${params}`);
    reader.session = payload.session;
    reader.speakers = payload.speakers || [];
    reader.total = Number(payload.total || 0);
    reader.segments = append
      ? [...reader.segments, ...(payload.segments || [])]
      : (payload.segments || []);
    reader.cursor = payload.nextCursor || null;
  } finally {
    reader.loading = false;
  }
  renderReader();
}

async function route() {
  if (!state.auth.ready) return;
  if (!state.auth.user) {
    renderLogin();
    return;
  }
  if (!state.auth.campaignRole) {
    renderPendingAccess();
    return;
  }
  const target = currentRoute();
  try {
    if (target.name === 'reader') {
      const changed = state.reader.sourceSessionId !== target.sourceSessionId;
      if (changed) {
        state.reader = {
          sourceSessionId: target.sourceSessionId,
          session: null,
          segments: [],
          speakers: [],
          total: 0,
          cursor: null,
          query: '',
          speaker: '',
          loading: false
        };
      }
      if (!state.reader.session) await loadTranscript();
      else renderReader();
      return;
    }
    await loadSessions();
    renderHome();
  } catch (error) {
    renderError(error);
  }
}

async function signIn(provider) {
  if (!state.auth.client) return;
  const { error } = await state.auth.client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/` }
  });
  if (error) renderLogin(error.message);
}

async function signOut() {
  if (!state.auth.client) return;
  await state.auth.client.auth.signOut();
  state.sessions = [];
  state.sessionsLoaded = false;
  window.location.hash = '#/';
}

async function initAuth() {
  renderLoading();
  try {
    const response = await fetch('/api/auth-config');
    const config = await response.json();
    if (!response.ok || !config.supabaseUrl || !config.publishableKey) {
      throw new Error(config.error || 'Configuração de login indisponível.');
    }
    if (!window.supabase) throw new Error('Cliente de autenticação não carregado.');
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
    if (state.auth.user) await loadProfile();
    state.auth.ready = true;
    state.auth.client.auth.onAuthStateChange((event, session) => {
      const previousUserId = state.auth.user?.id || null;
      const nextUserId = session?.user?.id || null;
      state.auth.user = session?.user || null;
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      window.setTimeout(async () => {
        try {
          if (nextUserId && nextUserId !== previousUserId) await loadProfile();
          if (!nextUserId) {
            state.auth.profile = null;
            state.auth.campaignRole = null;
            state.auth.capabilities = null;
          }
          await route();
        } catch (authError) {
          renderError(authError);
        }
      }, 0);
    });
    await route();
  } catch (error) {
    state.auth.ready = true;
    renderLogin(error.message);
  }
}

document.addEventListener('click', async event => {
  const loginButton = event.target.closest('[data-login]');
  if (loginButton) return signIn(loginButton.dataset.login);
  if (event.target.closest('#signOutButton')) return signOut();
  if (event.target.closest('[data-refresh-access]')) {
    renderLoading('Verificando seu acesso…');
    try {
      await loadProfile();
      await route();
    } catch (error) {
      renderError(error);
    }
    return;
  }
  if (event.target.closest('[data-load-more]')) {
    try {
      await loadTranscript({ append: true });
    } catch (error) {
      showToast(error.message);
      state.reader.loading = false;
      renderReader();
    }
    return;
  }
  if (event.target.closest('[data-clear-filters]')) {
    state.reader.query = '';
    state.reader.speaker = '';
    try {
      await loadTranscript();
    } catch (error) {
      renderError(error);
    }
    return;
  }
  const retry = event.target.closest('[data-retry]');
  if (retry) {
    renderLoading();
    await route();
  }
});

document.addEventListener('submit', async event => {
  if (event.target.id !== 'transcriptSearch') return;
  event.preventDefault();
  state.reader.query = new FormData(event.target).get('q')?.trim() || '';
  try {
    await loadTranscript();
  } catch (error) {
    renderError(error);
  }
});

document.addEventListener('change', async event => {
  if (event.target.id !== 'speakerFilter') return;
  state.reader.speaker = event.target.value;
  try {
    await loadTranscript();
  } catch (error) {
    renderError(error);
  }
});

window.addEventListener('hashchange', () => {
  window.scrollTo({ top: 0, behavior: 'instant' });
  route();
});

initAuth();
