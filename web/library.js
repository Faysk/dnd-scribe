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
const userMenuButton = document.querySelector('#userMenuButton');
const userMenu = document.querySelector('#userMenu');
const editMenuLink = document.querySelector('#editMenuLink');
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
  const match = window.location.hash.match(/^#\/sessao\/([^/]+)(\/resumo)?$/);
  if (!match) return { name: 'home' };
  return {
    name: match[2] ? 'summary' : 'reader',
    sourceSessionId: decodeURIComponent(match[1])
  };
}

function authDisplayName(user = state.auth.user) {
  return state.auth.profile?.displayName
    || user?.user_metadata?.full_name
    || user?.user_metadata?.global_name
    || user?.user_metadata?.name
    || user?.email
    || 'Membro da mesa';
}

function showAuthenticatedHeader() {
  identity.textContent = authDisplayName();
  userMenuButton.hidden = false;
  editMenuLink.hidden = !state.auth.capabilities?.canOpenEdit;
}

function closeUserMenu() {
  userMenu.hidden = true;
  userMenuButton.setAttribute('aria-expanded', 'false');
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

async function downloadTranscript(sourceSessionId, title = 'sessao') {
  const token = await accessToken();
  const response = await fetch(
    `/api/session-download?campaignSlug=${encodeURIComponent(CAMPAIGN_SLUG)}&sourceSessionId=${encodeURIComponent(sourceSessionId)}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Erro HTTP ${response.status}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${String(title).replace(/[^a-z0-9áàâãéêíóôõúç_-]+/gi, '-').replace(/^-|-$/g, '') || 'sessao'}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  userMenuButton.hidden = true;
  userMenu.hidden = true;
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
  showAuthenticatedHeader();
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
  const safeCover = String(session.coverImageUrl || '').replaceAll("'", '%27').replaceAll(')', '%29');
  const cover = /^https:\/\//i.test(safeCover)
    ? ` style="--session-cover: url('${escapeHtml(safeCover)}')"`
    : '';
  return `
    <a class="session-card ${session.coverImageUrl ? 'has-cover' : ''}" href="${sourceRoute(session.sourceSessionId)}"${cover}>
      <div class="session-card-art" aria-hidden="true"><span>20</span></div>
      <div class="session-card-content">
        <div class="session-card-top">
          <span class="session-date">${escapeHtml(formatDate(session.sessionDate))}</span>
        </div>
        <h2>${escapeHtml(formatSessionTitle(session))}</h2>
        ${session.summary ? `<p class="session-summary">${escapeHtml(session.summary)}</p>` : ''}
        <div class="session-meta">
          ${metadata.map(item => `<span>${escapeHtml(item)}</span>`).join('')}
        </div>
      </div>
    </a>
  `;
}

function renderHome() {
  showAuthenticatedHeader();
  const segmentTotal = state.sessions.reduce((total, session) => total + Number(session.segments || 0), 0);
  app.innerHTML = `
    <section class="library-hero">
      <div>
        <span class="eyebrow">DnD Scribe</span>
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
      <div class="reader-actions">
        ${session.hasSummary ? `<a class="primary-button" href="${sourceRoute(session.sourceSessionId)}/resumo">Ler resumo</a>` : ''}
        <button class="secondary-button" type="button" data-download-transcript>Baixar transcrição .md</button>
      </div>
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

function renderSummary() {
  const session = state.reader.session;
  if (!session) return renderLoading('Abrindo o resumo…');
  app.innerHTML = `
    <article class="reader summary-reader">
      <a class="reader-back" href="${sourceRoute(session.sourceSessionId)}">← Voltar à transcrição</a>
      <header class="reader-title">
        <span class="eyebrow">Resumo da sessão</span>
        <h1>${escapeHtml(formatSessionTitle(session))}</h1>
        <div class="reader-actions">
          <button class="secondary-button" type="button" data-download-transcript>Baixar transcrição .md</button>
        </div>
      </header>
      <div class="summary-markdown">${renderMarkdown(session.summaryFull || '')}</div>
    </article>
  `;
}

function renderMarkdown(markdown) {
  const source = String(markdown || '').replace(/^[\u200B-\u200F\uFEFF]/, '');
  if (!window.marked?.parse || !window.DOMPurify?.sanitize) {
    return source.split(/\r?\n\r?\n/).map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('');
  }
  const html = window.marked.parse(source, {
    gfm: true,
    breaks: false
  });
  return window.DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true }
  });
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

async function loadSummary() {
  renderLoading('Abrindo o resumo…');
  const payload = await api(
    `/api/library-summary?campaignSlug=${encodeURIComponent(CAMPAIGN_SLUG)}&sourceSessionId=${encodeURIComponent(state.reader.sourceSessionId)}`
  );
  state.reader.session = payload.session;
  renderSummary();
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
    if (target.name === 'reader' || target.name === 'summary') {
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
      if (target.name === 'summary') {
        if (!state.reader.session?.summaryFull) await loadSummary();
        else renderSummary();
        return;
      }
      if (!state.reader.session || state.reader.session.summaryFull) await loadTranscript();
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
  if (event.target.closest('#userMenuButton')) {
    const opening = userMenu.hidden;
    userMenu.hidden = !opening;
    userMenuButton.setAttribute('aria-expanded', String(opening));
    return;
  }
  if (event.target.closest('#userMenu a, #userMenu button')) closeUserMenu();
  if (!userMenu.hidden && !event.target.closest('#userMenu')) closeUserMenu();
  if (event.target.closest('#signOutButton')) return signOut();
  if (event.target.closest('[data-download-transcript]')) {
    try {
      await downloadTranscript(state.reader.sourceSessionId, formatSessionTitle(state.reader.session));
      showToast('Download da transcrição iniciado.');
    } catch (error) {
      showToast(error.message);
    }
    return;
  }
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
  closeUserMenu();
  window.scrollTo({ top: 0, behavior: 'instant' });
  route();
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || userMenu.hidden) return;
  closeUserMenu();
  userMenuButton.focus();
});

initAuth();
