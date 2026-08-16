(() => {
  const LATEST_COMPANION_VERSION = "0.4.1";

  const style = document.createElement("style");
  style.textContent = `
    .transcription-profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .transcription-profile {
      display: grid; gap: 5px; padding: 11px; border: 1px solid var(--line);
      border-radius: 8px; cursor: pointer; background: transparent;
    }
    .transcription-profile:has(input:checked) { border-color: var(--purple); background: rgba(215,170,97,.10); }
    .transcription-profile input { accent-color: var(--purple); justify-self: start; }
    .transcription-profile strong { font-size: 12px; }
    .transcription-profile small, .gpu-first-note { color: var(--muted); font-size: 10px; line-height: 1.4; }
    .gpu-first-note { margin: 2px 0 0; }
    .companion-update-panel {
      display: flex; align-items: center; justify-content: space-between; gap: 18px;
      margin-top: 16px; padding: 16px 18px; border: 1px solid rgba(220,172,89,.55);
      background: rgba(220,172,89,.08); border-radius: 10px;
    }
    .companion-update-panel.hidden { display: none; }
    .companion-update-copy { display: grid; gap: 4px; }
    .companion-update-copy strong { font-size: 14px; }
    .companion-update-copy span, .companion-update-copy small { color: var(--muted); line-height: 1.45; }
    .companion-update-copy small { font-size: 10px; }
    .companion-update-actions { display: grid; gap: 7px; justify-items: end; min-width: 190px; }
    .companion-update-actions small { color: var(--muted); text-align: right; max-width: 300px; }
    @media (max-width: 680px) {
      .transcription-profile-grid { grid-template-columns: 1fr; }
      .companion-update-panel { align-items: stretch; flex-direction: column; }
      .companion-update-actions { justify-items: stretch; min-width: 0; }
      .companion-update-actions small { text-align: left; }
    }
  `;
  document.head.appendChild(style);

  function versionParts(value) {
    const parts = String(value || "0.0.0").split(".").map((part) => Number.parseInt(part, 10));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }

  function compareVersions(left, right) {
    const a = versionParts(left);
    const b = versionParts(right);
    for (let index = 0; index < 3; index += 1) {
      if (a[index] > b[index]) return 1;
      if (a[index] < b[index]) return -1;
    }
    return 0;
  }

  function triggerBrowserDownload(download) {
    const link = document.createElement("a");
    link.href = download.url;
    link.download = download.filename || "DnDScribeCompanionSetup.exe";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function privateRelease() {
    const payload = await cloudApi("/api/companion-download?campaignSlug=yuhara-main");
    if (!payload?.download?.url) throw new Error("O instalador privado não está disponível.");
    return payload.download;
  }

  async function downloadLatestCompanion(statusTarget) {
    const download = await privateRelease();
    triggerBrowserDownload(download);
    if (statusTarget) {
      statusTarget.textContent = `Companion ${LATEST_COMPANION_VERSION} baixado. Execute o instalador para concluir.`;
    }
    return download;
  }

  function installUpdatePanel() {
    const section = document.querySelector("#localHealthSection");
    if (!section || document.querySelector("#companionUpdatePanel")) return;
    const panel = document.createElement("div");
    panel.id = "companionUpdatePanel";
    panel.className = "companion-update-panel hidden";
    panel.innerHTML = `
      <div class="companion-update-copy">
        <strong id="companionUpdateTitle">Atualização do Companion</strong>
        <span id="companionUpdateVersions"></span>
        <small>ZIPs, áudios, modelos e transcrições são preservados durante a atualização.</small>
      </div>
      <div class="companion-update-actions">
        <button class="primary" id="updateCompanionButton" type="button">Atualizar Companion</button>
        <small id="companionUpdateStatus" role="status" aria-live="polite"></small>
      </div>`;
    section.appendChild(panel);
    document.querySelector("#updateCompanionButton")?.addEventListener("click", startCompanionUpdate);
  }

  function renderUpdatePanel() {
    installUpdatePanel();
    const panel = document.querySelector("#companionUpdatePanel");
    if (!panel) return;
    const installed = state?.health?.companion?.version || "0.0.0";
    const canDownload = Boolean(state?.cloud?.capabilities?.canDownloadCompanion);
    const outdated = compareVersions(installed, LATEST_COMPANION_VERSION) < 0;
    panel.classList.toggle("hidden", !canDownload || !outdated);
    if (!canDownload || !outdated) return;
    document.querySelector("#companionUpdateVersions").textContent =
      `Instalado v${installed} · disponível v${LATEST_COMPANION_VERSION}`;
    const button = document.querySelector("#updateCompanionButton");
    if (button) button.textContent = installed === "0.0.0" ? "Baixar Companion" : "Atualizar Companion";
  }

  async function startCompanionUpdate() {
    const button = document.querySelector("#updateCompanionButton");
    const status = document.querySelector("#companionUpdateStatus");
    if (!button || !status) return;
    button.disabled = true;
    status.textContent = "Preparando atualização privada…";
    try {
      const download = await privateRelease();
      const installed = state?.health?.companion?.version || "0.0.0";
      if (compareVersions(installed, "0.4.1") >= 0) {
        try {
          status.textContent = "Baixando e verificando no Companion…";
          const result = await api("/api/update", {
            method: "POST",
            body: JSON.stringify({
              version: LATEST_COMPANION_VERSION,
              url: download.url,
            }),
          });
          if (result.status === "current") {
            status.textContent = "Este Companion já está atualizado.";
            panelRefreshSoon();
            return;
          }
          status.textContent = "Instalador aberto no Windows. Confirme a instalação para concluir.";
          return;
        } catch (error) {
          console.warn("Atualizador local indisponível; usando download pelo navegador:", error.message);
        }
      }

      triggerBrowserDownload(download);
      status.textContent = installed === "0.0.0"
        ? `Companion ${LATEST_COMPANION_VERSION} baixado. Execute o instalador.`
        : `Sua versão v${installed} precisa de uma atualização manual desta vez. O instalador ${LATEST_COMPANION_VERSION} foi baixado; execute-o. Depois disso, as próximas versões poderão abrir o instalador pelo próprio Companion.`;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }

  function panelRefreshSoon() {
    window.setTimeout(async () => {
      try {
        state.health = await api("/api/health");
        renderHealth();
      } catch (_) { }
    }, 1800);
  }

  function installDownloadOverride() {
    const button = document.querySelector("#downloadCompanionButton");
    if (!button || button.dataset.releaseOverride === "1") return;
    button.dataset.releaseOverride = "1";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const status = document.querySelector("#companionDownloadStatus");
      button.disabled = true;
      if (status) status.textContent = "Preparando um download privado…";
      try {
        await downloadLatestCompanion(status);
      } catch (error) {
        if (status) status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    }, true);
  }

  function installProfileControls() {
    const runOptions = document.querySelector(".run-options");
    if (!runOptions || document.querySelector("#transcriptionProfiles")) return;
    const profiles = document.createElement("div");
    profiles.id = "transcriptionProfiles";
    profiles.className = "transcription-profile-grid";
    profiles.setAttribute("role", "radiogroup");
    profiles.setAttribute("aria-label", "Qualidade da transcrição");
    profiles.innerHTML = `
      <label class="transcription-profile">
        <input type="radio" name="transcriptionProfile" value="fast" />
        <strong>⚡ Rápido</strong>
        <small>large-v3-turbo · mais veloz</small>
      </label>
      <label class="transcription-profile">
        <input type="radio" name="transcriptionProfile" value="detailed" checked />
        <strong>🎯 Detalhado</strong>
        <small>large-v3 · melhor qualidade</small>
      </label>`;
    runOptions.prepend(profiles);
    const sampleButton = document.querySelector("#sampleButton");
    if (sampleButton) sampleButton.textContent = "Testar 5 minutos · Rápido";
    const cpu = document.querySelector("#cpuMode");
    const cpuLabel = cpu?.closest("label");
    if (cpuLabel) cpuLabel.childNodes[cpuLabel.childNodes.length - 1].textContent = " Usar CPU (avançado · manual)";
    const note = document.createElement("p");
    note.className = "gpu-first-note";
    note.textContent = "GPU NVIDIA é o padrão. O Companion nunca troca para CPU sozinho.";
    runOptions.appendChild(note);
  }

  function profileSupported(profile) {
    return Array.isArray(state?.health?.profiles)
      && state.health.profiles.some((item) => item.name === profile);
  }

  startTranscription = async function startTranscriptionV04(sampleMinutes) {
    if (state?.cloud?.capabilities && !state.cloud.capabilities.canUseLocalProcessing) {
      alert("Sua conta não tem permissão para processar arquivos neste computador.");
      return;
    }
    const cpu = Boolean(document.querySelector("#cpuMode")?.checked);
    const selected = document.querySelector('input[name="transcriptionProfile"]:checked')?.value || "detailed";
    const profile = sampleMinutes ? "fast" : selected;
    if (!profileSupported(profile)) {
      alert(`Atualize o DnD Scribe Companion para a versão ${LATEST_COMPANION_VERSION} antes de iniciar uma nova transcrição.`);
      return;
    }
    try {
      state.session = await api(`/api/sessions/${state.session.recording_id}/transcribe`, {
        method: "POST",
        body: JSON.stringify({
          profile,
          cpu,
          glossary: document.querySelector("#glossary")?.value || "",
          sample_minutes: sampleMinutes,
        }),
      });
      renderSession();
    } catch (error) {
      alert(error.message);
    }
  };

  renderHealth = function renderHealthV04() {
    const health = state.health;
    if (!health) return;
    const installed = health.companion?.version || "0.0.0";
    const updateAvailable = Boolean(state?.cloud?.capabilities?.canDownloadCompanion)
      && compareVersions(installed, LATEST_COMPANION_VERSION) < 0;
    const status = document.querySelector("#healthStatus");
    if (status) {
      status.textContent = updateAvailable ? "ATUALIZAR" : (health.status === "ok" ? "PRONTO" : "ATENÇÃO");
      status.className = `health-pill ${updateAvailable ? "degraded" : health.status}`;
    }
    const cuda = health.cuda || {};
    const gpu = Array.isArray(cuda.devices) ? cuda.devices[0] : null;
    const gpuLabel = gpu?.name || (cuda.available ? `${cuda.device_count || 1} CUDA` : "Indisponível");
    const vram = gpu
      ? `${(Number(gpu.memory_free_mib || 0) / 1024).toFixed(1)} / ${(Number(gpu.memory_total_mib || 0) / 1024).toFixed(1)} GiB livres`
      : "—";
    const compute = Array.isArray(cuda.supported_compute_types) && cuda.supported_compute_types.length
      ? cuda.supported_compute_types.join(", ")
      : "—";
    const atomic = health.storage?.atomic_replace;
    const jobs = health.jobs || {};
    const rows = [
      ["Companion", health.companion?.version ? `v${health.companion.version}` : "Instalado"],
      ["GPU", gpuLabel],
      ["VRAM", vram],
      ["Compute GPU", compute],
      ["CTranslate2", cuda.ctranslate2_version || "—"],
      ["Escrita segura", atomic ? (atomic.ok ? "OK" : "Falhou") : (health.storage?.writable ? "OK" : "Falhou")],
      ["Disco livre", typeof health.storage?.free_bytes === "number" ? formatDisk(health.storage.free_bytes) : "—"],
      ["Modelos", health.models?.installed?.length ? health.models.installed.map(escapeHtml).join(", ") : "Nenhum"],
      ["Sessões", String(health.sessions?.total || 0)],
      ["Fila", `${jobs.running || 0} rodando · ${jobs.queued || 0} aguardando`],
    ];
    const grid = document.querySelector("#healthGrid");
    if (grid) {
      grid.innerHTML = rows.map(([label, value]) => `<div class="health-card"><span>${label}</span><strong>${value}</strong></div>`).join("");
    }
    renderUpdatePanel();
  };

  installProfileControls();
  installUpdatePanel();
  installDownloadOverride();
  if (state?.health) renderHealth();
})();
