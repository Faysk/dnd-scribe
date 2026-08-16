(() => {
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
    @media (max-width: 480px) { .transcription-profile-grid { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(style);

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
    const cpu = Boolean(document.querySelector("#cpuMode")?.checked);
    const selected = document.querySelector('input[name="transcriptionProfile"]:checked')?.value || "detailed";
    const profile = sampleMinutes ? "fast" : selected;
    if (!profileSupported(profile)) {
      alert("Atualize o DnD Scribe Companion para a versão 0.4.1 ou mais recente antes de iniciar uma nova transcrição.");
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
    const status = document.querySelector("#healthStatus");
    if (status) {
      status.textContent = health.status === "ok" ? "PRONTO" : "ATENÇÃO";
      status.className = `health-pill ${health.status}`;
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
  };

  installProfileControls();
  if (state?.health) renderHealth();
})();
