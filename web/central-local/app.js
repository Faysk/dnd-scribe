const state = {
  session: null,
  query: "",
  speakers: new Set(),
  poller: null,
  health: null,
  jobs: [],
  reviewSegment: null,
};

const hostedMode = !["127.0.0.1", "localhost"].includes(window.location.hostname);
const apiOrigin = hostedMode
  ? (window.__CRAIG_API_ORIGIN__ || "http://127.0.0.1:8765")
  : window.location.origin;

const $ = (selector) => document.querySelector(selector);
const apiUrl = (path) => new URL(path, `${apiOrigin}/`).toString();
const formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;
const formatDisk = (bytes) => `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GiB`;
const formatTime = (seconds) => {
  const whole = Math.floor(seconds);
  return [Math.floor(whole / 3600), Math.floor((whole % 3600) / 60), whole % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
};
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);

async function api(path, options) {
  const request = new Request(apiUrl(path), {
    headers: { "Content-Type": "application/json" },
    mode: "cors",
    ...(hostedMode ? { targetAddressSpace: "loopback" } : {}),
    ...options,
  });
  const response = await fetch(request);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Erro HTTP ${response.status}`);
  }
  $("#bridgeBadge").textContent = hostedMode
    ? "PRODUÇÃO · PROCESSAMENTO NESTE PC"
    : "LOCAL · SEUS ÁUDIOS NÃO SAEM DO PC";
  $("#bridgeBadge").classList.add("connected");
  return response.json();
}

async function loadLibrary() {
  const [health, candidates, sessions, jobsPayload] = await Promise.all([
    api("/api/health"),
    api("/api/candidates"),
    api("/api/sessions"),
    api("/api/jobs?limit=20"),
  ]);
  state.health = health;
  state.jobs = jobsPayload.jobs || [];
  renderHealth();
  renderCandidates(candidates);
  renderSessions(sessions);
  renderJobs();
}

function renderHealth() {
  const health = state.health;
  $("#healthStatus").textContent = health.status === "ok" ? "PRONTO" : "ATENÇÃO";
  $("#healthStatus").className = `health-pill ${health.status}`;
  const jobs = health.jobs || {};
  $("#healthGrid").innerHTML = [
    ["GPU", health.cuda.available ? `${health.cuda.device_count} CUDA` : "Indisponível"],
    ["Disco livre", formatDisk(health.storage.free_bytes)],
    ["Arquivo", escapeHtml(health.storage.root)],
    ["Modelos", health.models.installed.length ? health.models.installed.map(escapeHtml).join(", ") : "Nenhum"],
    ["Sessões", String(health.sessions.total)],
    ["Fila", `${jobs.running || 0} rodando · ${jobs.queued || 0} aguardando`],
  ].map(([label, value]) => `<div class="health-card">
    <span>${label}</span>
    <strong>${value}</strong>
  </div>`).join("");
}

function renderJobs() {
  const target = $("#jobList");
  if (!state.jobs.length) {
    target.innerHTML = '<p class="empty">Nenhum processamento registrado.</p>';
    return;
  }
  target.innerHTML = state.jobs.map((job) => `<article class="job-row">
    <div>
      <span class="job-status ${escapeHtml(job.status)}">${escapeHtml(job.status)}</span>
      <strong>${escapeHtml(job.job_type)}</strong>
      <span>${escapeHtml(job.recording_id)}</span>
    </div>
    <div class="job-meta">
      <span>${job.attempts} tentativa(s)</span>
      ${job.error ? `<span class="job-error">${escapeHtml(job.error)}</span>` : ""}
      ${job.status === "failed"
        ? `<button class="ghost retry-job-button" data-job="${escapeHtml(job.id)}">Tentar novamente</button>`
        : ""}
    </div>
  </article>`).join("");
  document.querySelectorAll(".retry-job-button").forEach((button) => {
    button.addEventListener("click", () => retryJob(button.dataset.job));
  });
}

async function retryJob(jobId) {
  await api(`/api/jobs/${encodeURIComponent(jobId)}/retry`, { method: "POST" });
  await loadLibrary();
}

function renderCandidates(groups) {
  const target = $("#candidateList");
  if (!groups.length) {
    target.innerHTML = '<p class="empty">Nenhum ZIP válido encontrado na pasta de entrada.</p>';
    return;
  }
  target.innerHTML = groups.map((group) => {
    const recommended = group.choices.find((choice) => choice.recommended) || group.choices[0];
    const transcriptionReady = group.session_status === "complete" && group.session_mode === "full";
    const importedLabel = transcriptionReady
      ? '<p class="ready-label">✓ TRANSCRIÇÃO PRONTA</p>'
      : group.imported ? '<p class="imported-label">✓ SESSÃO JÁ IMPORTADA</p>' : "";
    const action = group.imported
      ? `<button class="${transcriptionReady ? "secondary" : "ghost"} candidate-open-button" data-id="${escapeHtml(group.recording_id)}">
          ${transcriptionReady ? "Abrir transcrição" : "Continuar sessão"} →
        </button>`
      : `<button class="primary import-button" data-path="${escapeHtml(recommended.path)}">
          Importar ${escapeHtml(recommended.format.toUpperCase())} →
        </button>`;
    return `<article class="card">
      <div>
        <p class="eyebrow">CRAIG · ${escapeHtml(group.recording_id)}</p>
        <h3>${group.speakers.length} participantes</h3>
        <p class="card-meta">${group.speakers.map(escapeHtml).join(" · ")}</p>
        <div class="format-row">${group.choices.map((choice) =>
          `<span class="format ${choice.recommended ? "recommended" : ""}">
            ${escapeHtml(choice.format.toUpperCase())} · ${formatBytes(choice.size)}
          </span>`).join("")}</div>
        ${importedLabel}
      </div>
      ${action}
    </article>`;
  }).join("");
  document.querySelectorAll(".import-button").forEach((button) => {
    button.addEventListener("click", () => importSession(button));
  });
  document.querySelectorAll(".candidate-open-button").forEach((button) => {
    button.addEventListener("click", () => openSession(button.dataset.id));
  });
}

function renderSessions(sessions) {
  const target = $("#sessionList");
  if (!sessions.length) {
    target.innerHTML = '<p class="empty">As sessões importadas aparecerão aqui.</p>';
    return;
  }
  target.innerHTML = sessions.map((session) => `<article class="card">
    <div>
      <p class="eyebrow">${escapeHtml((session.start_time || "DATA DESCONHECIDA").slice(0, 10))}</p>
      <h3>${escapeHtml(session.title || session.recording_id)}</h3>
      <p class="card-meta">${session.speakers.map(escapeHtml).join(" · ")}</p>
    </div>
    <button class="ghost open-button" data-id="${escapeHtml(session.recording_id)}">
      ${session.status === "complete" ? "Abrir transcrição" : "Continuar"} →
    </button>
  </article>`).join("");
  document.querySelectorAll(".open-button").forEach((button) => {
    button.addEventListener("click", () => openSession(button.dataset.id));
  });
}

async function importSession(button) {
  button.disabled = true;
  button.textContent = "Extraindo faixas…";
  try {
    const session = await api("/api/import", {
      method: "POST",
      body: JSON.stringify({ path: button.dataset.path }),
    });
    openSession(session.recording_id);
  } catch (error) {
    alert(error.message);
    button.disabled = false;
    button.textContent = "Tentar novamente";
  }
}

async function openSession(id) {
  clearInterval(state.poller);
  state.session = await api(`/api/sessions/${id}`);
  state.speakers = new Set(state.session.speakers);
  $("#libraryView").classList.add("hidden");
  $("#sessionView").classList.remove("hidden");
  renderSession();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderSession() {
  const session = state.session;
  $("#sessionTitle").textContent = session.title || session.recording_id;
  $("#sessionDate").textContent = session.start_time
    ? new Date(session.start_time).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" }).toUpperCase()
    : "SESSÃO";
  $("#speakerChips").innerHTML = session.speakers
    .map((speaker) => `<span class="chip active">${escapeHtml(speaker)}</span>`).join("");
  $("#exportButton").href = apiUrl(`/api/sessions/${session.recording_id}/export.md`);
  $("#publicationButton").href =
    apiUrl(`/api/sessions/${session.recording_id}/publication-bundle.json`);
  $("#metadataTitle").value = session.title || "";
  $("#metadataDate").value = session.played_at || (session.start_time || "").slice(0, 10);
  $("#metadataArc").value = session.arc || "";
  $("#metadataNotes").value = session.notes || "";

  const busy = ["queued", "loading_model", "transcribing"].includes(session.status);
  const fullComplete = session.status === "complete" && session.mode === "full";
  $("#setupPanel").classList.toggle("hidden", busy || fullComplete);
  $("#progressPanel").classList.toggle("hidden", !busy);
  $("#errorPanel").classList.toggle("hidden", session.status !== "error");
  $("#transcriptPanel").classList.toggle("hidden", !session.transcript?.length);

  if (session.status === "error") {
    $("#errorPanel").textContent = `A transcrição parou sem perder o ZIP ou as faixas.\n\n${session.error}`;
  }
  if (busy) {
    const progress = session.progress;
    const stageTitle = {
      checking_model: "Verificando o modelo…",
      downloading_model: "Baixando o modelo…",
      loading_cuda: "Carregando o modelo na GPU…",
      loading_cpu: "Carregando o modelo na CPU…",
    }[progress?.stage];
    $("#progressTitle").textContent =
      session.status === "transcribing" && progress
        ? `Transcrevendo ${progress.speaker}`
        : session.status === "queued" ? "Na fila…" : stageTitle || "Carregando o modelo…";
    $("#progressText").textContent = progress?.speaker
      ? `Faixa ${progress.track} de ${progress.total_tracks}. Você pode deixar esta aba aberta.`
      : "Na primeira vez, o download do modelo pode levar alguns minutos.";
    state.poller ||= setInterval(refreshSession, 2500);
  } else {
    clearInterval(state.poller);
    state.poller = null;
  }
  if (session.transcript?.length) {
    renderReviewSummary();
    renderTranscript();
  }
}

function renderReviewSummary() {
  const summary = state.session.review_summary || {};
  $("#reviewSummary").innerHTML = `
    <span><strong>${summary.approved || 0}</strong> aprovadas</span>
    <span><strong>${summary.needs_review || 0}</strong> para rever</span>
    <span><strong>${summary.discarded || 0}</strong> descartadas</span>
    <span><strong>${summary.unreviewed || 0}</strong> não revisadas</span>
  `;
}

async function refreshSession() {
  state.session = await api(`/api/sessions/${state.session.recording_id}`);
  renderSession();
}

async function startTranscription(sampleMinutes) {
  const cpu = $("#cpuMode").checked;
  try {
    state.session = await api(`/api/sessions/${state.session.recording_id}/transcribe`, {
      method: "POST",
      body: JSON.stringify({
        model: "large-v3-turbo",
        device: cpu ? "cpu" : "cuda",
        compute_type: cpu ? "int8" : "float16",
        glossary: $("#glossary").value,
        sample_minutes: sampleMinutes,
      }),
    });
    renderSession();
  } catch (error) {
    alert(error.message);
  }
}

function renderTranscript() {
  const session = state.session;
  $("#filterChips").innerHTML = session.speakers.map((speaker) =>
    `<button class="chip ${state.speakers.has(speaker) ? "active" : ""}" data-speaker="${escapeHtml(speaker)}">${escapeHtml(speaker)}</button>`
  ).join("");
  document.querySelectorAll("#filterChips .chip").forEach((button) => {
    button.addEventListener("click", () => {
      const speaker = button.dataset.speaker;
      state.speakers.has(speaker) ? state.speakers.delete(speaker) : state.speakers.add(speaker);
      renderTranscript();
    });
  });

  const query = state.query.trim().toLocaleLowerCase("pt-BR");
  const items = session.transcript.filter((item) =>
    state.speakers.has(item.speaker) && (!query || item.text.toLocaleLowerCase("pt-BR").includes(query))
  );
  $("#transcriptList").innerHTML = items.length ? items.map((item) => {
    let text = escapeHtml(item.text);
    if (query) {
      const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      text = text.replace(new RegExp(`(${safeQuery})`, "giu"), "<mark>$1</mark>");
    }
    return `<article class="utterance">
      <button class="time-button" data-track="${escapeHtml(item.track)}" data-time="${item.start}" data-speaker="${escapeHtml(item.speaker)}">
        ${formatTime(item.start)}
      </button>
      <span class="speaker">${escapeHtml(item.speaker)}</span>
      <p>${text}</p>
      <button class="review-button ${escapeHtml(item.review_status || "unreviewed")}" data-segment="${escapeHtml(item.id)}">
        ${reviewLabel(item.review_status)}
      </button>
    </article>`;
  }).join("") : '<p class="empty">Nenhuma fala corresponde aos filtros.</p>';
  document.querySelectorAll(".time-button").forEach((button) => {
    button.addEventListener("click", () => playAt(button));
  });
  document.querySelectorAll(".review-button").forEach((button) => {
    button.addEventListener("click", () => openReview(button.dataset.segment));
  });
}

function reviewLabel(status) {
  return {
    approved: "Aprovado",
    needs_review: "Rever",
    discarded: "Descartado",
    unreviewed: "Revisar",
  }[status || "unreviewed"];
}

function openReview(segmentId) {
  const segment = state.session.transcript.find((item) => item.id === segmentId);
  if (!segment) return;
  state.reviewSegment = segment;
  $("#reviewDialogTitle").textContent = `${formatTime(segment.start)} · ${segment.speaker}`;
  $("#reviewSpeaker").value = segment.speaker;
  $("#reviewText").value = segment.text;
  $("#reviewStatus").value = segment.review_status || "unreviewed";
  $("#reviewDialog").showModal();
}

async function saveReview() {
  const segment = state.reviewSegment;
  if (!segment) return;
  const button = $("#saveReviewButton");
  button.disabled = true;
  try {
    const payload = await api(
      `/api/sessions/${state.session.recording_id}/segments/${encodeURIComponent(segment.id)}/review`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: $("#reviewStatus").value,
          text: $("#reviewText").value,
          speaker: $("#reviewSpeaker").value,
        }),
      },
    );
    const index = state.session.transcript.findIndex((item) => item.id === segment.id);
    state.session.transcript[index] = payload.segment;
    state.session.review_summary = payload.review_summary;
    $("#reviewDialog").close();
    renderReviewSummary();
    renderTranscript();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
}

async function saveMetadata() {
  const button = $("#saveMetadataButton");
  button.disabled = true;
  try {
    state.session = await api(`/api/sessions/${state.session.recording_id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: $("#metadataTitle").value,
        played_at: $("#metadataDate").value || null,
        arc: $("#metadataArc").value,
        notes: $("#metadataNotes").value,
      }),
    });
    renderSession();
    button.textContent = "Salvo";
    setTimeout(() => { button.textContent = "Salvar metadados"; }, 1200);
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
}

