const DATA = window.DND_SCRIBE_DATA;

const state = {
  viewerId: localStorage.getItem("dnd-demo-viewer") || "renan",
  view: location.hash?.replace("#", "") || "dashboard",
  secretFilter: "visible",
  knowledgeFilter: "visible",
  localSecrets: JSON.parse(localStorage.getItem("dnd-demo-local-secrets") || "[]"),
  localMarkers: JSON.parse(localStorage.getItem("dnd-demo-local-markers") || "[]")
};

const $ = (selector) => document.querySelector(selector);
const viewEl = $("#view");
const titleEl = $("#viewTitle");

function viewer() {
  return DATA.viewers.find(v => v.id === state.viewerId) || DATA.viewers[0];
}

function isDM() {
  return viewer().role === "dm";
}

function canView(item) {
  if (!item) return false;
  if (Array.isArray(item.visibleTo)) return item.visibleTo.includes(state.viewerId);
  if (Array.isArray(item.systemAudience)) return item.systemAudience.includes(state.viewerId);
  return true;
}

function canSeeEntity(entity) {
  return !entity.visibleTo || entity.visibleTo.includes(state.viewerId);
}

function allSecrets() {
  return [...DATA.secrets, ...state.localSecrets];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function badge(text, color = "") {
  return `<span class="badge ${color}">${escapeHtml(text)}</span>`;
}

function tags(list = []) {
  return `<div class="row">${list.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>`;
}

function progress(percent) {
  return `<div class="progress"><span style="width:${Math.max(0, Math.min(100, percent))}%"></span></div>`;
}

function save() {
  localStorage.setItem("dnd-demo-viewer", state.viewerId);
  localStorage.setItem("dnd-demo-local-secrets", JSON.stringify(state.localSecrets));
  localStorage.setItem("dnd-demo-local-markers", JSON.stringify(state.localMarkers));
}

function setView(nextView) {
  state.view = nextView;
  location.hash = nextView;
  document.querySelectorAll(".nav button").forEach(btn => btn.classList.toggle("active", btn.dataset.view === nextView));
  render();
}

function init() {
  const select = $("#viewerSelect");
  select.innerHTML = DATA.viewers.map(v => `<option value="${v.id}">${v.name} — ${v.character}</option>`).join("");
  select.value = state.viewerId;
  select.addEventListener("change", () => {
    state.viewerId = select.value;
    save();
    render();
  });

  document.querySelectorAll(".nav button").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
  $("#openNewSecret").addEventListener("click", openNewSecretModal);
  $("#openQuickMarker").addEventListener("click", openMarkerModal);
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", e => {
    if (e.target.id === "modalBackdrop") closeModal();
  });

  if (!document.querySelector(`.nav button[data-view="${state.view}"]`)) state.view = "dashboard";
  render();
}

function setTitle(title) {
  titleEl.textContent = title;
}

function render() {
  const v = viewer();
  $("#viewerHint").textContent = v.hint;
  $("#viewerSelect").value = state.viewerId;
  document.querySelectorAll(".nav button").forEach(btn => btn.classList.toggle("active", btn.dataset.view === state.view));

  const map = {
    dashboard: ["Agora", renderDashboard],
    capture: ["Captura da sessão", renderCapture],
    review: ["Revisão e auditoria", renderReview],
    transcript: ["Transcrição", renderTranscript],
    canon: ["Quadro de canon", renderCanon],
    secrets: ["Segredos e decisões", renderSecrets],
    knowledge: ["Quem sabe o quê", renderKnowledge],
    entities: ["Entidades", renderEntities],
    outtakes: ["Bastidores", renderOuttakes],
    settings: ["Permissões e regras", renderSettings]
  };

  const [title, fn] = map[state.view] || map.dashboard;
  setTitle(title);
  viewEl.innerHTML = fn();
  bindViewEvents();
}

