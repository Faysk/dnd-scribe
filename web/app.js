const DEFAULT_RUN = 'classify_candidates_v2_gpt-4o';

const state = {
  sessions: [],
  selectedSourceSessionId: null,
  review: null,
  summary: null,
  tab: 'review',
  query: '',
  speaker: 'all',
  status: 'all',
  selectedSegmentId: null,
  segmentDecisions: {},
  candidateDecisions: {},
  busy: false,
  log: []
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

function setBusy(value) {
  state.busy = value;
  ['applyDecisionsBtn', 'downloadTemplateBtn', 'downloadDecisionsBtn', 'refreshSessionsBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = value;
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const payload = await response.json();
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
  await loadSessions();
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

async function loadSession(sourceSessionId) {
  try {
    setBusy(true);
    state.selectedSourceSessionId = sourceSessionId;
    const payload = await api(`/api/session?sourceSessionId=${encodeURIComponent(sourceSessionId)}&runId=${encodeURIComponent(DEFAULT_RUN)}`);
    state.review = payload.review;
    state.summary = payload.summary || null;
    state.selectedSegmentId = state.review?.segments?.[0]?.id || null;
    state.segmentDecisions = {};
    state.candidateDecisions = {};
    remember(`Sessao carregada: ${sourceSessionId}`, payload.summary);
    render();
  } catch (error) {
    toast(error.message);
  } finally {
    setBusy(false);
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
  document.querySelectorAll('#tabs button').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === state.tab);
  });
  if (!state.review) {
    $('#view').innerHTML = `<div class="empty">Carregando dados reais do Supabase...</div>`;
    return;
  }
  const routes = {
    review: renderReview,
    candidates: renderCandidates,
    publications: renderPublications,
    ops: renderOps
  };
  $('#view').innerHTML = (routes[state.tab] || renderReview)();
}

function renderHeader() {
  const review = state.review;
  $('#eyebrow').textContent = review ? `${review.campaign.name} • ${review.session.status}` : 'Local app';
  $('#title').textContent = review ? review.session.title : 'DnD Scribe';
}

function renderStatusStrip() {
  const review = state.review;
  const summary = state.summary || {};
  const localSegment = Object.keys(state.segmentDecisions).length;
  const localCandidate = Object.keys(state.candidateDecisions).length;
  $('#statusStrip').innerHTML = `
    ${metric(review?.summary?.segments || 0, 'segmentos')}
    ${metric(review?.summary?.participants || 0, 'participantes')}
    ${metric(review?.ai?.summary?.canonCandidates || 0, 'canon IA')}
    ${metric((review?.ai?.summary?.quoteCandidates || 0) + (review?.ai?.summary?.outtakeCandidates || 0), 'falas/bastidores')}
    ${metric(summary.reviewDecisions || 0, 'decisoes salvas')}
    ${metric(localSegment + localCandidate, 'decisoes locais')}
  `;
}

function metric(value, label) {
  return `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
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
  return `
    <button class="segment-row ${active}" onclick="selectSegment('${segment.id}')">
      <div class="row between">
        <strong>${fmtDuration(segment.start_ms)} • ${escapeHtml(decision.characterName || segment.character_name || segment.track_key)}</strong>
        ${statusBadge(decision.status)}
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
      <div class="actions">
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

function renderCandidates() {
  const candidates = allCandidates();
  return `
    <section class="candidate-grid">
      ${candidates.map(candidateCard).join('') || `<div class="empty">Nenhum candidato encontrado.</div>`}
    </section>
  `;
}

function candidateCard(item) {
  const decision = candidateDecision(item);
  const noteId = `note_${safeId(candidateKey(item))}`;
  return `
    <article class="candidate-card">
      <div class="row between">
        <h2>${escapeHtml(item.title || item.source_candidate_id)}</h2>
        ${candidateStatusBadge(decision.decision)}
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
      </article>
      <article class="ops-card">
        <h2>Resumo Supabase</h2>
        <pre>${escapeHtml(JSON.stringify(state.summary || {}, null, 2))}</pre>
      </article>
      <article class="ops-card">
        <h2>Log local</h2>
        <pre>${escapeHtml(state.log.map(item => `[${item.at}] ${item.message}`).join('\n') || 'Sem eventos ainda.')}</pre>
      </article>
    </section>
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
window.selectSegment = selectSegment;
window.quickSegmentDecision = quickSegmentDecision;
window.saveSegmentDecision = saveSegmentDecision;
window.setCandidateDecision = setCandidateDecision;

boot();
