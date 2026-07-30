const state = {
  session: null,
  query: "",
  speakers: new Set(),
  poller: null,
  autoPublishing: false,
  health: null,
  jobs: [],
  reviewSegment: null,
  cloud: {
    client: null,
    user: null,
    profile: null,
    role: null,
    capabilities: {},
    rbac: null,
    workspace: "content",
    localLoaded: false,
    ready: false,
    sessions: [],
    editing: null,
    transcript: [],
    cursor: null,
    segment: null,
  },
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

async function cloudApi(path, options = {}) {
  if (!state.cloud.client) throw new Error("Faça login no DnD Scribe para editar.");
  const { data, error } = await state.cloud.client.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  if (!token) throw new Error("Entre no DnD Scribe antes de editar.");
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Erro HTTP ${response.status}`);
  return payload;
}

async function initCloudAuth() {
  if (!hostedMode || !window.supabase) {
    state.cloud.ready = true;
    $("#cloudStatus").textContent = hostedMode ? "LOGIN INDISPONÍVEL" : "USE EM PRODUÇÃO";
    $("#cloudStatus").className = "health-pill degraded";
    $("#cloudSessionList").innerHTML = hostedMode
      ? '<p class="empty">Não foi possível carregar o login do DnD Scribe.</p>'
      : '<p class="empty">A edição do banco fica disponível em dnd.faysk.dev/edit.</p>';
    return;
  }
  try {
    const configResponse = await fetch("/api/auth-config");
    const config = await configResponse.json();
    if (!configResponse.ok || !config.supabaseUrl || !config.publishableKey) return;
    state.cloud.client = window.supabase.createClient(config.supabaseUrl, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const { data } = await state.cloud.client.auth.getSession();
    state.cloud.user = data?.session?.user || null;
    if (state.cloud.user) {
      const profile = await cloudApi("/api/auth/me?campaignSlug=yuhara-main");
      state.cloud.profile = profile.profile || null;
      state.cloud.role = profile.campaignRole || null;
      state.cloud.capabilities = profile.capabilities || {};
      if (state.cloud.capabilities.canOpenEdit) await loadCloudSessions();
    }
  } catch (error) {
    console.warn("Arquivo remoto indisponível:", error.message);
  } finally {
    state.cloud.ready = true;
    configureWorkspaces();
    renderCloudAccess();
    if (state.session) renderSession();
  }
}

function renderCloudAccess() {
  const status = $("#cloudStatus");
  const list = $("#cloudSessionList");
  if (!state.cloud.user) {
    status.textContent = "LOGIN NECESSÁRIO";
    status.className = "health-pill degraded";
    list.innerHTML = '<p class="empty">Entre no DnD Scribe pela página inicial e volte ao Edit.</p>';
    return;
  }
  if (!state.cloud.capabilities.canOpenEdit) {
    status.textContent = "SEM PERMISSÃO";
    status.className = "health-pill degraded";
    list.innerHTML = '<p class="empty">Você entrou, mas o acesso ao Edit não está liberado para esta conta.</p>';
    return;
  }
  status.textContent = `${state.cloud.sessions.length} PUBLICADAS`;
  status.className = "health-pill ok";
  const canEdit = state.cloud.capabilities.canEditContent;
  list.innerHTML = state.cloud.sessions.map((session) => `<article class="card cloud-session-card">
    <div>
      <p class="eyebrow">${escapeHtml(session.sessionDate || "DATA NÃO DEFINIDA")}</p>
      <h3>${escapeHtml(session.title)}</h3>
      <p class="card-meta">${Number(session.segments || 0).toLocaleString("pt-BR")} falas · ${Number(session.needsReview || 0).toLocaleString("pt-BR")} aguardando revisão</p>
      ${session.summary ? `<p class="muted cloud-session-description">${escapeHtml(session.summary)}</p>` : ""}
    </div>
    <div class="cloud-session-actions" aria-label="Ações de ${escapeHtml(session.title)}">
      <button type="button" class="cloud-session-action" data-cloud-action="card" data-source-id="${escapeHtml(session.sourceSessionId)}" aria-label="${canEdit ? "Editar" : "Ver"} card de ${escapeHtml(session.title)}">Card</button>
      <button type="button" class="cloud-session-action" data-cloud-action="summary" data-source-id="${escapeHtml(session.sourceSessionId)}" aria-label="${canEdit ? "Editar" : "Ver"} resumo de ${escapeHtml(session.title)}">Resumo</button>
      <button type="button" class="cloud-session-action" data-cloud-action="transcript" data-source-id="${escapeHtml(session.sourceSessionId)}" aria-label="${canEdit ? "Revisar" : "Ver"} transcrição de ${escapeHtml(session.title)}">Transcrição</button>
    </div>
  </article>`).join("") || '<p class="empty">Nenhuma sessão publicada.</p>';
  document.querySelectorAll(".cloud-session-action").forEach((button) => {
    button.addEventListener("click", () => {
      const sourceSessionId = button.dataset.sourceId;
      if (button.dataset.cloudAction === "card") openCloudEditor(sourceSessionId);
      if (button.dataset.cloudAction === "summary") openCloudSummary(sourceSessionId);
      if (button.dataset.cloudAction === "transcript") {
        openCloudTranscript(sourceSessionId).catch((error) => alert(error.message));
      }
    });
  });
}

async function loadCloudSessions() {
  const payload = await cloudApi("/api/editor-sessions?campaignSlug=yuhara-main");
  state.cloud.sessions = payload.sessions || [];
}

function configureWorkspaces() {
  const canUseLocal = state.cloud.capabilities.canUseLocalProcessing || state.cloud.capabilities.canReadAudio;
  $("#localWorkspaceTab").classList.toggle("hidden", !canUseLocal);
  $("#permissionsWorkspaceTab").classList.toggle("hidden", !state.cloud.capabilities.canManagePermissions);
  ["#localHealthSection", "#localCandidateSection", "#localJobsSection"].forEach((selector) => {
    $(selector).classList.toggle("hidden", !state.cloud.capabilities.canUseLocalProcessing);
  });
  if (!state.cloud.capabilities.canOpenEdit) {
    document.querySelector(".workspace-tabs").classList.add("hidden");
    return;
  }
  document.querySelector(".workspace-tabs").classList.remove("hidden");
  selectWorkspace("content");
}

function localConnectionError(error) {
  $("#bridgeBadge").textContent = "PC LOCAL DESCONECTADO";
  $("#bridgeBadge").classList.remove("connected");
  $("#bridgeBadge").classList.add("disconnected");
  $("#healthStatus").textContent = "OFFLINE";
  $("#healthStatus").className = "health-pill degraded";
  $("#healthGrid").innerHTML = "";
  $("#candidateList").innerHTML = `<div class="error-panel connection-error">
    <strong>Abra o companheiro no seu PC para continuar.</strong>
    <span>Execute <code>.\\run.ps1</code> em
    <code>E:\\Project\\craig-to-text</code>, permita o acesso à rede local no
    navegador e atualize esta página.</span>
    <small>${escapeHtml(error.message)}</small>
  </div>`;
}

async function selectWorkspace(name) {
  if (name === "local" && !state.cloud.capabilities.canUseLocalProcessing && !state.cloud.capabilities.canReadAudio) return;
  if (name === "permissions" && !state.cloud.capabilities.canManagePermissions) return;
  state.cloud.workspace = name;
  $("#cloudWorkspace").classList.toggle("hidden", name !== "content");
  $("#localWorkspace").classList.toggle("hidden", name !== "local");
  $("#permissionsWorkspace").classList.toggle("hidden", name !== "permissions");
  $("#bridgeBadge").classList.toggle("hidden", name !== "local");
  document.querySelectorAll(".workspace-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.workspace === name);
  });
  if (name === "local" && !state.cloud.localLoaded) {
    state.cloud.localLoaded = true;
    const loader = state.cloud.capabilities.canUseLocalProcessing
      ? loadLibrary()
      : api("/api/sessions").then(renderSessions);
    await loader.catch(localConnectionError);
  }
  if (name === "permissions" && !state.cloud.rbac) {
    await loadPermissions().catch((error) => {
      $("#permissionsList").innerHTML = `<div class="error-panel">${escapeHtml(error.message)}</div>`;
    });
  }
}

const featureRoles = {
  edit_viewer: {
    label: "Ver Edit",
    description: "Abre a área sem alterar conteúdo.",
  },
  site_editor: {
    label: "Editar conteúdo",
    description: "Altera sessões, resumos e transcrições.",
  },
  local_operator: {
    label: "Processar e publicar",
    description: "Usa os arquivos e o processamento deste PC.",
  },
  audio_operator: {
    label: "Acessar áudio",
    description: "Ouve as faixas guardadas localmente.",
  },
};

function activeFeatureAssignment(profileId, roleSlug) {
  return (state.cloud.rbac?.assignments || []).find((assignment) => (
    assignment.profileId === profileId
    && assignment.roleSlug === roleSlug
    && assignment.scopeType === "campaign"
    && assignment.scopeId === "yuhara-main"
    && assignment.status === "active"
    && !assignment.endsAt
  ));
}

function profileFeatureState(profileId) {
  const editor = activeFeatureAssignment(profileId, "site_editor");
  const viewer = activeFeatureAssignment(profileId, "edit_viewer");
  return {
    edit_viewer: Boolean(viewer || editor),
    site_editor: Boolean(editor),
    local_operator: Boolean(activeFeatureAssignment(profileId, "local_operator")),
    audio_operator: Boolean(activeFeatureAssignment(profileId, "audio_operator")),
  };
}

async function loadPermissions() {
  $("#permissionsList").innerHTML = '<p class="empty">Carregando permissões…</p>';
  state.cloud.rbac = await cloudApi("/api/rbac?campaignSlug=yuhara-main");
  renderPermissions();
}

function renderPermissions() {
  const profiles = (state.cloud.rbac?.profiles || []).filter((profile) => profile.legacyCampaignRole);
  $("#permissionsList").innerHTML = profiles.map((profile) => {
    const enabled = profileFeatureState(profile.id);
    return `<article class="permission-card">
      <div class="permission-person">
        <strong>${escapeHtml(profile.displayName || profile.roll20Name || "Pessoa sem nome")}</strong>
        <span>${escapeHtml(profile.email || profile.discordHandle || profile.legacyCampaignRole || "")}</span>
      </div>
      <div class="permission-toggles">
        ${Object.entries(featureRoles).map(([roleSlug, feature]) => `<label class="permission-toggle">
          <input type="checkbox" data-profile-id="${escapeHtml(profile.id)}" data-role-slug="${roleSlug}" ${enabled[roleSlug] ? "checked" : ""} />
          <span>${escapeHtml(feature.label)}</span>
          <small>${escapeHtml(feature.description)}</small>
        </label>`).join("")}
      </div>
    </article>`;
  }).join("") || '<p class="empty">Nenhuma pessoa vinculada à campanha.</p>';
  document.querySelectorAll(".permission-toggle input").forEach((input) => {
    input.addEventListener("change", () => changeFeaturePermission(input));
  });
}

async function assignFeatureRole(profileId, roleSlug) {
  const payload = await cloudApi("/api/rbac/assign", {
    method: "POST",
    body: JSON.stringify({
      campaignSlug: "yuhara-main",
      profileId,
      roleSlug,
      scopeType: "campaign",
      scopeId: "yuhara-main",
      reason: "Permissão alterada no Edit.",
    }),
  });
  state.cloud.rbac = payload.rbac;
}

async function revokeFeatureRole(profileId, roleSlug) {
  const assignment = activeFeatureAssignment(profileId, roleSlug);
  if (!assignment) return;
  const payload = await cloudApi("/api/rbac/revoke", {
    method: "POST",
    body: JSON.stringify({
      campaignSlug: "yuhara-main",
      assignmentId: assignment.id,
      reason: "Permissão alterada no Edit.",
    }),
  });
  state.cloud.rbac = payload.rbac;
}

async function changeFeaturePermission(input) {
  const profileId = input.dataset.profileId;
  const roleSlug = input.dataset.roleSlug;
  const enabled = input.checked;
  const card = input.closest(".permission-toggle");
  card.classList.add("busy");
  try {
    if (roleSlug === "edit_viewer") {
      if (enabled) {
        if (!activeFeatureAssignment(profileId, "site_editor")) {
          await assignFeatureRole(profileId, "edit_viewer");
        }
      } else {
        await revokeFeatureRole(profileId, "site_editor");
        await revokeFeatureRole(profileId, "edit_viewer");
      }
    } else if (roleSlug === "site_editor") {
      if (enabled) {
        await assignFeatureRole(profileId, "site_editor");
        await revokeFeatureRole(profileId, "edit_viewer");
      } else {
        await revokeFeatureRole(profileId, "site_editor");
        await assignFeatureRole(profileId, "edit_viewer");
      }
    } else if (enabled) {
      await assignFeatureRole(profileId, roleSlug);
    } else {
      await revokeFeatureRole(profileId, roleSlug);
    }
    renderPermissions();
  } catch (error) {
    input.checked = !enabled;
    alert(error.message);
    card.classList.remove("busy");
  }
}

function openCloudEditor(sourceSessionId) {
  const session = state.cloud.sessions.find((item) => item.sourceSessionId === sourceSessionId);
  if (!session) return;
  state.cloud.editing = session;
  $("#cloudEditorTitle").textContent = session.title;
  $("#cloudTitle").value = session.title || "";
  $("#cloudDate").value = session.sessionDate || "";
  $("#cloudArc").value = session.arc || "";
  $("#cloudCover").value = session.coverImageUrl || "";
  $("#cloudHero").value = session.heroImageUrl || "";
  $("#cloudSummary").value = session.summary || "";
  const readOnly = !state.cloud.capabilities.canEditContent;
  $("#cloudEditorDialog").querySelectorAll("input, textarea").forEach((field) => {
    field.disabled = readOnly;
  });
  $("#saveCloudSessionButton").classList.toggle("hidden", readOnly);
  $("#cloudEditorDialog").showModal();
}

function openCloudSummary(sourceSessionId) {
  const session = state.cloud.sessions.find((item) => item.sourceSessionId === sourceSessionId);
  if (!session) return;
  state.cloud.editing = session;
  $("#cloudSummaryTitle").textContent = session.title;
  $("#cloudSummaryFull").value = session.summaryFull || "";
  renderCloudSummaryPreview();
  $("#cloudSummaryFull").scrollTop = 0;
  $("#cloudSummaryPreviewScroll").scrollTop = 0;
  const readOnly = !state.cloud.capabilities.canEditContent;
  $("#cloudSummaryFull").disabled = readOnly;
  $("#saveCloudSummaryButton").classList.toggle("hidden", readOnly);
  $("#cloudSummaryDialog").showModal();
}

function renderSafeMarkdown(markdown) {
  const source = String(markdown || "").replace(/^[\u200B-\u200F\uFEFF]/, "");
  if (!source.trim()) return '<p class="muted">A prévia aparecerá aqui.</p>';
  if (!window.marked?.parse || !window.DOMPurify?.sanitize) {
    return `<p>${escapeHtml(source || "A prévia aparecerá aqui.")}</p>`;
  }
  return window.DOMPurify.sanitize(window.marked.parse(source, {
    gfm: true,
    breaks: false,
  }), {
    USE_PROFILES: { html: true },
  });
}

function renderCloudSummaryPreview() {
  $("#cloudSummaryPreview").innerHTML = renderSafeMarkdown($("#cloudSummaryFull").value);
  window.requestAnimationFrame(() => {
    syncCloudSummaryScroll($("#cloudSummaryFull"), $("#cloudSummaryPreviewScroll"));
  });
}

function syncCloudSummaryScroll(source, target) {
  if (syncCloudSummaryScroll.locked) return;
  const sourceRange = source.scrollHeight - source.clientHeight;
  const targetRange = target.scrollHeight - target.clientHeight;
  const progress = sourceRange > 0 ? source.scrollTop / sourceRange : 0;
  syncCloudSummaryScroll.locked = true;
  target.scrollTop = progress * Math.max(targetRange, 0);
  window.requestAnimationFrame(() => {
    syncCloudSummaryScroll.locked = false;
  });
}

function scheduleCloudSummaryPreview() {
  window.clearTimeout(scheduleCloudSummaryPreview.timer);
  scheduleCloudSummaryPreview.timer = window.setTimeout(renderCloudSummaryPreview, 120);
}

async function saveCloudSession() {
  const session = state.cloud.editing;
  if (!session) return;
  const button = $("#saveCloudSessionButton");
  button.disabled = true;
  try {
    await cloudApi("/api/editor-session", {
      method: "POST",
      body: JSON.stringify({
        campaignSlug: "yuhara-main",
        sourceSessionId: session.sourceSessionId,
        title: $("#cloudTitle").value,
        sessionDate: $("#cloudDate").value,
        arc: $("#cloudArc").value,
        coverImageUrl: $("#cloudCover").value,
        heroImageUrl: $("#cloudHero").value,
        summary: $("#cloudSummary").value,
        summaryFull: session.summaryFull || "",
      }),
    });
    await loadCloudSessions();
    renderCloudAccess();
    $("#cloudEditorDialog").close();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
}

async function saveCloudSummary() {
  const session = state.cloud.editing;
  if (!session) return;
  const button = $("#saveCloudSummaryButton");
  button.disabled = true;
  try {
    await cloudApi("/api/editor-session", {
      method: "POST",
      body: JSON.stringify({
        campaignSlug: "yuhara-main",
        sourceSessionId: session.sourceSessionId,
        title: session.title || "",
        sessionDate: session.sessionDate || "",
        arc: session.arc || "",
        coverImageUrl: session.coverImageUrl || "",
        heroImageUrl: session.heroImageUrl || "",
        summary: session.summary || "",
        summaryFull: $("#cloudSummaryFull").value,
      }),
    });
    await loadCloudSessions();
    renderCloudAccess();
    $("#cloudSummaryDialog").close();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
}

async function loadCloudTranscript({ append = false } = {}) {
  const session = state.cloud.editing;
  if (!session) return;
  const params = new URLSearchParams({
    campaignSlug: "yuhara-main",
    sourceSessionId: session.sourceSessionId,
    limit: "120",
  });
  if (append && state.cloud.cursor) params.set("cursor", state.cloud.cursor);
  const payload = await cloudApi(`/api/library-transcript?${params}`);
  state.cloud.transcript = append
    ? [...state.cloud.transcript, ...(payload.segments || [])]
    : (payload.segments || []);
  state.cloud.cursor = payload.nextCursor || null;
  $("#cloudTranscriptTitle").textContent = session.title;
  $("#cloudTranscriptList").innerHTML = state.cloud.transcript.map((segment) => `<article class="cloud-segment">
    <time>${formatTime(Number(segment.startMs || 0) / 1000)}</time>
    <strong>${escapeHtml(segment.speaker)}</strong>
    <p>${escapeHtml(segment.text)}</p>
    <button type="button" class="ghost cloud-segment-button" data-segment-id="${escapeHtml(segment.id)}">${state.cloud.capabilities.canEditContent ? reviewLabel(segment.reviewStatus) : "Ver"}</button>
  </article>`).join("");
  $("#loadMoreCloudSegments").classList.toggle("hidden", !state.cloud.cursor);
  document.querySelectorAll(".cloud-segment-button").forEach((button) => {
    button.addEventListener("click", () => openCloudSegment(button.dataset.segmentId));
  });
}

async function openCloudTranscript(sourceSessionId) {
  const session = sourceSessionId
    ? state.cloud.sessions.find((item) => item.sourceSessionId === sourceSessionId)
    : state.cloud.editing;
  if (!session) return;
  state.cloud.editing = session;
  state.cloud.transcript = [];
  state.cloud.cursor = null;
  await loadCloudTranscript();
  $("#cloudTranscriptDialog").showModal();
}

function openCloudSegment(segmentId) {
  const segment = state.cloud.transcript.find((item) => String(item.id) === String(segmentId));
  if (!segment) return;
  state.cloud.segment = segment;
  $("#cloudSegmentTitle").textContent = `${formatTime(Number(segment.startMs || 0) / 1000)} · ${segment.speaker}`;
  $("#cloudSegmentSpeaker").value = segment.speaker;
  $("#cloudSegmentText").value = segment.text;
  $("#cloudSegmentStatus").value = ["approved", "needs_review", "discarded"].includes(segment.reviewStatus)
    ? segment.reviewStatus : "unreviewed";
  const readOnly = !state.cloud.capabilities.canEditContent;
  $("#cloudSegmentDialog").querySelectorAll("input, textarea, select").forEach((field) => {
    field.disabled = readOnly;
  });
  $("#saveCloudSegmentButton").classList.toggle("hidden", readOnly);
  $("#cloudSegmentDialog").showModal();
}

async function saveCloudSegment() {
  const segment = state.cloud.segment;
  const session = state.cloud.editing;
  if (!segment || !session) return;
  const button = $("#saveCloudSegmentButton");
  button.disabled = true;
  try {
    const payload = await cloudApi("/api/editor-segment", {
      method: "POST",
      body: JSON.stringify({
        campaignSlug: "yuhara-main",
        sourceSessionId: session.sourceSessionId,
        segmentId: segment.id,
        speaker: $("#cloudSegmentSpeaker").value,
        text: $("#cloudSegmentText").value,
        reviewStatus: $("#cloudSegmentStatus").value,
      }),
    });
    const index = state.cloud.transcript.findIndex((item) => String(item.id) === String(segment.id));
    state.cloud.transcript[index] = payload.segment;
    $("#cloudSegmentDialog").close();
    await loadCloudTranscript();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
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

async function selectArchive() {
  const button = $("#selectArchiveButton");
  const status = $("#archiveImportStatus");
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Aguardando seleção no Windows…";
  status.className = "import-status";
  status.textContent = "Escolha o ZIP na janela que foi aberta.";
  try {
    const result = await api("/api/import/select", { method: "POST" });
    if (result.cancelled) {
      status.textContent = "Nenhum arquivo foi selecionado.";
      return;
    }
    const filename = result.archive?.filename || "ZIP do Craig";
    if (result.duplicate) {
      status.textContent = `${filename} já estava importado. Abrindo a sessão existente…`;
    } else if (result.sample_started) {
      status.classList.add("success");
      status.textContent = `${filename} importado com segurança. A amostra de 5 minutos já está na fila.`;
    } else {
      status.classList.add("warning");
      status.textContent = result.sample_blocked_reason || `${filename} importado.`;
    }
    await openSession(result.session.recording_id);
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function renderCandidates(groups) {
  const target = $("#candidateList");
  if (!groups.length) {
    target.innerHTML = '<p class="empty">Nenhum arquivo aguardando importação manual. Use “Selecionar ZIP do Craig” acima.</p>';
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
  const canPublish = hostedMode
    && session.status === "complete"
    && session.mode === "full"
    && state.cloud.capabilities.canUseLocalProcessing;
  $("#publishButton").classList.toggle("hidden", !canPublish);
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
  if (fullComplete && canPublish && !state.autoPublishing && $("#publishButton").dataset.published !== "true") {
    state.autoPublishing = true;
    window.setTimeout(() => publishSession().finally(() => {
      state.autoPublishing = false;
    }), 0);
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
  return ({
    approved: "Aprovado",
    needs_review: "Rever",
    discarded: "Descartado",
    unreviewed: "Revisar",
    pending: "Revisar",
  }[status || "unreviewed"] || "Revisar");
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

async function publishSession() {
  const button = $("#publishButton");
  const session = state.session;
  if (!session?.transcript?.length) return;
  button.disabled = true;
  button.textContent = "Publicando somente o texto…";
  try {
    const bundle = await api(
      `/api/sessions/${session.recording_id}/publication-bundle.json`,
    );
    const payload = {
      campaignSlug: "yuhara-main",
      sourceId: session.recording_id,
      title: session.title || "",
      playedAt: session.played_at || (session.start_time || "").slice(0, 10),
      startTime: session.start_time || null,
      arc: session.arc || "",
      summary: session.notes || session.recap?.short || "",
      publicationId: bundle.publication_id || null,
      transcriptSha256: bundle.source_manifest?.transcript_sha256 || null,
      segments: session.transcript.map((segment, index) => ({
        id: segment.id ?? index,
        start: segment.start,
        end: segment.end,
        speaker: segment.speaker,
        track: segment.track,
        text: segment.text,
        reviewStatus: segment.review_status || "unreviewed",
      })),
    };
    const result = await cloudApi("/api/library-import-local", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    button.textContent = `Publicado · ${result.segments} falas`;
    button.dataset.published = "true";
    window.setTimeout(() => {
      button.textContent = "Abrir no arquivo →";
      button.disabled = false;
    }, 1400);
  } catch (error) {
    button.textContent = "Tentar publicar novamente";
    button.disabled = false;
    alert(`A publicação não enviou áudio nem alterou seus arquivos locais.\n\n${error.message}`);
  }
}

function playAt(button) {
  if (!state.cloud.capabilities.canReadAudio) {
    alert("Sua conta não tem permissão para acessar os áudios deste computador.");
    return;
  }
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
$("#selectArchiveButton").addEventListener("click", selectArchive);
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
$("#publishButton").addEventListener("click", () => {
  if ($("#publishButton").dataset.published === "true") {
    window.location.href = `/#/sessao/${encodeURIComponent(state.session.recording_id)}`;
    return;
  }
  publishSession();
});
$("#saveCloudSessionButton").addEventListener("click", saveCloudSession);
$("#saveCloudSummaryButton").addEventListener("click", saveCloudSummary);
$("#saveCloudSegmentButton").addEventListener("click", saveCloudSegment);
$("#loadMoreCloudSegments").addEventListener("click", () => {
  loadCloudTranscript({ append: true }).catch((error) => alert(error.message));
});
$("#searchInput").addEventListener("input", (event) => {
  state.query = event.target.value;
  renderTranscript();
});
$("#cloudSummaryFull").addEventListener("input", scheduleCloudSummaryPreview);
$("#cloudSummaryFull").addEventListener("scroll", () => {
  syncCloudSummaryScroll($("#cloudSummaryFull"), $("#cloudSummaryPreviewScroll"));
});
$("#cloudSummaryPreviewScroll").addEventListener("scroll", () => {
  syncCloudSummaryScroll($("#cloudSummaryPreviewScroll"), $("#cloudSummaryFull"));
});
document.querySelectorAll(".workspace-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    selectWorkspace(tab.dataset.workspace).catch((error) => alert(error.message));
  });
});
$("#refreshPermissionsButton").addEventListener("click", () => {
  loadPermissions().catch((error) => alert(error.message));
});
initCloudAuth();
