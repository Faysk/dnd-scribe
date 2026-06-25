const DATA = window.DND_SCRIBE;
const state = {
  currentUserId: localStorage.getItem('dnd_scribe_current_user') || null,
  view: 'dashboard',
  query: '',
  reviewFilter: 'all'
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