function playAt(button) {
  const player = $("#audioPlayer");
  const url = apiUrl(
    `/api/sessions/${state.session.recording_id}/tracks/${encodeURIComponent(button.dataset.track)}`,
  );
  if (!player.src.endsWith(url)) player.src = url;
  const seek = () => {
    player.currentTime = Number(button.dataset.time);
    player.play();
  };
  player.readyState >= 1 ? seek() : player.addEventListener("loadedmetadata", seek, { once: true });
  $("#audioSpeaker").textContent = button.dataset.speaker;
}

$("#refreshButton").addEventListener("click", loadLibrary);
$("#backButton").addEventListener("click", () => {
  clearInterval(state.poller);
  state.poller = null;
  $("#sessionView").classList.add("hidden");
  $("#libraryView").classList.remove("hidden");
  loadLibrary();
});
$("#sampleButton").addEventListener("click", () => startTranscription(5));
$("#fullButton").addEventListener("click", () => startTranscription(null));
$("#saveMetadataButton").addEventListener("click", saveMetadata);
$("#saveReviewButton").addEventListener("click", saveReview);
$("#searchInput").addEventListener("input", (event) => {
  state.query = event.target.value;
  renderTranscript();
});

loadLibrary().catch((error) => {
  $("#bridgeBadge").textContent = "PC LOCAL DESCONECTADO";
  $("#bridgeBadge").classList.add("disconnected");
  $("#healthStatus").textContent = "OFFLINE";
  $("#healthStatus").className = "health-pill error";
  $("#healthGrid").innerHTML = "";
  $("#candidateList").innerHTML = `<div class="error-panel connection-error">
    <strong>Abra o companheiro no seu PC para continuar.</strong>
    <span>Execute <code>.\\run.ps1</code> em
    <code>E:\\Project\\craig-to-text</code>, permita o acesso à rede local no
    navegador e atualize esta página.</span>
    <small>${escapeHtml(error.message)}</small>
  </div>`;
});
