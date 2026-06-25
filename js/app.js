const DATA = window.DND_SCRIBE;
const state = {
  currentUserId: localStorage.getItem('dnd_scribe_current_user') || null,
  view: 'dashboard',
  query: '',
  reviewFilter: 'all',
  reviewQuery: '',
  reviewSpeaker: 'all',
  reviewStatus: 'all',
  selectedReviewSegmentId: null
};

const USER_TRACK_KEYS = {
  yuhara: 'renanyuhara',
  renan: 'faysk',
  arthur: 'arutorux',
  fernanda: 'sunnrq'
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function user() {
  return DATA.users.find(u => u.id === state.currentUserId) || null;
}

function byUser(id) {
  return DATA.users.find(u => u.id === id);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function jsArg(value = '') {
  return JSON.stringify(String(value)).replaceAll('</', '<\\/');
}

function safeDomId(value = '') {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function canView(item, current = user()) {
  if (!current || !item) return false;
  if (item.visibleTo && item.visibleTo.includes(current.id)) return true;
  if (item.access === 'party' || item.access === 'party_private') return true;
  if (item.access === 'dm_only') return current.role === 'dm';
  if (item.access === 'owner_only') return item.owner === current.id || current.role === 'dm';
  if (item.access === 'owner_dm') return item.owner === current.id || current.role === 'dm';
  if (item.access === 'shared') return item.visibleTo?.includes(current.id) || current.role === 'dm';
  return false;
}

function visible(list) {
  return list.filter(item => canView(item));
}

function badge(text, color = 'default') {
  return `<span class="badge ${color}">${escapeHtml(text)}</span>`;
}

function tags(list = []) {
  return `<div class="tags">${list.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}</div>`;
}

function progress(value) {
  return `<div class="progress"><span style="width:${Number(value) || 0}%"></span></div>`;
}

function realReviewData() {
  return window.DND_SCRIBE_REAL_REVIEW || null;
}

function fmtDuration(ms = 0) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

function fmtBytes(bytes = 0) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function reviewStoreKey() {
  const data = realReviewData();
  return `dnd_scribe_review_board_${data?.session?.sourceSessionId || 'mock'}`;
}

function loadReviewStore() {
  try {
    return JSON.parse(localStorage.getItem(reviewStoreKey()) || '{}');
  } catch {
    return {};
  }
}

function saveReviewStore(store) {
  localStorage.setItem(reviewStoreKey(), JSON.stringify(store));
}

function candidateReviewStoreKey() {
  const data = realReviewData();
  return `dnd_scribe_candidate_review_${data?.session?.sourceSessionId || 'mock'}_${data?.ai?.runId || 'manual'}`;
}

function loadCandidateReviewStore() {
  try {
    return JSON.parse(localStorage.getItem(candidateReviewStoreKey()) || '{}');
  } catch {
    return {};
  }
}

function saveCandidateReviewStore(store) {
  localStorage.setItem(candidateReviewStoreKey(), JSON.stringify(store));
}

function candidateStoreKey(targetType, sourceCandidateId) {
  return `${targetType}:${sourceCandidateId}`;
}

function candidateDecision(targetType, item) {
  const sourceCandidateId = item.source_candidate_id;
  const saved = loadCandidateReviewStore()[candidateStoreKey(targetType, sourceCandidateId)];
  if (saved) return saved;
  return {
    targetType,
    sourceCandidateId,
    decision: item.status || 'candidate',
    note: '',
    approvedForPublic: false,
    updatedAt: null
  };
}

function reviewDecision(segment) {
  const saved = loadReviewStore()[segment.id];
  if (saved) return saved;
  const ai = segment.ai || {};
  const flags = ai.metadata?.candidate_flags || {};
  let status = segment.needs_review ? 'needs_review' : segment.review_status || 'pending';
  if (flags.canon) status = 'canon_candidate';
  else if (flags.quote) status = 'quote_candidate';
  else if (flags.outtake) status = 'outtake';
  else if (ai.needs_review) status = 'needs_review';
  return {
    status,
    characterName: segment.character_name || '',
    textOverride: '',
    note: '',
    updatedAt: null
  };
}

function reviewStatusMeta(status) {
  const labels = {
    pending: ['Pendente', 'blue'],
    needs_review: ['Revisar speaker', 'orange'],
    approved: ['Aprovado', 'green'],
    canon_candidate: ['Canon?', 'gold'],
    quote_candidate: 'Fala',
    outtake: ['Bastidor', 'purple'],
    private_note: ['Privado', 'red'],
    rejected: ['Rejeitado', 'red']
  };
  const value = labels[status] || [status, 'default'];
  return Array.isArray(value) ? value : [value, 'purple'];
}

function reviewStatusBadge(status) {
  const [label, color] = reviewStatusMeta(status);
  return badge(label, color);
}

function candidateDecisionMeta(decision) {
  const labels = {
    candidate: ['Candidato', 'blue'],
    approved: ['Aprovado', 'green'],
    approved_canon: ['Canon aprovado', 'green'],
    approved_by_speaker: ['Speaker ok', 'green'],
    approved_by_all: ['Mesa ok', 'green'],
    rejected: ['Rejeitado', 'red'],
    private: ['Privado', 'red'],
    interpretation: ['Interpretação', 'purple'],
    possible_hook: ['Gancho', 'gold'],
    retcon_pending: ['Retcon?', 'orange']
  };
  return labels[decision] || [decision || 'Candidato', 'default'];
}

function candidateDecisionBadge(decision) {
  const [label, color] = candidateDecisionMeta(decision);
  return badge(label, color);
}

function reviewSegmentById(id) {
  return realReviewData()?.segments?.find(segment => segment.id === id) || null;
}

function avatar(u, size = '') {
  return `<div class="avatar ${size} ${u.color || ''}">${escapeHtml(u.avatar)}</div>`;
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
}

function openModal(html) {
  $('#modalBody').innerHTML = html;
  $('#modalBackdrop').classList.remove('hidden');
}

function closeModal() {
  $('#modalBackdrop').classList.add('hidden');
}

function setUser(userId) {
  state.currentUserId = userId;
  localStorage.setItem('dnd_scribe_current_user', userId);
  renderShell();
}

function logout() {
  state.currentUserId = null;
  localStorage.removeItem('dnd_scribe_current_user');
  renderShell();
}

function setView(view) {
  state.view = view;
  $$('#nav button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  renderView();
  if (window.innerWidth <= 1180) {
    window.setTimeout(() => window.scrollTo({ top: $('.main')?.offsetTop || 0, behavior: 'auto' }), 0);
  }
}

function boot() {
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', event => {
    if (event.target.id === 'modalBackdrop') closeModal();
  });
  $('#logoutBtn')?.addEventListener('click', logout);
  $('#quickMarkerBtn')?.addEventListener('click', () => openQuickMarkerModal());
  $('#newSecretBtn')?.addEventListener('click', () => openNewSecretModal());
  $('#nav')?.addEventListener('click', event => {
    const btn = event.target.closest('button[data-view]');
    if (btn) setView(btn.dataset.view);
  });
  renderShell();
}

function renderShell() {
  if (!user()) {
    $('#loginScreen').classList.remove('hidden');
    $('#appShell').classList.add('hidden');
    renderLoginUsers();
    return;
  }

  $('#loginScreen').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  renderCurrentUserCard();
  renderView();
}

function renderLoginUsers() {
  $('#loginUsers').innerHTML = DATA.users.map(u => `
    <button class="login-user" data-login="${u.id}">
      ${avatar(u, 'big')}
      <div>
        <strong>${escapeHtml(u.displayName)}</strong>
        <span>${escapeHtml(u.email)}</span>
        <p>${escapeHtml(u.loginNote)}</p>
        ${u.role === 'dm' ? badge('DM / Mestre', 'gold') : badge('Player', u.color)}
      </div>
    </button>
  `).join('');

  $$('#loginUsers [data-login]').forEach(btn => {
    btn.addEventListener('click', () => setUser(btn.dataset.login));
  });
}

function renderCurrentUserCard() {
  const u = user();
  $('#currentUserCard').innerHTML = `
    <div class="row between">
      <div class="row">
        ${avatar(u)}
        <div>
          <strong>${escapeHtml(u.displayName)}</strong>
          <span>${escapeHtml(u.email)}</span>
        </div>
      </div>
      ${badge(u.role === 'dm' ? 'DM' : 'Player', u.color)}
    </div>
    <p>${escapeHtml(u.loginNote)}</p>
    <button class="mini-switch" onclick="openAccountSwitcher()">Trocar conta Google simulada</button>
  `;
}

window.openAccountSwitcher = function openAccountSwitcher() {
  openModal(`
    <span class="eyebrow">Login Google simulado</span>
    <h2>Escolher conta da mesa</h2>
    <p>Na versão real, isso vira Supabase Auth + Google Provider. Aqui é só simulação para testar permissões sem precisar invocar entidade OAuth no círculo de giz.</p>
    <div class="account-grid">
      ${DATA.users.map(u => `
        <button class="account-option" onclick="setUser('${u.id}'); closeModal();">
          ${avatar(u)}
          <strong>${escapeHtml(u.displayName)}</strong>
          <span>${escapeHtml(u.role === 'dm' ? 'Mestre' : u.character)}</span>
        </button>
      `).join('')}
    </div>
  `);
};

window.setUser = setUser;
window.closeModal = closeModal;

function setTitle(title, eyebrow = 'DnD Scribe') {
  $('#viewTitle').textContent = title;
  $('#viewEyebrow').textContent = eyebrow;
}

function renderView() {
  const routes = {
    dashboard: renderDashboard,
    login: renderLoginAdmin,
    capture: renderCapture,
    review: renderReview,
    transcript: renderTranscript,
    secrets: renderSecrets,
    knowledge: renderKnowledge,
    canon: renderCanon,
    outtakes: renderOuttakes,
    publications: renderPublications,
    entities: renderEntities,
    stage: renderStage,
    admin: renderAdmin,
    pipeline: renderPipeline
  };
  (routes[state.view] || renderDashboard)();
}

function statCard(number, label, color = 'gold') {
  return `<section class="card stat-card"><i class="accent ${color}"></i><strong>${escapeHtml(number)}</strong><span>${escapeHtml(label)}</span></section>`;
}

function renderDashboard() {
  const u = user();
  const visibleSecrets = visible(DATA.secrets);
  const visibleCanon = visible(DATA.canonEntries);
  const visibleCandidates = visible(DATA.candidates);
  const privateDiary = DATA.secrets.filter(s => s.owner === u.id && s.access === 'owner_only').length;
  setTitle('Agora', `Logado como ${u.displayName}`);

  $('#view').innerHTML = `
    <section class="hero-card">
      <div>
        <span class="eyebrow">${escapeHtml(DATA.session.arc)}</span>
        <h2>${escapeHtml(DATA.session.title)}</h2>
        <p>${escapeHtml(DATA.session.goal)}</p>
        <div class="row">
          ${badge(DATA.session.status, 'orange')}
          ${badge(DATA.session.duration, 'blue')}
          ${badge(DATA.session.scene, 'purple')}
        </div>
      </div>
      <div class="rule-card">
        <strong>${escapeHtml(DATA.meta.tagline)}</strong>
        <span>${escapeHtml(DATA.meta.operationalRule)}</span>
      </div>
    </section>

    <div class="grid cols-4">
      ${statCard(visibleSecrets.length, 'segredos visíveis para você', 'purple')}
      ${statCard(visibleCanon.length, 'entradas de canon visíveis', 'gold')}
      ${statCard(visibleCandidates.length, 'candidatos para revisar', 'orange')}
      ${statCard(privateDiary, 'diários pessoais seus', 'red')}
    </div>

    <div class="grid cols-2">
      <section class="card">
        <div class="card-header">
          <div>
            <h2>Próximas ações recomendadas</h2>
            <p>O MVP precisa provar que o sistema consegue capturar, separar e auditar sem virar bagunça de taverna.</p>
          </div>
          ${badge('MVP', 'green')}
        </div>
        <div class="checklist">
          <label><input type="checkbox" checked> Login Google por usuário</label>
          <label><input type="checkbox" checked> Segredo: sistema vs ficção separados</label>
          <label><input type="checkbox" checked> Diário privado sem DM</label>
          <label><input type="checkbox"> Upload real de Craig/OBS/Roll20</label>
          <label><input type="checkbox"> Worker de transcrição</label>
          <label><input type="checkbox"> Review com áudio por timestamp</label>
        </div>
      </section>

      <section class="card">
        <h2>Pipeline da sessão</h2>
        <div class="pipeline-mini">
          ${DATA.captureSources.map(s => `
            <div>
              <div class="row between"><strong>${escapeHtml(s.name)}</strong>${badge(s.status, s.color)}</div>
              ${progress(s.progress)}
              <p>${escapeHtml(s.detail)}</p>
            </div>
          `).join('')}
        </div>
      </section>
    </div>

    <section class="card">
      <div class="card-header">
        <div>
          <h2>Itens importantes visíveis para ${escapeHtml(u.name)}</h2>
          <p>Troque de conta na sidebar para ver informações sumirem/aparecerem conforme permissões.</p>
        </div>
        <button class="ghost" onclick="setView('secrets')">Ver segredos</button>
      </div>
      <div class="grid cols-3">
        ${visibleSecrets.slice(0, 3).map(secretCard).join('') || empty('Nada visível para esse usuário.')}
      </div>
    </section>
  `;
}

function renderLoginAdmin() {
  setTitle('Login & Players', 'Google Auth simulado');
  $('#view').innerHTML = `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Contas da mesa</h2>
          <p>Cada pessoa entra com Google. O usuário logado determina o que aparece no sistema e o que pode ser editado.</p>
        </div>
        ${badge('Supabase Auth + Google na versão real', 'blue')}
      </div>
      <div class="grid cols-4">
        ${DATA.users.map(u => `
          <article class="profile-card ${u.id === user().id ? 'selected' : ''}">
            ${avatar(u, 'huge')}
            <h3>${escapeHtml(u.displayName)}</h3>
            <p>${escapeHtml(u.email)}</p>
            <div class="row">${badge(u.role === 'dm' ? 'DM' : 'Player', u.color)}${badge(u.character, 'default')}</div>
            <button class="small-btn" onclick="setUser('${u.id}')">Entrar como</button>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="card">
      <h2>Como vai funcionar no projeto real</h2>
      <div class="grid cols-3">
        <div class="info-box"><strong>1. Login Google</strong><p>Supabase Auth autentica a pessoa com Google e vincula ao perfil da mesa.</p></div>
        <div class="info-box"><strong>2. Perfil da campanha</strong><p>O sistema associa conta ao player, personagem e permissões.</p></div>
        <div class="info-box"><strong>3. RLS no Supabase</strong><p>As políticas do banco impedem acesso a segredos fora da audiência permitida.</p></div>
      </div>
    </section>
  `;
}

function renderCapture() {
  setTitle('Captura', 'Craig + OBS + Roll20 Pro + Discord');
  $('#view').innerHTML = `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Fontes da sessão</h2>
          <p>O objetivo é registrar tudo, mas publicar só o que sobreviver à revisão. Coisa bonita, quase civilizada.</p>
        </div>
        ${badge('Auditável por timestamp', 'gold')}
      </div>
      <div class="stack">
        ${DATA.captureSources.map(src => `
          <div class="capture-row">
            <div>
              <h3>${escapeHtml(src.name)}</h3>
              <p>${escapeHtml(src.detail)}</p>
            </div>
            <div class="capture-progress">${progress(src.progress)}</div>
            ${badge(src.status, src.color)}
          </div>
        `).join('')}
      </div>
    </section>

    <div class="grid cols-3">
      <section class="card"><h2>Antes</h2><p>Criar sessão, confirmar consentimento, iniciar Craig, ligar OBS e ativar Roll20 Logger.</p>${tags(['setup', 'consentimento', 'fontes'])}</section>
      <section class="card"><h2>Durante</h2><p>Usar marcadores: CANON, FALA, SEGREDO, BASTIDOR, CORTAR e DÚVIDA.</p>${tags(['notas', 'marcadores', 'tempo-real'])}</section>
      <section class="card"><h2>Depois</h2><p>Upload dos arquivos, transcrição, classificação, revisão humana e publicação limpa.</p>${tags(['upload', 'ia', 'revisao'])}</section>
    </div>

    <section class="card">
      <h2>Comandos de mesa sugeridos</h2>
      <pre class="code">/note CANON: o povo começou a cantar baixo
/note SEGREDO: Astel recebeu resposta fraca de Hugin
/note BASTIDOR: piada boa fora de personagem
!dnd scene Praça do Duelo
!dnd secret shared renan,fernanda Sinal para iniciar performance
!dnd canon-candidate Ivory tenta manipular as regras do duelo</pre>
    </section>
  `;
}

function renderReview() {
  const data = realReviewData();
  if (!data) {
    renderMockReview();
    return;
  }

  const store = loadReviewStore();
  const candidateStore = loadCandidateReviewStore();
  const speakers = [{ track_key: 'all', speaker_name: 'Todos', character_name: '' }, ...(data.tracks || [])];
  const statuses = ['all', 'pending', 'needs_review', 'approved', 'canon_candidate', 'quote_candidate', 'outtake', 'private_note', 'rejected'];
  const query = state.reviewQuery.trim().toLowerCase();
  const segments = (data.segments || []).filter(segment => {
    const decision = reviewDecision(segment);
    const text = [
      segment.text,
      segment.speaker_name,
      segment.character_name,
      decision.characterName,
      decision.textOverride,
      segment.track_key,
      ...(segment.tags || [])
    ].join(' ').toLowerCase();
    const speakerOk = state.reviewSpeaker === 'all' || segment.track_key === state.reviewSpeaker;
    const statusOk = state.reviewStatus === 'all' || decision.status === state.reviewStatus;
    const queryOk = !query || text.includes(query);
    return speakerOk && statusOk && queryOk;
  });

  if (!state.selectedReviewSegmentId || !segments.some(segment => segment.id === state.selectedReviewSegmentId)) {
    state.selectedReviewSegmentId = segments[0]?.id || data.segments?.[0]?.id || null;
  }
  const selected = reviewSegmentById(state.selectedReviewSegmentId) || segments[0] || data.segments?.[0];
  const selectedDecision = selected ? reviewDecision(selected) : null;
  const decisions = Object.values(store);
  const candidateDecisions = Object.values(candidateStore);
  const approvedCount = decisions.filter(item => item.status === 'approved').length;
  const changedCount = decisions.length + candidateDecisions.length;
  const aiSummary = data.ai?.summary || {};

  setTitle('Review Board', `${data.campaign.name} • ${data.session.sourceSessionId}`);

  $('#view').innerHTML = `
    <section class="review-hero">
      <div>
        <span class="eyebrow">${escapeHtml(data.session.status)} • ${escapeHtml(data.session.date || 'sem data')}</span>
        <h2>${escapeHtml(data.session.title)}</h2>
        <p>${escapeHtml(data.session.summary || 'Sessão importada do Craig e pronta para revisão humana.')}</p>
        <div class="row">
          ${badge(`${data.summary.segments} segmentos`, 'blue')}
          ${badge(`${data.summary.participants} participantes`, 'green')}
          ${badge(fmtDuration(data.summary.durationMs), 'gold')}
          ${badge(`${data.summary.words} palavras`, 'purple')}
        </div>
        <div class="review-actions">
          <button class="small-btn" onclick="copyReviewDecisionExport()">Copiar decisões</button>
          <button class="small-btn" onclick="downloadReviewDecisionExport()">Baixar JSON</button>
        </div>
      </div>
      <div class="review-kpis">
        <div><strong>${changedCount}</strong><span>decisões locais</span></div>
        <div><strong>${approvedCount}</strong><span>aprovados</span></div>
        <div><strong>${aiSummary.canonCandidates || 0}</strong><span>canon IA</span></div>
        <div><strong>${(aiSummary.quoteCandidates || 0) + (aiSummary.outtakeCandidates || 0)}</strong><span>falas/bastidores IA</span></div>
      </div>
    </section>

    ${reviewCandidateStrip(data)}

    <section class="review-toolbar">
      <label>
        <span>Busca</span>
        <input placeholder="Buscar texto, personagem, speaker ou tag..." value="${escapeHtml(state.reviewQuery)}" oninput="state.reviewQuery=this.value; renderView();" />
      </label>
      <div>
        <span class="filter-label">Speaker</span>
        <div class="filter-grid">
          ${speakers.map(speaker => `
            <button class="chip ${state.reviewSpeaker === speaker.track_key ? 'active' : ''}" onclick="setReviewSpeaker('${escapeHtml(speaker.track_key)}')">
              ${escapeHtml(speaker.track_key === 'all' ? 'todos' : speaker.speaker_name || speaker.track_key)}
            </button>
          `).join('')}
        </div>
      </div>
      <div>
        <span class="filter-label">Status</span>
        <div class="filter-grid">
          ${statuses.map(status => {
            const [label] = status === 'all' ? ['Todos'] : reviewStatusMeta(status);
            return `<button class="chip ${state.reviewStatus === status ? 'active' : ''}" onclick="setReviewStatus('${status}')">${escapeHtml(label)}</button>`;
          }).join('')}
        </div>
      </div>
    </section>

    <section class="real-review-layout">
      <aside class="review-panel">
        <div class="panel-title">
          <h2>Timeline</h2>
          <span>${segments.length}/${data.segments.length}</span>
        </div>
        <div class="timeline-list real">
          ${segments.map(segment => {
            const decision = reviewDecision(segment);
            return `
              <button class="timeline-button ${segment.id === state.selectedReviewSegmentId ? 'active' : ''}" onclick="selectReviewSegment('${segment.id}')">
                <strong>${fmtDuration(segment.start_ms)}</strong>
                <span>${escapeHtml(decision.characterName || segment.character_name || segment.track_key)}</span>
                <small>${escapeHtml(segment.speaker_name || segment.track_key)} • ${reviewStatusMeta(decision.status)[0]}</small>
              </button>
            `;
          }).join('') || empty('Nenhum segmento nesse filtro.')}
        </div>
      </aside>

      <section class="review-panel transcript-panel">
        <div class="panel-title">
          <h2>Transcrição</h2>
          <span>${escapeHtml(data.exportedAt ? `export ${data.exportedAt.slice(0, 10)}` : 'local')}</span>
        </div>
        <div class="review-segment-list">
          ${segments.map(segment => reviewSegmentRow(segment)).join('') || empty('Nada para revisar com os filtros atuais.')}
        </div>
      </section>

      <aside class="review-panel detail-panel">
        ${selected ? reviewDetailPanel(selected, selectedDecision) : empty('Selecione um segmento.')}
      </aside>
    </section>
  `;
}

function renderMockReview() {
  const segments = visible(DATA.transcriptSegments).filter(seg => state.reviewFilter === 'all' || seg.type === state.reviewFilter || seg.access === state.reviewFilter);
  const candidates = visible(DATA.candidates);
  setTitle('Revisão IA', 'Canon, segredo, bastidor ou lixo?');

  $('#view').innerHTML = `
    <section class="review-layout">
      <aside class="card">
        <h2>Timeline visível</h2>
        <div class="filter-grid">
          ${['all', 'party', 'owner_dm', 'shared', 'owner_only', 'dm_only'].map(filter => `<button class="chip ${state.reviewFilter === filter ? 'active' : ''}" onclick="state.reviewFilter='${filter}'; renderView();">${filter}</button>`).join('')}
        </div>
        <div class="timeline-list">
          ${segments.map(seg => `
            <button class="timeline-button" onclick="focusSegment('${seg.id}')">
              <strong>${escapeHtml(seg.time)}</strong>
              <span>${escapeHtml(seg.character)}</span>
            </button>
          `).join('') || empty('Sem segmentos visíveis nesse filtro.')}
        </div>
      </aside>

      <section class="card">
        <div class="card-header"><div><h2>Transcrição auditável</h2><p>Cada trecho mostra fonte, audiência e quem sabe na ficção.</p></div>${badge('visão: ' + user().displayName, user().color)}</div>
        <div class="audio-wave"><span></span><span></span><span></span><span></span><span></span></div>
        <div class="stack" id="reviewSegments">
          ${segments.map(segmentCard).join('') || empty('Nada para revisar nesse perfil.')}
        </div>
      </section>

      <aside class="card">
        <h2>Candidatos da IA</h2>
        <p>A IA sugere. A mesa/DM decide. Esse é o cinto de segurança contra lore inventada na base do freestyle.</p>
        <div class="stack">
          ${candidates.map(candidateCard).join('') || empty('Nenhum candidato visível.')}
        </div>
      </aside>
    </section>
  `;
}

function reviewCandidateStrip(data) {
  const canon = data.ai?.canonCandidates || [];
  const quotes = data.ai?.quoteCandidates || [];
  const outtakes = data.ai?.outtakeCandidates || [];
  const items = [
    ...canon.map(item => ({ targetType: 'canon_candidates', sourceCandidateId: item.source_candidate_id, kind: 'Canon', color: 'gold', title: item.title, body: item.claim, source: item.source_segment_ids, raw: item })),
    ...quotes.map(item => ({ targetType: 'quote_candidates', sourceCandidateId: item.source_candidate_id, kind: 'Fala', color: 'purple', title: item.character_name || 'Fala candidata', body: item.quote_text, source: item.source_segment_ids, raw: item })),
    ...outtakes.map(item => ({ targetType: 'outtake_candidates', sourceCandidateId: item.source_candidate_id, kind: 'Bastidor', color: 'orange', title: item.title, body: item.description, source: item.source_segment_ids, raw: item })),
  ];
  if (!items.length) return '';
  return `
    <section class="ai-candidate-strip">
      <div class="panel-title">
        <h2>Candidatos da IA</h2>
        <span>${escapeHtml(data.ai?.runId || 'sem run')}</span>
      </div>
      <div class="ai-candidate-grid">
        ${items.map(item => {
          const decision = candidateDecision(item.targetType, item.raw);
          const noteId = `candidate_note_${safeDomId(item.targetType)}_${safeDomId(item.sourceCandidateId)}`;
          return `
          <article class="ai-candidate-card">
            <div class="row between">
              <strong>${escapeHtml(item.title || item.kind)}</strong>
              <div class="row">${badge(item.kind, item.color)}${candidateDecisionBadge(decision.decision)}</div>
            </div>
            <p>${escapeHtml(item.body || '')}</p>
            <small>${escapeHtml((item.source || []).join(', '))}</small>
            <textarea id="${noteId}" class="candidate-note" placeholder="Nota">${escapeHtml(decision.note || '')}</textarea>
            ${candidateDecisionActions(item)}
          </article>
        `;
        }).join('')}
      </div>
    </section>
  `;
}

function candidateDecisionActions(item) {
  const target = jsArg(item.targetType);
  const id = jsArg(item.sourceCandidateId);
  if (item.targetType === 'canon_candidates') {
    return `
      <div class="candidate-actions">
        <button class="success small-btn" onclick="setCandidateDecision(${target}, ${id}, 'approved')">Canon</button>
        <button class="ghost small-btn" onclick="setCandidateDecision(${target}, ${id}, 'interpretation')">Interpretação</button>
        <button class="ghost small-btn" onclick="setCandidateDecision(${target}, ${id}, 'possible_hook')">Gancho</button>
        <button class="ghost small-btn" onclick="setCandidateDecision(${target}, ${id}, 'private')">Privado</button>
        <button class="danger small-btn" onclick="setCandidateDecision(${target}, ${id}, 'rejected')">Rejeitar</button>
      </div>
    `;
  }
  if (item.targetType === 'quote_candidates') {
    return `
      <div class="candidate-actions">
        <button class="success small-btn" onclick="setCandidateDecision(${target}, ${id}, 'approved')">Aprovar</button>
        <button class="ghost small-btn" onclick="setCandidateDecision(${target}, ${id}, 'private')">Privado</button>
        <button class="danger small-btn" onclick="setCandidateDecision(${target}, ${id}, 'rejected')">Rejeitar</button>
      </div>
    `;
  }
  return `
    <div class="candidate-actions">
      <button class="success small-btn" onclick="setCandidateDecision(${target}, ${id}, 'approved_by_speaker')">Speaker</button>
      <button class="success small-btn" onclick="setCandidateDecision(${target}, ${id}, 'approved_by_all')">Mesa</button>
      <button class="ghost small-btn" onclick="setCandidateDecision(${target}, ${id}, 'private')">Privado</button>
      <button class="danger small-btn" onclick="setCandidateDecision(${target}, ${id}, 'rejected')">Rejeitar</button>
    </div>
  `;
}

function reviewSegmentRow(segment) {
  const decision = reviewDecision(segment);
  const active = segment.id === state.selectedReviewSegmentId ? 'active' : '';
  const ai = segment.ai;
  return `
    <article class="review-segment-row ${active}" onclick="selectReviewSegment('${segment.id}')">
      <div class="row between">
        <div class="row">
          <span class="time">${fmtDuration(segment.start_ms)}</span>
          <strong>${escapeHtml(decision.characterName || segment.character_name || segment.track_key)}</strong>
          <span class="muted-text">${escapeHtml(segment.speaker_name || segment.track_key)}</span>
        </div>
        <div class="row">
          ${reviewStatusBadge(decision.status)}
          ${segment.needs_review ? badge('speaker?', 'orange') : ''}
        </div>
      </div>
      <p>${escapeHtml(decision.textOverride || segment.text)}</p>
      <div class="row compact">
        ${badge(segment.track_key, 'blue')}
        ${badge(`chunk ${segment.chunk_index}`, 'default')}
        ${badge(`${segment.text_words || 0} palavras`, 'purple')}
        ${ai ? badge(ai.segment_type, 'green') : ''}
        ${ai?.canon_relevance && ai.canon_relevance !== 'none' ? badge(`canon ${ai.canon_relevance}`, 'gold') : ''}
      </div>
    </article>
  `;
}

function reviewDetailPanel(segment, decision) {
  const storageFiles = realReviewData()?.recordingFiles || [];
  const trackFile = storageFiles.find(file => file.source_file_role === `craig_track_${segment.track_key}`);
  const masterMd = storageFiles.find(file => file.source_file_role === 'transcript_master_md');
  const ai = segment.ai;
  return `
    <div class="panel-title">
      <h2>Decisão</h2>
      ${reviewStatusBadge(decision.status)}
    </div>
    <div class="detail-head">
      <span class="time">${fmtDuration(segment.start_ms)} - ${fmtDuration(segment.end_ms)}</span>
      <h3>${escapeHtml(decision.characterName || segment.character_name || segment.track_key)}</h3>
      <p>${escapeHtml(decision.textOverride || segment.text)}</p>
    </div>

    <label>Personagem / speaker corrigido</label>
    <input id="reviewCharacterInput" value="${escapeHtml(decision.characterName || segment.character_name || '')}" />
    <label>Texto revisado</label>
    <textarea id="reviewTextInput">${escapeHtml(decision.textOverride || segment.text || '')}</textarea>
    <label>Nota de revisão</label>
    <textarea id="reviewNoteInput" placeholder="Ex: fala boa para recap, conferir nome próprio, separar OOC...">${escapeHtml(decision.note || '')}</textarea>
    <div class="row">
      <button class="small-btn" onclick="saveReviewEdit('${segment.id}')">Salvar nota</button>
      <button class="small-btn" onclick="copyReviewTimestamp('${segment.id}')">Copiar timestamp</button>
    </div>

    <div class="decision-grid">
      <button class="success" onclick="setReviewDecision('${segment.id}', 'approved')">Aprovar</button>
      <button class="ghost" onclick="setReviewDecision('${segment.id}', 'canon_candidate')">Canon?</button>
      <button class="ghost" onclick="setReviewDecision('${segment.id}', 'quote_candidate')">Fala</button>
      <button class="ghost" onclick="setReviewDecision('${segment.id}', 'outtake')">Bastidor</button>
      <button class="ghost" onclick="setReviewDecision('${segment.id}', 'private_note')">Privado</button>
      <button class="danger" onclick="setReviewDecision('${segment.id}', 'rejected')">Rejeitar</button>
    </div>

    <div class="source-box">
      <h3>Fonte</h3>
      <p><strong>Track:</strong> ${escapeHtml(segment.track_key)} / ${escapeHtml(segment.speaker_name || '-')}</p>
      <p><strong>Chunk:</strong> ${escapeHtml(String(segment.chunk_index))}</p>
      <p><strong>Resposta:</strong> ${escapeHtml(segment.response_path || '-')}</p>
      <p><strong>Arquivo R2:</strong> ${escapeHtml(trackFile?.storage_path || 'track nao encontrado')}</p>
      <p><strong>Transcript master:</strong> ${escapeHtml(masterMd?.storage_path || 'nao encontrado')}</p>
    </div>
    ${ai ? `
      <div class="source-box">
        <h3>Sugestão da IA</h3>
        <p><strong>Tipo:</strong> ${escapeHtml(ai.segment_type || '-')}</p>
        <p><strong>Canon:</strong> ${escapeHtml(ai.canon_relevance || 'none')}</p>
        <p><strong>Confiança:</strong> ${Math.round(Number(ai.confidence || 0) * 100)}%</p>
        <p><strong>Motivo:</strong> ${escapeHtml(ai.reason || '-')}</p>
      </div>
    ` : ''}
  `;
}

window.setReviewSpeaker = function setReviewSpeaker(value) {
  state.reviewSpeaker = value;
  renderView();
};

window.setReviewStatus = function setReviewStatus(value) {
  state.reviewStatus = value;
  renderView();
};

window.selectReviewSegment = function selectReviewSegment(id) {
  state.selectedReviewSegmentId = id;
  renderView();
};

window.setReviewDecision = function setReviewDecision(id, status) {
  const segment = reviewSegmentById(id);
  if (!segment) return;
  const store = loadReviewStore();
  const previous = reviewDecision(segment);
  store[id] = {
    ...previous,
    status,
    updatedAt: new Date().toISOString()
  };
  saveReviewStore(store);
  toast(`Segmento ${id} marcado como ${reviewStatusMeta(status)[0]}.`);
  renderView();
};

window.saveReviewEdit = function saveReviewEdit(id) {
  const segment = reviewSegmentById(id);
  if (!segment) return;
  const store = loadReviewStore();
  const previous = reviewDecision(segment);
  store[id] = {
    ...previous,
    characterName: $('#reviewCharacterInput')?.value || previous.characterName || segment.character_name,
    textOverride: $('#reviewTextInput')?.value || '',
    note: $('#reviewNoteInput')?.value || '',
    updatedAt: new Date().toISOString()
  };
  saveReviewStore(store);
  toast('Nota de revisão salva localmente.');
  renderView();
};

window.setCandidateDecision = function setCandidateDecision(targetType, sourceCandidateId, decision) {
  const store = loadCandidateReviewStore();
  const key = candidateStoreKey(targetType, sourceCandidateId);
  const noteId = `candidate_note_${safeDomId(targetType)}_${safeDomId(sourceCandidateId)}`;
  store[key] = {
    ...(store[key] || {}),
    targetType,
    sourceCandidateId,
    decision,
    note: $(`#${noteId}`)?.value || store[key]?.note || '',
    approvedForPublic: false,
    updatedAt: new Date().toISOString()
  };
  saveCandidateReviewStore(store);
  toast(`Candidato ${sourceCandidateId} marcado como ${candidateDecisionMeta(decision)[0]}.`);
  renderView();
};

function buildReviewDecisionExport() {
  const data = realReviewData();
  const current = user();
  const segmentStore = loadReviewStore();
  const candidateStore = loadCandidateReviewStore();
  return {
    schemaVersion: 1,
    sourceSessionId: data?.session?.sourceSessionId || null,
    aiRunId: data?.ai?.runId || null,
    exportedAt: new Date().toISOString(),
    actor: current ? {
      userId: current.id,
      displayName: current.displayName,
      role: current.role,
      trackKey: USER_TRACK_KEYS[current.id] || current.id
    } : null,
    segmentDecisions: Object.entries(segmentStore)
      .map(([sourceSegmentId, item]) => ({
        sourceSegmentId,
        decision: item.status,
        characterName: item.characterName || '',
        textOverride: item.textOverride || '',
        note: item.note || '',
        updatedAt: item.updatedAt || null
      }))
      .sort((a, b) => a.sourceSegmentId.localeCompare(b.sourceSegmentId)),
    candidateDecisions: Object.values(candidateStore)
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

window.copyReviewDecisionExport = function copyReviewDecisionExport() {
  const serialized = JSON.stringify(buildReviewDecisionExport(), null, 2);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(serialized)
      .then(() => toast('Decisões copiadas em JSON.'))
      .catch(() => openReviewDecisionExportModal(serialized));
    return;
  }
  openReviewDecisionExportModal(serialized);
};

window.downloadReviewDecisionExport = function downloadReviewDecisionExport() {
  const payload = buildReviewDecisionExport();
  const serialized = JSON.stringify(payload, null, 2);
  const blob = new Blob([serialized + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `review_decisions_${payload.sourceSessionId || 'session'}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast('JSON de decisões baixado.');
};

function openReviewDecisionExportModal(serialized) {
  openModal(`
    <span class="eyebrow">Review Board</span>
    <h2>Decisões em JSON</h2>
    <pre class="code">${escapeHtml(serialized)}</pre>
  `);
}

window.copyReviewTimestamp = function copyReviewTimestamp(id) {
  const segment = reviewSegmentById(id);
  if (!segment) return;
  const text = `${fmtDuration(segment.start_ms)} ${segment.speaker_name || segment.track_key}: ${segment.text}`;
  navigator.clipboard?.writeText(text);
  toast('Timestamp copiado.');
};

window.focusSegment = function focusSegment(id) {
  const seg = DATA.transcriptSegments.find(s => s.id === id);
  if (!seg || !canView(seg)) return;
  openModal(`
    <span class="eyebrow">${escapeHtml(seg.time)} • ${escapeHtml(seg.type)}</span>
    <h2>${escapeHtml(seg.character)}</h2>
    <p class="quote">“${escapeHtml(seg.text)}”</p>
    <div class="grid cols-2">
      <div class="info-box"><strong>Visível no sistema</strong><p>${escapeHtml(seg.visibleTo.map(id => byUser(id)?.displayName || id).join(', '))}</p></div>
      <div class="info-box"><strong>Quem sabe na ficção</strong><p>${escapeHtml(seg.fictionKnows.join(', ') || 'Ninguém / fora de personagem')}</p></div>
    </div>
    ${tags(seg.tags)}
    <div class="row modal-actions">
      <button class="success" onclick="toast('Marcado como canon candidato.'); closeModal();">Canon candidato</button>
      <button class="ghost" onclick="toast('Marcado como segredo com DM.'); closeModal();">Segredo com DM</button>
      <button class="ghost" onclick="toast('Marcado como bastidor.'); closeModal();">Bastidor</button>
      <button class="danger" onclick="toast('Marcado para cortar/ocultar.'); closeModal();">Cortar</button>
    </div>
  `);
};

function segmentCard(seg) {
  return `
    <article class="segment-card" id="${seg.id}">
      <div class="row between">
        <div class="row"><span class="time">${escapeHtml(seg.time)}</span><strong>${escapeHtml(seg.character)}</strong></div>
        <div class="row">${badge(seg.type, 'blue')}${badge(seg.access, seg.access === 'owner_only' ? 'red' : seg.access === 'dm_only' ? 'gold' : 'default')}</div>
      </div>
      <p>${escapeHtml(seg.text)}</p>
      <div class="segment-meta">
        <span><strong>Sistema:</strong> ${escapeHtml(seg.visibleTo.map(id => byUser(id)?.name || id).join(', '))}</span>
        <span><strong>Ficção:</strong> ${escapeHtml(seg.fictionKnows.join(', ') || 'fora de personagem')}</span>
      </div>
      ${tags(seg.tags)}
      <div class="row">
        <button class="small-btn" onclick="focusSegment('${seg.id}')">Auditar</button>
        <button class="small-btn" onclick="toast('Ação simulada: classificação atualizada.')">Classificar</button>
      </div>
    </article>
  `;
}

function candidateCard(c) {
  return `
    <article class="candidate-card">
      <div class="row between"><h3>${escapeHtml(c.title)}</h3>${badge(Math.round(c.confidence * 100) + '%', 'orange')}</div>
      <p>${escapeHtml(c.claim)}</p>
      <div class="row">${badge(c.status, 'purple')}${badge(c.sourceTime, 'blue')}</div>
      <small>${escapeHtml(c.suggestedAction)}</small>
      <div class="row">
        <button class="success small-btn" onclick="toast('Aprovado na demo. No sistema real salva review_decision.')">Aprovar</button>
        <button class="ghost small-btn" onclick="toast('Mandado para segredo/revisão.')">Mover</button>
        <button class="danger small-btn" onclick="toast('Rejeitado na demo.')">Rejeitar</button>
      </div>
    </article>
  `;
}

function renderTranscript() {
  const list = visible(DATA.transcriptSegments).filter(seg => `${seg.text} ${seg.character} ${seg.tags.join(' ')}`.toLowerCase().includes(state.query.toLowerCase()));
  setTitle('Transcrição', 'Busca filtrada por permissões');
  $('#view').innerHTML = `
    <section class="card">
      <div class="card-header"><div><h2>Transcrição visível</h2><p>O mesmo arquivo bruto gera visões diferentes para cada login.</p></div>${badge(user().displayName, user().color)}</div>
      <input placeholder="Buscar por Euclix, Hugin, Dandelion, bastidor..." value="${escapeHtml(state.query)}" oninput="state.query=this.value; renderView();" />
    </section>
    <section class="stack">
      ${list.map(segmentCard).join('') || empty('Nada encontrado ou nada visível para esse perfil.')}
    </section>
  `;
}

function secretCard(secret) {
  const owner = byUser(secret.owner);
  return `
    <article class="secret-card ${secret.access}">
      <div class="row between">
        <h3>${escapeHtml(secret.title)}</h3>
        ${badge(secret.type, secret.access === 'owner_only' ? 'red' : secret.access === 'dm_only' ? 'gold' : 'purple')}
      </div>
      <p>${escapeHtml(secret.description)}</p>
      <div class="secret-grid">
        <span><strong>Dono:</strong> ${escapeHtml(owner?.displayName || secret.owner)}</span>
        <span><strong>Audiência:</strong> ${escapeHtml(secret.audience)}</span>
        <span><strong>Ficção:</strong> ${escapeHtml(secret.fictionKnows.join(', ') || '—')}</span>
        <span><strong>Status:</strong> ${escapeHtml(secret.status)}</span>
      </div>
      <div class="row">${badge(secret.dmCanView ? 'DM vê' : 'restrito', secret.dmCanView ? 'green' : 'red')}${badge(secret.canAffectCanon ? 'pode afetar canon' : 'não canon', secret.canAffectCanon ? 'orange' : 'default')}</div>
      <small>${escapeHtml(secret.source)} • ${escapeHtml(secret.revealState)}</small>
      <div class="row">
        <button class="small-btn" onclick="openSecret('${secret.id}')">Detalhes</button>
        <button class="small-btn" onclick="toast('Fluxo de revelação simulado.')">Revelar</button>
      </div>
    </article>
  `;
}

function renderSecrets() {
  const list = visible(DATA.secrets);
  setTitle('Segredos', 'Visibilidade por usuário e personagem');
  $('#view').innerHTML = `
    <section class="card">
      <div class="card-header">
        <div><h2>Segredos visíveis para ${escapeHtml(user().displayName)}</h2><p>Troque de conta para ver a diferença. O DM é lore admin e vê diários pessoais; outros jogadores não veem.</p></div>
        <button class="primary" onclick="openNewSecretModal()">+ Novo segredo</button>
      </div>
      <div class="grid cols-2">
        ${list.map(secretCard).join('') || empty('Nenhum segredo visível para esse perfil.')}
      </div>
    </section>

    <section class="card">
      <h2>Regras rápidas</h2>
      <div class="rules-grid">
        ${DATA.visibilityRules.map(rule => `
          <div class="rule-box">
            <strong>${escapeHtml(rule.rule)}</strong>
            <p><b>Sistema:</b> ${escapeHtml(rule.system)}</p>
            <p><b>Ficção:</b> ${escapeHtml(rule.fiction)}</p>
            <p><b>Canon:</b> ${escapeHtml(rule.canon)}</p>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

window.openSecret = function openSecret(id) {
  const s = DATA.secrets.find(x => x.id === id);
  if (!s || !canView(s)) return;
  openModal(`
    <span class="eyebrow">${escapeHtml(s.type)}</span>
    <h2>${escapeHtml(s.title)}</h2>
    <p>${escapeHtml(s.description)}</p>
    <div class="grid cols-2">
      <div class="info-box"><strong>Quem vê no sistema</strong><p>${escapeHtml(s.visibleTo.map(id => byUser(id)?.displayName || id).join(', '))}</p></div>
      <div class="info-box"><strong>Quem sabe na ficção</strong><p>${escapeHtml(s.fictionKnows.join(', ') || '—')}</p></div>
      <div class="info-box"><strong>DM</strong><p>${s.dmCanView ? 'Yuhara pode ver como lore admin.' : 'Yuhara não vê este conteúdo.'}</p></div>
      <div class="info-box"><strong>Canon</strong><p>${s.canAffectCanon ? 'Pode afetar a história após validação.' : 'Não vira canon sem validação do DM.'}</p></div>
    </div>
    <h3>Histórico</h3>
    <ul>${s.notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
    <div class="row modal-actions">
      <button class="success" onclick="toast('Revelação simulada criada.'); closeModal();">Revelar para alguém</button>
      <button class="ghost" onclick="toast('Marcado para revisão.'); closeModal();">Mandar para revisão</button>
      <button class="danger" onclick="toast('Mantido privado.'); closeModal();">Manter privado</button>
    </div>
  `);
};

function renderKnowledge() {
  const secrets = visible(DATA.secrets);
  const characters = ['Dandelion', 'Astel', 'Screacky', 'Yuhara/DM', 'Povo de Euclix', 'Ivory'];
  setTitle('Quem sabe o quê', 'Conhecimento narrativo ≠ permissão do sistema');
  $('#view').innerHTML = `
    <section class="card">
      <div class="card-header"><div><h2>Matriz de conhecimento</h2><p>Mostra apenas informações que o usuário logado pode ver. Assim ninguém toma spoiler na testa sem consentimento.</p></div>${badge('visão: ' + user().name, user().color)}</div>
      <div class="matrix-wrap">
        <table class="matrix">
          <thead><tr><th>Informação</th>${characters.map(c => `<th>${escapeHtml(c)}</th>`).join('')}<th>Sistema</th></tr></thead>
          <tbody>
            ${secrets.map(s => `
              <tr>
                <td><strong>${escapeHtml(s.title)}</strong><br><small>${escapeHtml(s.type)}</small></td>
                ${characters.map(c => `<td>${s.fictionKnows.includes(c.replace('/DM', '')) || (c === 'Yuhara/DM' && s.visibleTo.includes('yuhara')) ? '✓' : '—'}</td>`).join('')}
                <td>${escapeHtml(s.audience)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCanon() {
  const list = visible(DATA.canonEntries);
  setTitle('Canon', 'Público, privado e oculto');
  $('#view').innerHTML = `
    <section class="card">
      <div class="card-header"><div><h2>Canon visível</h2><p>Canon é separado de audiência. Pode ser canon público, canon privado ou canon oculto do DM.</p></div>${badge(user().displayName, user().color)}</div>
      <div class="grid cols-3">
        ${list.map(entry => `
          <article class="canon-card">
            <div class="row between"><h3>${escapeHtml(entry.title)}</h3>${badge(entry.status, entry.visibility === 'dm_only' ? 'gold' : entry.visibility === 'owner_dm' ? 'purple' : 'green')}</div>
            <p>${escapeHtml(entry.text)}</p>
            <small>${escapeHtml(entry.source)}</small>
            ${tags(entry.related)}
          </article>
        `).join('') || empty('Nenhum canon visível.')}
      </div>
    </section>
  `;
}

function renderOuttakes() {
  const list = visible(DATA.outtakes);
  setTitle('Bastidores', 'Cortes não canon e aprovação');
  $('#view').innerHTML = `
    <section class="card">
      <div class="card-header"><div><h2>Bastidores visíveis</h2><p>Piadas e cortes podem existir, mas não entram na lore. O que é privado continua privado.</p></div>${badge('não canon', 'red')}</div>
      <div class="grid cols-2">
        ${list.map(o => `
          <article class="outtake-card">
            <div class="row between"><h3>${escapeHtml(o.title)}</h3>${badge(o.status, o.access === 'owner_only' ? 'red' : 'green')}</div>
            <p>${escapeHtml(o.text)}</p>
            <small>Fonte: ${escapeHtml(o.source)}</small>
            <div class="row"><button class="small-btn" onclick="toast('Corte aprovado na demo.')">Aprovar corte</button><button class="small-btn" onclick="toast('Corte mantido privado.')">Manter privado</button></div>
          </article>
        `).join('') || empty('Nenhum bastidor visível.')}
      </div>
    </section>
  `;
}

function renderPublications() {
  const data = realReviewData();
  if (!data?.ai?.publications) {
    setTitle('Publicações', 'Rascunhos e exports');
    $('#view').innerHTML = `
      <section class="card">
        <div class="card-header"><div><h2>Publicações</h2><p>Nenhum pacote real foi exportado ainda. Gere com o pipeline de publicação para ver os rascunhos aqui.</p></div>${badge('sem dados', 'default')}</div>
      </section>
    `;
    return;
  }
  const publications = data.ai.publications || [];
  const finalReady = publications.filter(item => ['public_campaign', 'public_web'].includes(item.visibility) && item.status !== 'draft');
  const reviewOnly = publications.filter(item => item.visibility === 'review_only');
  setTitle('Publicações', `${data.session.title} • ${data.ai.runId}`);
  $('#view').innerHTML = `
    <section class="review-hero">
      <div>
        <span class="eyebrow">Publicação travada por revisão</span>
        <h2>Pacotes gerados</h2>
        <p>Publicações finais só aparecem depois de canon, falas e bastidores aprovados. Por enquanto existe apenas material interno de revisão.</p>
        <div class="row">
          ${badge(`${publications.length} pacote(s)`, 'blue')}
          ${badge(`${reviewOnly.length} review_only`, 'gold')}
          ${badge(`${finalReady.length} públicos`, finalReady.length ? 'green' : 'red')}
        </div>
      </div>
      <div class="review-kpis">
        <div><strong>${data.ai.summary.canonCandidates || 0}</strong><span>canon candidatos</span></div>
        <div><strong>${data.ai.summary.quoteCandidates || 0}</strong><span>falas candidatas</span></div>
        <div><strong>${data.ai.summary.outtakeCandidates || 0}</strong><span>bastidores candidatos</span></div>
        <div><strong>${finalReady.length}</strong><span>publicações finais</span></div>
      </div>
    </section>
    <section class="publication-grid">
      ${publications.map(publicationCard).join('') || empty('Nenhuma publicação gerada.')}
    </section>
  `;
}

function publicationCard(item) {
  const color = item.visibility === 'review_only' ? 'gold' : item.visibility?.startsWith('public') ? 'green' : 'blue';
  const content = item.content || '';
  return `
    <article class="publication-card">
      <div class="row between">
        <div>
          <h2>${escapeHtml(item.title || item.source_publication_id)}</h2>
          <small>${escapeHtml(item.publication_type)} • ${escapeHtml(item.source_publication_id || '-')}</small>
        </div>
        <div class="row">${badge(item.visibility, color)}${badge(item.status, item.status === 'draft' ? 'orange' : 'green')}</div>
      </div>
      <pre>${escapeHtml(content.slice(0, 900))}${content.length > 900 ? '\n...' : ''}</pre>
      <div class="row">
        <button class="small-btn" onclick="copyPublication('${escapeHtml(item.source_publication_id)}')">Copiar preview</button>
      </div>
    </article>
  `;
}

window.copyPublication = function copyPublication(sourcePublicationId) {
  const item = realReviewData()?.ai?.publications?.find(publication => publication.source_publication_id === sourcePublicationId);
  if (!item) return;
  navigator.clipboard?.writeText(item.content || '');
  toast('Publicação copiada.');
};

function renderEntities() {
  const list = visible(DATA.entities);
  setTitle('Entidades', 'Personagens, NPCs e relações');
  $('#view').innerHTML = `
    <section class="card">
      <div class="card-header"><div><h2>Entidades visíveis</h2><p>Notas públicas e privadas podem coexistir na mesma entidade, com filtro por usuário.</p></div>${badge('lore estruturada', 'blue')}</div>
      <div class="grid cols-2">
        ${list.map(ent => `
          <article class="entity-card">
            <div class="row between"><h3>${escapeHtml(ent.name)}</h3>${badge(ent.type, 'purple')}</div>
            <p>${escapeHtml(ent.summary)}</p>
            ${canView({ visibleTo: [ent.owner, 'yuhara'], access: ent.owner === 'yuhara' ? 'dm_only' : 'owner_dm', owner: ent.owner }) ? `<div class="private-note"><strong>Nota privada visível:</strong> ${escapeHtml(ent.privateNote)}</div>` : ''}
            ${tags(ent.tags)}
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderStage() {
  const songs = DATA.songs.filter(song => song.visibility !== 'owner_only' || song.owner === user().id || user().role === 'dm');
  setTitle('Palco', 'Músicas, discursos e performances');
  $('#view').innerHTML = `
    <section class="card">
      <div class="card-header"><div><h2>Palco do Dandelion</h2><p>Músicas podem ser públicas, rascunhos privados ou surpresas para revelar depois.</p></div>${badge('arte como memória', 'gold')}</div>
      <div class="grid cols-3">
        ${songs.map(song => `
          <article class="song-card">
            <h3>${escapeHtml(song.title)}</h3>
            <p>${escapeHtml(song.description)}</p>
            <div class="row">${badge(song.status, song.visibility === 'owner_only' ? 'red' : 'green')}</div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderAdmin() {
  setTitle('Admin & Permissões', 'RLS, papéis e controle de acesso');
  const isDm = user().role === 'dm';
  $('#view').innerHTML = `
    <section class="card">
      <div class="card-header"><div><h2>Painel administrativo</h2><p>Na versão real, só o DM e admins técnicos devem gerenciar usuários, sessões, fontes e permissões globais.</p></div>${badge(isDm ? 'Você é DM' : 'Somente leitura', isDm ? 'gold' : 'default')}</div>
      <div class="grid cols-4">
        ${DATA.users.map(u => `
          <article class="profile-card">
            ${avatar(u, 'big')}
            <h3>${escapeHtml(u.displayName)}</h3>
            <p>${escapeHtml(u.email)}</p>
            <div class="row">${badge(u.role, u.color)}</div>
            <small>${escapeHtml(u.permissions.join(', '))}</small>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="card">
      <h2>Políticas principais</h2>
      <pre class="code">owner_only: auth.uid() = owner_user_id OR user.role = 'dm'
owner_dm: auth.uid() = owner_user_id OR user.role = 'dm'
shared: auth.uid() IN audience_users OR user.role = 'dm'
dm_only: user.role = 'dm'
party: authenticated campaign member

Importante:
- DM/lore admin acessa owner_only.
- Owner_only não vira canon automaticamente.
- Para afetar o mundo, conteúdo precisa de validação do DM.</pre>
    </section>
  `;
}

function renderPipeline() {
  setTitle('Pipeline Técnico', 'Arquitetura do MVP');
  $('#view').innerHTML = `
    <section class="card">
      <div class="card-header"><div><h2>Fluxo completo</h2><p>Do áudio bruto até recap publicado, com auditoria e permissão no meio.</p></div>${badge('Node + Python + Supabase', 'blue')}</div>
      <div class="pipeline-flow">
        ${DATA.pipelineSteps.map(s => `
          <div class="pipeline-step">
            <span>${s.step}</span>
            <strong>${escapeHtml(s.title)}</strong>
            <p>${escapeHtml(s.detail)}</p>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="card">
      <h2>Stack recomendada</h2>
      <div class="grid cols-3">
        <div class="info-box"><strong>Frontend</strong><p>Next.js/Vercel depois. Esta demo é HTML/CSS/JS puro para validação visual.</p></div>
        <div class="info-box"><strong>Banco/Auth</strong><p>Supabase Postgres + Supabase Auth com Google Provider + RLS.</p></div>
        <div class="info-box"><strong>Worker</strong><p>Docker com Node, Python e ffmpeg para processar áudio/transcrição.</p></div>
        <div class="info-box"><strong>Áudio</strong><p>Craig multitrack + OBS backup.</p></div>
        <div class="info-box"><strong>Roll20</strong><p>Roll20 Pro Logger usando scripts/mods e export de chat estruturado.</p></div>
        <div class="info-box"><strong>IA</strong><p>OpenAI para transcrição, classificação, extração de canon e recap.</p></div>
      </div>
    </section>
  `;
}

function openQuickMarkerModal() {
  openModal(`
    <span class="eyebrow">Marcador rápido</span>
    <h2>Novo momento da sessão</h2>
    <p>Na versão real isso salva timestamp, usuário, tipo e texto em session_markers.</p>
    <label>Tipo</label>
    <select><option>Canon?</option><option>Fala marcante</option><option>Segredo</option><option>Bastidor</option><option>Cortar</option><option>Dúvida</option></select>
    <label>Descrição</label>
    <textarea placeholder="Ex: Astel recebeu sinal fraco de Hugin..."></textarea>
    <div class="row modal-actions"><button class="primary" onclick="toast('Momento criado na demo.'); closeModal();">Salvar marcador</button></div>
  `);
}

window.openNewSecretModal = function openNewSecretModal() {
  const u = user();
  openModal(`
    <span class="eyebrow">Novo segredo</span>
    <h2>Criar segredo como ${escapeHtml(u.displayName)}</h2>
    <p>Escolha a audiência. A demo não salva de verdade, mas mostra o fluxo do produto.</p>
    <label>Título</label>
    <input placeholder="Ex: Dandelion prepara uma música para o duelo" />
    <label>Tipo de visibilidade</label>
    <select>
      <option>Diário privado — só eu, sem DM, não canon</option>
      <option>Segredo de personagem — eu + DM</option>
      <option>Segredo compartilhado — players escolhidos + DM</option>
      ${u.role === 'dm' ? '<option>Segredo do DM — só DM</option>' : ''}
    </select>
    <label>Descrição</label>
    <textarea placeholder="Escreva o conteúdo do segredo..."></textarea>
    <div class="callout warning"><strong>Aviso:</strong> diário pessoal é visível para o DM/lore admin, mas não afeta canon nem entra em recap sem validação.</div>
    <div class="row modal-actions"><button class="primary" onclick="toast('Segredo criado na demo.'); closeModal();">Criar segredo</button></div>
  `);
};

function empty(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

boot();