function renderDashboard() {
  const visibleSecrets = allSecrets().filter(canView);
  const hiddenSecrets = allSecrets().length - visibleSecrets.length;
  const visibleTranscript = DATA.transcript.filter(canView);
  const visibleCandidates = DATA.candidates.filter(canView);
  const localMarkers = state.localMarkers.map(m => ({ ...m, type: "Manual" }));
  const markers = [...DATA.markers, ...localMarkers].slice(-7);
  const privateWarning = isDM()
    ? "Como DM, você não vê diários privados de jogador. Só vê o que foi compartilhado com você ou impacta canon."
    : "Como jogador, você vê seus próprios segredos, o que foi compartilhado com você e o canon público.";

  return `
    <div class="grid cols-4">
      ${statCard("Sessão", DATA.session.id, "Em revisão", "gold")}
      ${statCard("Transcrição visível", visibleTranscript.length, `${DATA.transcript.length} segmentos totais`, "blue")}
      ${statCard("Segredos visíveis", visibleSecrets.length, `${hiddenSecrets} ocultos pela permissão`, "purple")}
      ${statCard("Candidatos", visibleCandidates.length, "visíveis para revisar", "orange")}
    </div>

    <div class="grid cols-2">
      <section class="card">
        <div class="card-header">
          <div>
            <h2>${escapeHtml(DATA.session.title)}</h2>
            <p>${escapeHtml(DATA.session.arc)} • ${escapeHtml(DATA.session.date)} • ${escapeHtml(DATA.session.duration)}</p>
          </div>
          ${badge(DATA.session.status, "gold")}
        </div>
        <div class="stack">
          <div class="capture-row">
            <div>
              <h3>Cena atual</h3>
              <p>${escapeHtml(DATA.session.currentScene)}</p>
            </div>
            ${badge("ao vivo / demo", "green")}
          </div>
          <div class="capture-row">
            <div>
              <h3>Objetivo imediato</h3>
              <p>${escapeHtml(DATA.session.nextGoal)}</p>
            </div>
          </div>
          <div class="hint-box">${escapeHtml(DATA.session.rule)}</div>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <div>
            <h2>Perspectiva e privacidade</h2>
            <p>${escapeHtml(privateWarning)}</p>
          </div>
          ${badge(viewer().character, isDM() ? "red" : "blue")}
        </div>
        <div class="stack">
          ${visibleSecrets.slice(0, 3).map(s => `
            <div class="secret-card">
              <div class="row between">
                <h3>${escapeHtml(s.title)}</h3>
                ${badge(s.type, s.dmCanView ? "green" : "orange")}
              </div>
              <p>${escapeHtml(s.description)}</p>
            </div>
          `).join("") || `<div class="empty-state"><strong>Nenhum segredo visível</strong><span>Talvez seu personagem esteja limpo. Ou só bom demais escondendo o jogo.</span></div>`}
        </div>
      </section>
    </div>

    <section class="card">
      <div class="card-header">
        <div>
          <h2>Marcadores recentes</h2>
          <p>Coisas marcadas durante a sessão por Craig, Roll20 Logger, Discord ou manualmente.</p>
        </div>
        <button class="small-btn" data-action="open-marker">+ adicionar</button>
      </div>
      <div class="timeline">
        ${markers.map(m => `
          <div class="timeline-item">
            <span class="time">${escapeHtml(m.t)}</span>
            <div>
              ${badge(m.type, m.type.includes("Canon") ? "gold" : m.type.includes("Segredo") ? "purple" : "blue")}
              <p>${escapeHtml(m.text)}</p>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function statCard(label, value, detail, color) {
  return `
    <section class="card stat-card">
      <span class="accent-dot" style="color: var(--${color}); background: var(--${color});"></span>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(detail)}</span>
    </section>
  `;
}

function renderCapture() {
  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Pipeline de captura</h2>
          <p>A demo assume quatro fontes: Craig multitrack, OBS backup, Roll20 Pro Logger e marcadores do Discord/Craig.</p>
        </div>
        ${badge("MVP recomendado", "gold")}
      </div>
      <div class="stack">
        ${DATA.captureSources.map(source => `
          <div class="capture-row">
            <div style="min-width: 260px;">
              <h3>${escapeHtml(source.name)}</h3>
              <p>${escapeHtml(source.detail)}</p>
            </div>
            <div style="flex: 1; min-width: 180px;">
              ${progress(source.progress)}
            </div>
            ${badge(source.status, source.color)}
          </div>
        `).join("")}
      </div>
    </section>

    <div class="grid cols-3">
      <section class="card">
        <h2>Antes da sessão</h2>
        <p>Criar sessão, confirmar consentimento, abrir Craig, ligar OBS e ativar Roll20 Logger.</p>
        ${tags(["checklist", "consentimento", "setup"])}
      </section>
      <section class="card">
        <h2>Durante a sessão</h2>
        <p>Usar /note, !dnd commands e marcadores rápidos para CANON, FALA, SEGREDO, BASTIDOR, CORTAR.</p>
        ${tags(["ao vivo", "marcadores", "roll20"])}
      </section>
      <section class="card">
        <h2>Depois da sessão</h2>
        <p>Upload dos arquivos, transcrição, classificação, revisão humana, canonização e publicação limpa.</p>
        ${tags(["worker", "ia", "review"])}
      </section>
    </div>
  `;
}

function renderReview() {
  const visibleSegments = DATA.transcript.filter(canView);
  return `
    <div class="review-layout">
      <section class="card">
        <h2>Timeline</h2>
        <div class="audio-bar"><span class="playhead"></span></div>
        <p>Trechos bloqueados pela permissão não aparecem para a perspectiva atual.</p>
        <div class="timeline">
          ${visibleSegments.map((seg, index) => `
            <button class="timeline-item ghost" data-action="focus-segment" data-id="${seg.id}" style="width:100%; text-align:left;">
              <span class="time">${escapeHtml(seg.time)}</span>
              <div>
                ${badge(seg.type, seg.type.includes("private") ? "orange" : seg.type.includes("quote") ? "gold" : "blue")}
                <p>${escapeHtml(seg.character)}</p>
              </div>
            </button>
          `).join("")}
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <div>
            <h2>Transcrição auditável</h2>
            <p>Separada por falante, personagem, timestamp, tipo e visibilidade.</p>
          </div>
          ${badge(`${visibleSegments.length} visíveis`, "green")}
        </div>
        ${visibleSegments.map((seg, i) => transcriptLine(seg, i === 1)).join("")}
      </section>

      <section class="card">
        <div class="card-header">
          <div>
            <h2>Candidatos da IA</h2>
            <p>A IA sugere. A mesa aprova. O DM valida o que muda a realidade.</p>
          </div>
        </div>
        <div class="stack">
          ${DATA.candidates.filter(canView).map(c => candidateCard(c)).join("") || `<div class="empty-state"><strong>Nenhum candidato visível</strong><span>As tretas ocultas estão ocultas. Milagre da segurança.</span></div>`}
        </div>
      </section>
    </div>
  `;
}

function transcriptLine(seg, active = false) {
  return `
    <div class="transcript-line ${active ? "active" : ""}" id="line-${seg.id}">
      <div class="row between top">
        <div class="row">
          <strong>${escapeHtml(seg.time)} • ${escapeHtml(seg.character)}</strong>
          ${badge(seg.type, seg.type.includes("private") ? "orange" : seg.type.includes("secret") ? "purple" : "blue")}
        </div>
        <button class="small-btn" data-action="segment-detail" data-id="${seg.id}">auditar</button>
      </div>
      <p>${escapeHtml(seg.text)}</p>
      ${tags(seg.tags)}
    </div>
  `;
}

function candidateCard(c) {
  return `
    <div class="candidate-card">
      <div class="row between top">
        <div>
          <h3>${escapeHtml(c.title)}</h3>
          <p>${escapeHtml(c.claim)}</p>
        </div>
        ${badge(`${Math.round(c.confidence * 100)}%`, c.confidence > 0.85 ? "green" : "orange")}
      </div>
      <div class="row" style="margin-top:12px;">
        ${badge(c.status, c.status.includes("private") ? "purple" : c.status.includes("quote") ? "gold" : "blue")}
        ${badge(c.visibilitySuggestion, "orange")}
        ${badge(c.sourceTime, "")}
      </div>
      <div class="card-actions" style="margin-top:12px;">
        <button class="success small-btn" data-action="approve-candidate" data-id="${c.id}">aprovar</button>
        <button class="small-btn" data-action="candidate-detail" data-id="${c.id}">detalhes</button>
        <button class="danger small-btn">rejeitar</button>
      </div>
    </div>
  `;
}

function renderTranscript() {
  const visible = DATA.transcript.filter(canView);
  const hidden = DATA.transcript.length - visible.length;
  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Transcrição por perspectiva</h2>
          <p>O mesmo arquivo da sessão mostra trechos diferentes dependendo de quem está vendo.</p>
        </div>
        <div class="row">${badge(`${visible.length} visíveis`, "green")} ${badge(`${hidden} ocultos`, "red")}</div>
      </div>
      <input id="transcriptSearch" placeholder="Buscar em trechos visíveis: Euclix, Hugin, Dandelion..." />
      <div class="stack" id="transcriptList" style="margin-top:14px;">
        ${visible.map(seg => transcriptLine(seg)).join("")}
      </div>
    </section>
  `;
}

function renderCanon() {
  return `
    <div class="grid cols-4">
      ${DATA.canonBoard.map(col => {
        const items = col.items.filter(item => !item.visibleTo || item.visibleTo.includes(state.viewerId));
        return `
        <section class="card">
          <div class="card-header">
            <div>
              <h2>${escapeHtml(col.title)}</h2>
              <p>${items.length} visíveis de ${escapeHtml(col.count)} entradas</p>
            </div>
          </div>
          <div class="stack">
            ${items.map(item => `<div class="capture-row"><p>${escapeHtml(item.text)}</p></div>`).join("") || `<div class="empty-state"><strong>Nada visível aqui</strong><span>O cofre tá fechado para esta perspectiva.</span></div>`}
          </div>
        </section>`
      }).join("")}
    </div>

    <section class="card">
      <h2>Regra de canonização</h2>
      <blockquote>Canon não é igual a conhecimento público. Um fato pode ser verdadeiro e ainda assim ser conhecido só por um personagem, pelo DM ou por um grupo específico.</blockquote>
      <p>Na prática: a IA pode marcar algo como candidato, mas a revisão precisa decidir o status de canon, quem pode ver no sistema e quem sabe dentro da ficção.</p>
    </section>
  `;
}

function renderSecrets() {
  const all = allSecrets();
  const visible = all.filter(canView);
  const hiddenCount = all.length - visible.length;
  const filtered = visible.filter(s => {
    if (state.secretFilter === "visible") return true;
    if (state.secretFilter === "mine") return s.owner === state.viewerId;
    if (state.secretFilter === "dm") return s.type.includes("DM") || s.visibleTo.includes("dm");
    if (state.secretFilter === "no_dm") return s.dmCanView === false;
    if (state.secretFilter === "canon") return s.canAffectCanon;
    return true;
  });

  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Segredos por dono, audiência e impacto</h2>
          <p>Segredo que muda o mundo precisa passar pelo DM. Segredo que só muda o coração do personagem pode ficar privado.</p>
        </div>
        <button class="primary" data-action="open-secret">+ novo segredo</button>
      </div>
      <div class="hint-box">
        Perspectiva atual: <strong>${escapeHtml(viewer().name)} / ${escapeHtml(viewer().character)}</strong>. ${hiddenCount} entrada(s) não são mostradas por permissão.
      </div>
      <div class="filters">
        ${filterChip("visible", "Visíveis")}
        ${filterChip("mine", "Meus")}
        ${filterChip("dm", "Com DM")}
        ${filterChip("no_dm", "Privado sem DM")}
        ${filterChip("canon", "Afeta canon")}
      </div>
      <div class="grid cols-2">
        ${filtered.map(secretCard).join("") || `<div class="empty-state"><strong>Nada nesse filtro</strong><span>Ou ninguém te contou, o que é sempre saudável em RPG. Confia.</span></div>`}
      </div>
    </section>
  `;
}

function filterChip(id, label) {
  return `<button class="filter-chip ${state.secretFilter === id ? "active" : ""}" data-action="secret-filter" data-filter="${id}">${escapeHtml(label)}</button>`;
}

function secretCard(s) {
  return `
    <article class="secret-card">
      <div class="row between top">
        <div>
          <h3>${escapeHtml(s.title)}</h3>
          <p>${escapeHtml(s.description)}</p>
        </div>
        ${badge(s.type, s.dmCanView ? "green" : "orange")}
      </div>
      <div class="secret-meta">
        <div><span>Dono</span><strong>${escapeHtml(resolveName(s.owner))} / ${escapeHtml(s.ownerCharacter)}</strong></div>
        <div><span>Status</span><strong>${escapeHtml(s.status)}</strong></div>
        <div><span>Visível para</span><strong>${escapeHtml(s.visibleTo.map(resolveName).join(", "))}</strong></div>
        <div><span>Sabe na ficção</span><strong>${escapeHtml(s.fictionKnows.join(", ") || "ninguém")}</strong></div>
        <div><span>DM vê?</span><strong>${s.dmCanView ? "Sim" : "Não — diário/rascunho"}</strong></div>
        <div><span>Afeta canon?</span><strong>${s.canAffectCanon ? "Sim" : "Não até revelar"}</strong></div>
      </div>
      <div class="row">
        ${badge(s.source, "blue")}
        ${s.canAffectCanon ? badge("munição narrativa", "purple") : badge("rascunho pessoal", "orange")}
      </div>
      <div class="card-actions" style="margin-top:12px;">
        <button class="small-btn" data-action="secret-detail" data-id="${s.id}">ver histórico</button>
        <button class="small-btn" data-action="reveal-secret" data-id="${s.id}">revelar/compartilhar</button>
      </div>
    </article>
  `;
}

function resolveName(id) {
  return DATA.viewers.find(v => v.id === id)?.name || id;
}

function renderKnowledge() {
  const visible = DATA.knowledge.filter(canView);
  const hidden = DATA.knowledge.length - visible.length;
  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Mapa de conhecimento</h2>
          <p>Separa verdade, permissão do sistema e conhecimento dentro da ficção.</p>
        </div>
        <div class="row">${badge(`${visible.length} visíveis`, "green")} ${badge(`${hidden} ocultos`, "red")}</div>
      </div>
      <div class="matrix">
        <table>
          <thead>
            <tr>
              <th>Informação</th>
              <th>Status de verdade</th>
              <th>Quem vê no sistema</th>
              <th>Quem sabe na ficção</th>
              <th>Quem não sabe</th>
              <th>Fonte</th>
            </tr>
          </thead>
          <tbody>
            ${visible.map(k => `
              <tr>
                <td>${escapeHtml(k.fact)}</td>
                <td>${badge(k.truthStatus, k.truthStatus.includes("Canon") ? "gold" : k.truthStatus.includes("Diário") ? "orange" : "blue")}</td>
                <td>${escapeHtml(k.systemAudience.map(resolveName).join(", "))}</td>
                <td>${escapeHtml(k.fictionKnows.join(", "))}</td>
                <td>${escapeHtml(k.notKnownBy.join(", "))}</td>
                <td>${escapeHtml(k.source)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <h2>Frase guia</h2>
      <blockquote>Nem toda verdade pertence a todos.</blockquote>
      <p>O sistema deve sempre perguntar: quem pode ver isso no app? Quem sabe disso na ficção? Isso entra no recap? Isso muda canon?</p>
    </section>
  `;
}

function renderEntities() {
  const ents = DATA.entities.filter(canSeeEntity);
  const hidden = DATA.entities.length - ents.length;
  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Entidades visíveis</h2>
          <p>Personagens, NPCs, lugares, facções e segredos de preparação podem ter visibilidade própria.</p>
        </div>
        ${badge(`${hidden} ocultas`, hidden ? "red" : "green")}
      </div>
      <div class="stack">
        ${ents.map(e => `
          <div class="entity-row">
            <div class="avatar">${escapeHtml(e.name.slice(0,2).toUpperCase())}</div>
            <div>
              <h3>${escapeHtml(e.name)}</h3>
              <p>${escapeHtml(e.detail)}</p>
            </div>
            <div class="row">${badge(e.type, e.type === "DM" ? "red" : "blue")}</div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderOuttakes() {
  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Bastidores e cortes</h2>
          <p>Conversa aleatória não precisa poluir lore. Mas os melhores cortes podem virar memória de mesa, se aprovados.</p>
        </div>
        ${badge("não canon", "orange")}
      </div>
      <div class="stack">
        ${DATA.outtakes.map(o => `
          <div class="outtake-row">
            <div class="row between top">
              <div>
                <h3>${escapeHtml(o.title)}</h3>
                <p>${escapeHtml(o.text)}</p>
              </div>
              ${badge(o.visibility, o.visibility.includes("Privado") ? "red" : o.approved ? "green" : "orange")}
            </div>
            <div class="row" style="margin-top:10px;">
              ${o.approved ? badge("aprovado", "green") : badge("aguardando", "orange")}
              ${badge("não entra no canon", "")}
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderSettings() {
  const rows = [
    ["Diário privado", "Só jogador", "Não", "Não até compartilhar", "Pensamentos, rascunhos, teoria pessoal"],
    ["Segredo de personagem", "Jogador + DM", "Sim", "Sim", "Decisão secreta, descoberta, backstory relevante"],
    ["Segredo compartilhado", "Players específicos + DM", "Sim", "Sim", "Plano entre personagens"],
    ["Segredo do DM", "Só DM", "Sim", "Sim", "Preparação, vilões, pistas ocultas"],
    ["Canon público", "Mesa toda", "Sim", "Sim", "Resumo, timeline, recap"],
    ["Bastidor", "Mesa privada ou público aprovado", "Opcional", "Não", "Piadas, cortes, caos fora de personagem"]
  ];
  return `
    <section class="card">
      <h2>Modelo de permissão recomendado</h2>
      <p>A demo separa dois conceitos: quem pode ver no sistema e quem sabe dentro da ficção. Essa é a blindagem anti-metagaming.</p>
      <div class="matrix">
        <table>
          <thead>
            <tr>
              <th>Tipo</th><th>Visibilidade</th><th>DM vê?</th><th>Pode afetar canon?</th><th>Uso</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `<tr>${r.map((c, i) => `<td>${i === 2 ? (c === "Sim" ? `<span class="check">${c}</span>` : `<span class="nope">${c}</span>`) : escapeHtml(c)}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <div class="grid cols-2">
      <section class="card">
        <h2>Regra operacional</h2>
        <blockquote>Segredo sem DM é diário. Segredo com DM é munição narrativa.</blockquote>
        <p>O app pode permitir esconder algo do DM, mas precisa marcar claramente como não-canon, não-publicável e sem efeito narrativo até ser compartilhado.</p>
      </section>
      <section class="card">
        <h2>Botões que precisam existir</h2>
        <div class="stack">
          <div class="capture-row"><p>Compartilhar com DM</p>${badge("vira elegível a canon", "green")}</div>
          <div class="capture-row"><p>Revelar para personagem</p>${badge("atualiza quem sabe", "blue")}</div>
          <div class="capture-row"><p>Publicar no recap</p>${badge("exige revisão", "gold")}</div>
          <div class="capture-row"><p>Manter privado</p>${badge("não alimenta IA", "orange")}</div>
        </div>
      </section>
    </div>
  `;
}

function bindViewEvents() {
  document.querySelectorAll("[data-action='secret-filter']").forEach(btn => btn.addEventListener("click", () => {
    state.secretFilter = btn.dataset.filter;
    render();
  }));
  document.querySelectorAll("[data-action='open-secret']").forEach(btn => btn.addEventListener("click", openNewSecretModal));
  document.querySelectorAll("[data-action='open-marker']").forEach(btn => btn.addEventListener("click", openMarkerModal));
  document.querySelectorAll("[data-action='secret-detail']").forEach(btn => btn.addEventListener("click", () => openSecretDetail(btn.dataset.id)));
  document.querySelectorAll("[data-action='reveal-secret']").forEach(btn => btn.addEventListener("click", () => openRevealModal(btn.dataset.id)));
  document.querySelectorAll("[data-action='candidate-detail']").forEach(btn => btn.addEventListener("click", () => openCandidateModal(btn.dataset.id)));
  document.querySelectorAll("[data-action='approve-candidate']").forEach(btn => btn.addEventListener("click", () => openApproveCandidateModal(btn.dataset.id)));
  document.querySelectorAll("[data-action='segment-detail']").forEach(btn => btn.addEventListener("click", () => openSegmentModal(btn.dataset.id)));
  document.querySelectorAll("[data-action='focus-segment']").forEach(btn => btn.addEventListener("click", () => {
    const target = document.getElementById(`line-${btn.dataset.id}`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
  }));

  const search = $("#transcriptSearch");
  if (search) {
    search.addEventListener("input", () => {
      const q = search.value.toLowerCase().trim();
      const visible = DATA.transcript.filter(canView).filter(seg => !q || JSON.stringify(seg).toLowerCase().includes(q));
      $("#transcriptList").innerHTML = visible.map(seg => transcriptLine(seg)).join("") || `<div class="empty-state"><strong>Nada encontrado</strong><span>Ou o segredo tá tão bom que nem a busca achou.</span></div>`;
      bindViewEvents();
    });
  }
}

function openModal(html) {
  $("#modalBody").innerHTML = html;
  $("#modalBackdrop").classList.remove("hidden");
}

function closeModal() {
  $("#modalBackdrop").classList.add("hidden");
  $("#modalBody").innerHTML = "";
}

function openNewSecretModal() {
  openModal(`
    <h2>Novo segredo / decisão privada</h2>
    <p>Use isso para rascunhos pessoais, segredos com DM, planos entre players ou revelações controladas.</p>
    <div class="hint-box">Se pode mudar o mundo, compartilhe com o DM. Se só muda o coração do personagem, pode ficar privado.</div>
    <form id="newSecretForm" class="form-grid">
      <label class="field full">Título
        <input name="title" value="Nova decisão secreta" required />
      </label>
      <label class="field">Tipo
        <select name="type">
          <option>Diário privado</option>
          <option>Segredo de Personagem</option>
          <option>Segredo compartilhado</option>
          <option>Segredo do DM</option>
        </select>
      </label>
      <label class="field">Visibilidade
        <select name="visibility">
          <option value="player_only">Só eu</option>
          <option value="player_dm">Eu + DM</option>
          <option value="shared_dm">Eu + Screaky + DM</option>
          <option value="party">Mesa toda</option>
        </select>
      </label>
      <label class="field full">Descrição
        <textarea name="description">Exemplo: meu personagem decidiu guardar isso por enquanto, mas talvez revele depois.</textarea>
      </label>
      <div class="full row between">
        <button type="button" class="ghost" onclick="document.querySelector('#modalClose').click()">cancelar</button>
        <button class="primary" type="submit">criar mock</button>
      </div>
    </form>
  `);

  $("#newSecretForm").addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const visibility = fd.get("visibility");
    let visibleTo = [state.viewerId];
    let dmCanView = false;
    let canAffectCanon = false;
    if (visibility === "player_dm") { visibleTo = [state.viewerId, "dm"]; dmCanView = true; canAffectCanon = true; }
    if (visibility === "shared_dm") { visibleTo = [...new Set([state.viewerId, "bia", "dm"])]; dmCanView = true; canAffectCanon = true; }
    if (visibility === "party") { visibleTo = ["dm", "renan", "arthur", "bia"]; dmCanView = true; canAffectCanon = true; }

    const newSecret = {
      id: `local-${Date.now()}`,
      title: fd.get("title"),
      type: fd.get("type"),
      owner: state.viewerId,
      ownerCharacter: viewer().character,
      visibleTo,
      fictionKnows: [viewer().character],
      status: dmCanView ? "Compartilhado / elegível a canon" : "Não canon / privado",
      dmCanView,
      canAffectCanon,
      source: "Criado na demo",
      description: fd.get("description"),
      revealHistory: ["Criado manualmente na demo"]
    };
    state.localSecrets.unshift(newSecret);
    save();
    closeModal();
    state.view = "secrets";
    render();
  });
}

function openMarkerModal() {
  openModal(`
    <h2>Novo marcador rápido</h2>
    <p>Mock de comando que poderia vir de Discord, Roll20 ou Craig /note.</p>
    <form id="markerForm" class="form-grid">
      <label class="field">Timestamp
        <input name="t" value="${new Date().toTimeString().slice(0,8)}" />
      </label>
      <label class="field">Tipo
        <select name="type"><option>CANON?</option><option>FALA</option><option>SEGREDO</option><option>BASTIDOR</option><option>CORTAR</option></select>
      </label>
      <label class="field full">Texto
        <textarea name="text">Momento importante marcado pela mesa.</textarea>
      </label>
      <div class="full row between">
        <button type="button" class="ghost" onclick="document.querySelector('#modalClose').click()">cancelar</button>
        <button class="primary" type="submit">salvar marcador</button>
      </div>
    </form>
  `);
  $("#markerForm").addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    state.localMarkers.push({ t: fd.get("t"), type: fd.get("type"), text: fd.get("text") });
    save();
    closeModal();
    render();
  });
}

function openSecretDetail(id) {
  const s = allSecrets().find(x => x.id === id);
  if (!s || !canView(s)) return;
  openModal(`
    <h2>${escapeHtml(s.title)}</h2>
    <p>${escapeHtml(s.description)}</p>
    <div class="secret-meta">
      <div><span>Tipo</span><strong>${escapeHtml(s.type)}</strong></div>
      <div><span>Status</span><strong>${escapeHtml(s.status)}</strong></div>
      <div><span>Visível para</span><strong>${escapeHtml(s.visibleTo.map(resolveName).join(", "))}</strong></div>
      <div><span>Sabe na ficção</span><strong>${escapeHtml(s.fictionKnows.join(", "))}</strong></div>
      <div><span>DM vê?</span><strong>${s.dmCanView ? "Sim" : "Não"}</strong></div>
      <div><span>Afeta canon?</span><strong>${s.canAffectCanon ? "Sim" : "Não"}</strong></div>
    </div>
    <h3>Histórico de revelação</h3>
    <div class="timeline">
      ${s.revealHistory.map((h, i) => `<div class="timeline-item"><span class="time">${String(i+1).padStart(2,"0")}</span><p>${escapeHtml(h)}</p></div>`).join("")}
    </div>
  `);
}

function openRevealModal(id) {
  const s = allSecrets().find(x => x.id === id);
  if (!s || !canView(s)) return;
  openModal(`
    <h2>Revelar / compartilhar</h2>
    <p><strong>${escapeHtml(s.title)}</strong></p>
    <div class="hint-box">Esta demo não altera o segredo real, mas mostra o fluxo que o sistema final deveria ter.</div>
    <div class="grid cols-2">
      <div class="capture-row"><p>Compartilhar com DM</p>${badge("vira elegível a canon", "green")}</div>
      <div class="capture-row"><p>Compartilhar com player específico</p>${badge("segredo compartilhado", "purple")}</div>
      <div class="capture-row"><p>Revelar para personagens na ficção</p>${badge("atualiza conhecimento", "blue")}</div>
      <div class="capture-row"><p>Publicar no recap</p>${badge("exige revisão", "gold")}</div>
    </div>
    <div class="row between" style="margin-top:16px;">
      <button class="ghost" onclick="document.querySelector('#modalClose').click()">fechar</button>
      <button class="primary" onclick="alert('Mock: no sistema real isso criaria um registro em knowledge_reveals.')">simular revelação</button>
    </div>
  `);
}

function openCandidateModal(id) {
  const c = DATA.candidates.find(x => x.id === id);
  if (!c) return;
  openModal(`
    <h2>${escapeHtml(c.title)}</h2>
    <p>${escapeHtml(c.claim)}</p>
    <div class="secret-meta">
      <div><span>Status</span><strong>${escapeHtml(c.status)}</strong></div>
      <div><span>Confiança</span><strong>${Math.round(c.confidence * 100)}%</strong></div>
      <div><span>Sugestão de visibilidade</span><strong>${escapeHtml(c.visibilitySuggestion)}</strong></div>
      <div><span>Fonte</span><strong>${escapeHtml(c.source)} • ${escapeHtml(c.sourceTime)}</strong></div>
    </div>
    <p>Na versão final, esta tela teria player de áudio no timestamp, trecho original, Roll20 events conectados e botões de revisão.</p>
  `);
}

function openApproveCandidateModal(id) {
  const c = DATA.candidates.find(x => x.id === id);
  if (!c) return;
  openModal(`
    <h2>Aprovar candidato</h2>
    <p>${escapeHtml(c.title)}</p>
    <div class="form-grid">
      <label class="field">Status final
        <select><option>Canon público</option><option>Canon privado</option><option>Interpretação</option><option>Gancho futuro</option><option>Bastidor</option><option>Rejeitado</option></select>
      </label>
      <label class="field">Quem pode ver
        <select><option>Mesa toda</option><option>DM + dono</option><option>Jogadores específicos</option><option>Só DM</option></select>
      </label>
      <label class="field full">Quem sabe na ficção
        <input value="Dandelion, Astel, Screaky" />
      </label>
    </div>
    <div class="hint-box">Aprovar não é só dizer 'é canon'. É definir audiência, fonte e conhecimento narrativo.</div>
    <div class="row between">
      <button class="ghost" onclick="document.querySelector('#modalClose').click()">cancelar</button>
      <button class="primary" onclick="alert('Mock aprovado. No app real isso gravaria em canon_entries + knowledge_entries.')">aprovar mock</button>
    </div>
  `);
}

function openSegmentModal(id) {
  const seg = DATA.transcript.find(x => x.id === id);
  if (!seg || !canView(seg)) return;
  openModal(`
    <h2>Auditoria do segmento</h2>
    <p><strong>${escapeHtml(seg.time)} • ${escapeHtml(seg.character)}</strong></p>
    <blockquote>${escapeHtml(seg.text)}</blockquote>
    <div class="secret-meta">
      <div><span>Tipo</span><strong>${escapeHtml(seg.type)}</strong></div>
      <div><span>Acesso</span><strong>${escapeHtml(seg.access)}</strong></div>
      <div><span>Visível para</span><strong>${escapeHtml(seg.visibleTo.map(resolveName).join(", "))}</strong></div>
      <div><span>Sabe na ficção</span><strong>${escapeHtml(seg.fictionKnows.join(", ") || "ninguém")}</strong></div>
    </div>
    ${tags(seg.tags)}
  `);
}

init();
