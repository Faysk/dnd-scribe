(function () {
  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function bytes(value = 0) {
    const number = Number(value || 0);
    if (!Number.isFinite(number) || number <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = number;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit += 1;
    }
    return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
  }

  function minutes(value = 0) {
    const number = Number(value || 0);
    if (!Number.isFinite(number) || number <= 0) return '0 min';
    if (number < 60) return `${number.toFixed(number >= 10 ? 1 : 2)} min`;
    const hours = Math.floor(number / 60);
    const rest = number % 60;
    return `${hours}h ${Math.round(rest)}min`;
  }

  function percent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    return `${number}%`;
  }

  function chip(text, tone = '') {
    if (typeof badge === 'function') return badge(text, tone);
    return `<span class="badge ${tone}">${esc(text)}</span>`;
  }

  function ensureState() {
    window.state.storageInventory ||= {
      loading: false,
      cleanupRunning: false,
      error: null,
      data: null,
      loadedAt: null
    };
    return window.state.storageInventory;
  }

  function injectStyles() {
    if (document.getElementById('storageInventoryStyles')) return;
    const style = document.createElement('style');
    style.id = 'storageInventoryStyles';
    style.textContent = `
      .storage-inventory-card { grid-column: 1 / -1; }
      .storage-inventory-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: start; }
      .storage-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
      .storage-tile { border: 1px solid var(--line); border-radius: var(--radius); background: #0d1219; padding: 10px; min-width: 0; }
      .storage-tile strong { display: block; margin-top: 3px; font-size: 1.05rem; overflow-wrap: anywhere; }
      .storage-session-list { display: grid; gap: 8px; margin-top: 10px; }
      .storage-session-row { display: grid; gap: 8px; border: 1px solid var(--line); border-radius: var(--radius); background: #0d1219; padding: 10px; }
      .storage-session-row.red { border-color: var(--red); background: #1d1011; }
      .storage-session-row.yellow { border-color: var(--gold); background: #1a1710; }
      .storage-category-line { display: grid; grid-template-columns: minmax(130px, 1fr) minmax(90px, auto) minmax(90px, auto) minmax(150px, 2fr); gap: 8px; align-items: center; }
      .storage-bar { height: 8px; overflow: hidden; border-radius: 999px; background: #05070a; border: 1px solid var(--line); }
      .storage-bar span { display: block; height: 100%; min-width: 3px; border-radius: inherit; background: linear-gradient(90deg, var(--blue), var(--gold)); }
      .storage-object-list { display: grid; gap: 6px; margin-top: 10px; }
      .storage-object-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; border: 1px solid var(--line); border-radius: var(--radius); padding: 8px; background: #070a0f; }
      .storage-object-row code { color: var(--muted); overflow-wrap: anywhere; }
      .cleanup-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
      .cleanup-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; border: 1px solid var(--line); border-radius: var(--radius); background: #070a0f; padding: 8px; }
      .cleanup-row.red { border-color: var(--red); background: #1d1011; }
      .cleanup-row.gold { border-color: var(--gold); background: #1a1710; }
      .cleanup-row.green { border-color: var(--green); }
      .cleanup-row code { display: block; color: var(--muted); overflow-wrap: anywhere; }
      .cleanup-row small { overflow-wrap: anywhere; }
      @media (max-width: 900px) {
        .storage-inventory-head, .storage-grid, .storage-category-line, .storage-object-row, .cleanup-grid, .cleanup-row { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function metricById(payload, id) {
    return (payload?.metrics || []).find(item => item.id === id) || null;
  }

  function retentionFor(fileType = '', sourceSystem = '') {
    const type = String(fileType || '').toLowerCase();
    const source = String(sourceSystem || '').toLowerCase();
    if (type.includes('zip') || source.includes('craig_zip')) return 'temporario ate manifest/extracao ok';
    if (type.includes('flac') || type.includes('raw')) return 'work copy: compactar ou expirar';
    if (type.includes('chunk') || type.includes('slice')) return 'descartavel apos transcricao validada';
    if (type.includes('opus') || type.includes('mp3') || type.includes('voice_ref')) return 'permanente compacto';
    if (type.includes('transcript') || type.includes('manifest')) return 'permanente leve';
    return 'classificacao pendente';
  }

  function categoryTone(category = '', retention = '') {
    const text = `${category} ${retention}`.toLowerCase();
    if (text.includes('permanente compacto') || text.includes('manifest') || text.includes('transcript')) return 'green';
    if (text.includes('zip')) return 'orange';
    if (text.includes('compactar') || text.includes('temporario') || text.includes('descartavel')) return 'gold';
    return 'blue';
  }

  function statusTone(status = '') {
    return {
      ok: 'green',
      attention: 'gold',
      critical: 'red',
      standby: 'blue'
    }[status] || 'blue';
  }

  function statusText(status = '') {
    return {
      ok: 'dentro da politica',
      attention: 'pede atencao',
      critical: 'critico',
      standby: 'standby'
    }[status] || status || 'sem status';
  }

  function normalizeStorageRow(row = {}) {
    const fileType = row.file_type || row.fileType || 'unknown';
    const sourceSystem = row.source_system || row.sourceSystem || 'unknown';
    const category = `${fileType}_${sourceSystem}`.replace(/[^a-z0-9_/-]+/gi, '_').toLowerCase();
    const retentionClass = retentionFor(fileType, sourceSystem);
    return {
      category,
      label: `${fileType} / ${sourceSystem}`,
      retentionClass,
      objects: Number(row.files || row.objects || 0),
      bytes: Number(row.bytes || row.size_bytes || 0),
      audioMinutes: Number(row.audio_minutes || row.audioMinutes || 0),
      latestModified: row.latest_modified || row.latestModified || null
    };
  }

  function inventoryFromMonitoring(payload) {
    const rows = metricById(payload, 'storage')?.data || [];
    const cleanup = metricById(payload, 'audio-cleanup')?.data || null;
    const budget = metricById(payload, 'storage-budget')?.data || {};
    const policy = budget.policy || {
      totalSoftLimitBytes: 5 * 1024 * 1024 * 1024,
      sessionRetainedTargetBytes: 250 * 1024 * 1024,
      sessionActiveWarningBytes: 1500 * 1024 * 1024,
      uploadZipWarningBytes: 1200 * 1024 * 1024,
      note: 'Inventario rastreado pelo banco. Defaults locais aplicados quando a API nao retorna politica.'
    };
    const categories = rows.map(normalizeStorageRow).sort((a, b) => b.bytes - a.bytes);
    const totals = categories.reduce((acc, item) => {
      acc.objects += item.objects;
      acc.bytes += item.bytes;
      acc.audioMinutes += item.audioMinutes;
      return acc;
    }, { objects: 0, bytes: 0, audioMinutes: 0, latestModified: null });
    const sessions = (budget.largestSessions || []).map(session => {
      const sessionBytes = Number(session.bytes || 0);
      return {
        sourceSessionId: session.source_session_id || session.sourceSessionId || 'unknown',
        title: session.session_title || session.sessionTitle || '',
        objects: Number(session.files || session.objects || 0),
        bytes: sessionBytes,
        audioMinutes: Number(session.audio_minutes || session.audioMinutes || 0),
        warning: sessionBytes >= Number(policy.sessionActiveWarningBytes || 0)
          ? 'red'
          : sessionBytes >= Number(policy.sessionRetainedTargetBytes || 0)
            ? 'yellow'
            : '',
        categories: []
      };
    });
    return {
      ok: true,
      mode: 'db_recording_files_inventory',
      generatedAt: payload?.generatedAt || new Date().toISOString(),
      bucket: 'recording_files',
      prefix: 'Supabase recording_files',
      truncated: false,
      totals,
      categories,
      cleanup,
      budget,
      sessions,
      largestObjects: [],
      policy
    };
  }

  async function loadStorageInventory(force = false) {
    const inventory = ensureState();
    if (inventory.loading) return;
    if (!force && inventory.data) return;
    if (typeof canViewMonitoring === 'function' && !canViewMonitoring()) return;
    inventory.loading = true;
    inventory.error = null;
    try { render?.(); } catch (_error) {}
    try {
      const payload = await api('/api/monitoring?deep=1');
      const data = inventoryFromMonitoring(payload);
      inventory.data = data;
      inventory.loadedAt = new Date().toISOString();
      inventory.error = null;
      remember?.('Inventario de storage atualizado.', {
        mode: data.mode,
        objects: data.totals?.objects || 0,
        bytes: data.totals?.bytes || 0,
        audioMinutes: data.totals?.audioMinutes || 0
      });
    } catch (error) {
      inventory.error = error.message;
    } finally {
      inventory.loading = false;
      try { render?.(); } catch (_error) {}
    }
  }

  async function runStorageCleanup(dryRun = true) {
    const inventory = ensureState();
    if (inventory.cleanupRunning) return null;
    const cleanup = inventory.data?.cleanup || {};
    const canRun = Boolean(window.state?.auth?.capabilities?.canRunTechnicalJobs);
    if (!dryRun && !canRun) {
      toast?.('Sua conta nao tem permissao tecnica para executar limpeza.');
      return null;
    }
    if (!dryRun && Number(cleanup.deleteReadyBytes || 0) <= 0) {
      toast?.('Nao ha artefatos delete_ready para limpar.');
      return null;
    }
    if (!dryRun && !window.confirm('Deletar do R2 apenas artefatos marcados como delete_ready? Esta acao nao apaga sessoes nem transcricoes.')) {
      return null;
    }
    inventory.cleanupRunning = true;
    try { render?.(); } catch (_error) {}
    try {
      const payload = await api('/api/storage-cleanup-run', {
        method: 'POST',
        body: JSON.stringify({
          dryRun,
          limit: 5,
          confirm: dryRun ? undefined : 'DELETE_READY_R2'
        })
      });
      remember?.(dryRun ? 'Simulacao de limpeza concluida.' : 'Limpeza segura executada.', payload);
      toast?.(dryRun ? 'Simulacao de limpeza concluida.' : 'Limpeza segura executada.');
      await loadStorageInventory(true);
      return payload;
    } catch (error) {
      toast?.(error.message);
      remember?.(`Limpeza de storage falhou: ${error.message}`);
      return null;
    } finally {
      inventory.cleanupRunning = false;
      try { render?.(); } catch (_error) {}
    }
  }

  function renderCategorySummary(data) {
    const total = Math.max(1, Number(data?.totals?.bytes || 0));
    const categories = data?.categories || [];
    if (!categories.length) return '<div class="empty">Nenhum arquivo rastreado no banco para esta campanha.</div>';
    return `
      <div class="storage-session-list">
        ${categories.map(item => `
          <div class="storage-category-line">
            <div>${chip(item.label || item.category, categoryTone(item.category, item.retentionClass))}<small>${esc(item.retentionClass || '')}</small></div>
            <strong>${esc(bytes(item.bytes))}</strong>
            <small>${esc(item.objects)} objetos • ${esc(minutes(item.audioMinutes))}</small>
            <div class="storage-bar"><span style="width:${Math.max(2, Math.round((Number(item.bytes || 0) / total) * 100))}%"></span></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function cleanupTone(status = '') {
    if (status === 'delete_ready') return 'green';
    if (status === 'blocked') return 'gold';
    if (status === 'hold') return 'blue';
    return 'blue';
  }

  function renderCleanupReadiness(data) {
    const cleanup = data?.cleanup;
    if (!cleanup) return '<div class="empty">Readiness de limpeza ainda nao retornou no snapshot.</div>';
    const rows = cleanup.byStatus || [];
    const largest = cleanup.largest || [];
    return `
      <div class="cleanup-grid">
        <div class="storage-tile"><span class="label">Liberavel com seguranca</span><strong>${esc(bytes(cleanup.deleteReadyBytes))}</strong><small>${esc(cleanup.deleteReadyObjects || 0)} objeto(s) marcados</small></div>
        <div class="storage-tile"><span class="label">Bloqueado por evidencia</span><strong>${esc(bytes(cleanup.blockedBytes))}</strong><small>${esc(cleanup.blockedObjects || 0)} objeto(s) aguardando etapa</small></div>
        <div class="storage-tile"><span class="label">Acervo protegido</span><strong>${esc(bytes(cleanup.holdBytes))}</strong><small>${esc(cleanup.holdObjects || 0)} objeto(s) permanentes/revisao</small></div>
      </div>
      ${rows.length ? `
        <div class="storage-session-list">
          ${rows.map(row => `
            <div class="storage-category-line">
              <div>${chip(row.artifact_type || 'artifact', cleanupTone(row.readiness_status))}<small>${esc(row.readiness_status || '')}</small></div>
              <strong>${esc(bytes(row.bytes))}</strong>
              <small>${esc(row.objects || 0)} objetos • ${esc(bytes(row.reclaimable_bytes))} liberavel</small>
              <div class="storage-bar"><span style="width:${Math.max(2, Math.min(100, Math.round((Number(row.bytes || 0) / Math.max(1, Number(cleanup.bytes || 0))) * 100)))}%"></span></div>
            </div>
          `).join('')}
        </div>
      ` : '<div class="empty">Nenhum artefato classificado para limpeza.</div>'}
      ${largest.length ? `
        <div class="storage-object-list">
          ${largest.map(item => `
            <div class="cleanup-row ${esc(cleanupTone(item.readiness_status))}">
              <div>
                <strong>${esc(item.artifact_type || 'artifact')}</strong>
                <code>${esc(item.storage_path || '')}</code>
                <small>${esc(item.required_action || '')}${item.blockers?.length ? ` • bloqueios: ${esc(item.blockers.join(', '))}` : ''}</small>
              </div>
              <div class="badges">
                ${chip(bytes(item.size_bytes), cleanupTone(item.readiness_status))}
                ${chip(item.readiness_status || 'unknown', cleanupTone(item.readiness_status))}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  function renderSessionRows(data) {
    const sessions = data?.sessions || [];
    const policy = data?.policy || {};
    if (!sessions.length) {
      return '<div class="empty">Nenhuma sessao com arquivo rastreado no snapshot atual.</div>';
    }
    return `
      <div class="storage-session-list">
        ${sessions.slice(0, 12).map(session => {
          const warningTone = session.warning === 'red' ? 'red' : session.warning === 'yellow' ? 'gold' : 'green';
          const warningLabel = session.warning === 'red'
            ? `acima de ${bytes(policy.sessionActiveWarningBytes)}`
            : session.warning === 'yellow'
              ? `acima da meta ${bytes(policy.sessionRetainedTargetBytes)}`
              : 'dentro da meta';
          return `
            <div class="storage-session-row ${esc(session.warning || '')}">
              <div class="row between">
                <div>
                  <strong>${esc(session.title || session.sourceSessionId || 'unknown')}</strong>
                  <small>${esc(session.sourceSessionId || 'unknown')} • ${esc(session.objects || 0)} arquivos • ${esc(minutes(session.audioMinutes))}</small>
                </div>
                <div class="badges">
                  ${chip(bytes(session.bytes), warningTone)}
                  ${chip(warningLabel, warningTone)}
                </div>
              </div>
              ${(session.categories || []).length ? session.categories.map(category => `
                <div class="storage-category-line">
                  <div>${chip(category.label || category.category, categoryTone(category.category, category.retentionClass))}<small>${esc(category.retentionClass || '')}</small></div>
                  <strong>${esc(bytes(category.bytes))}</strong>
                  <small>${esc(category.objects)} objetos</small>
                  <div class="storage-bar"><span style="width:100%"></span></div>
                </div>
              `).join('') : '<small>Resumo agregado por sessao; categorias detalhadas aparecem acima em tipos de artefato.</small>'}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderLargestObjects(data) {
    const objects = data?.largestObjects || [];
    if (!objects.length) return '<div class="empty">Maiores objetos entram na listagem R2 direta; por enquanto o snapshot vem agregado pelo banco.</div>';
    return `
      <div class="storage-object-list">
        ${objects.slice(0, 10).map(item => `
          <div class="storage-object-row">
            <code>${esc(item.key || '')}</code>
            <div class="badges">${chip(bytes(item.sizeBytes), categoryTone(item.category, item.retentionClass))}${chip(item.label || item.category, 'blue')}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderStorageInventoryCard() {
    if (typeof canViewMonitoring === 'function' && !canViewMonitoring()) return '';
    const inventory = ensureState();
    if (!inventory.data && !inventory.loading && !inventory.error) {
      window.setTimeout(() => loadStorageInventory(false), 0);
    }
    const data = inventory.data;
    const cleanup = data?.cleanup || {};
    const canRunCleanup = Boolean(window.state?.auth?.capabilities?.canRunTechnicalJobs);
    const hasDeleteReady = Number(cleanup.deleteReadyBytes || 0) > 0;
    return `
      <article class="ops-card storage-inventory-card">
        <div class="storage-inventory-head">
          <div>
            <span class="label">Storage de audio</span>
            <h2>Inventario de audio e artefatos</h2>
            <p>${esc(data?.policy?.note || 'Leitura segura por monitoramento. Nada e apagado nesta etapa.')} ${data?.budget?.status ? chip(statusText(data.budget.status), statusTone(data.budget.status)) : ''}</p>
          </div>
          <div class="actions">
            <button onclick="loadStorageInventory(true)" ${inventory.loading ? 'disabled' : ''}>${inventory.loading ? 'Atualizando...' : 'Atualizar inventario'}</button>
            <button onclick="runStorageCleanup(true)" ${inventory.cleanupRunning ? 'disabled' : ''}>Simular limpeza</button>
            <button class="danger" onclick="runStorageCleanup(false)" ${inventory.cleanupRunning || !canRunCleanup || !hasDeleteReady ? 'disabled' : ''}>Executar limpeza segura</button>
          </div>
        </div>
        ${inventory.error ? `<div class="empty">${esc(inventory.error)}</div>` : ''}
        ${inventory.loading && !data ? '<div class="empty">Lendo metricas de storage...</div>' : ''}
        ${data ? `
          <div class="storage-grid">
            <div class="storage-tile"><span class="label">Total rastreado</span><strong>${esc(bytes(data.totals?.bytes))}</strong><small>${esc(data.totals?.objects || 0)} arquivos</small></div>
            <div class="storage-tile"><span class="label">Uso da politica</span><strong>${esc(percent(data.budget?.usagePercent))}</strong><small>limite ${esc(bytes(data.policy?.totalSoftLimitBytes))}</small></div>
            <div class="storage-tile"><span class="label">Media/sessao</span><strong>${esc(bytes(data.budget?.averageSessionBytes))}</strong><small>${esc(percent(data.budget?.averageRetainedTargetPercent))} da meta ${esc(bytes(data.policy?.sessionRetainedTargetBytes))}</small></div>
            <div class="storage-tile"><span class="label">Maior sessao</span><strong>${esc(bytes(data.budget?.largestSessionBytes))}</strong><small>alerta em ${esc(bytes(data.policy?.sessionActiveWarningBytes))}</small></div>
            <div class="storage-tile"><span class="label">Audio rastreado</span><strong>${esc(minutes(data.totals?.audioMinutes))}</strong><small>antes da compactacao final</small></div>
            <div class="storage-tile"><span class="label">Liberavel</span><strong>${esc(bytes(data.cleanup?.deleteReadyBytes))}</strong><small>sem deletar automaticamente</small></div>
            <div class="storage-tile"><span class="label">Bloqueado</span><strong>${esc(bytes(data.cleanup?.blockedBytes))}</strong><small>aguarda evidencia/compactacao</small></div>
          </div>
          ${data.truncated ? '<div class="empty">Inventario truncado. A proxima etapa adiciona paginacao por continuation token.</div>' : ''}
          <h3>Readiness de limpeza</h3>
          ${renderCleanupReadiness(data)}
          ${renderCategorySummary(data)}
          <h3>Sessoes mais pesadas</h3>
          ${renderSessionRows(data)}
          <h3>Maiores objetos</h3>
          ${renderLargestObjects(data)}
        ` : ''}
      </article>
    `;
  }

  function renderOpsWithStorage() {
    const payload = typeof buildDecisionPayload === 'function'
      ? buildDecisionPayload()
      : { segmentDecisions: [], candidateDecisions: [] };
    const draft = typeof hasDraftChanges === 'function' ? hasDraftChanges() : false;
    return `
      <section class="ops-grid">
        <article class="ops-card">
          <h2>Pacote local</h2>
          <p>Decisoes ainda nao aplicadas no banco.</p>
          <div class="badges">
            ${chip(`${payload.segmentDecisions.length} segmentos`, 'blue')}
            ${chip(`${payload.candidateDecisions.length} candidatos`, 'violet')}
          </div>
          <div class="actions">
            <button class="danger" ${draft ? '' : 'disabled'} onclick="confirmClearDraft()">Limpar rascunho</button>
          </div>
        </article>
        <article class="ops-card">
          <h2>Resumo Supabase</h2>
          <pre>${esc(JSON.stringify(window.state?.summary || {}, null, 2))}</pre>
        </article>
        <article class="ops-card">
          <h2>Eventos Roll20</h2>
          ${typeof renderRoll20Events === 'function' ? renderRoll20Events() : '<div class="empty">Roll20 indisponivel.</div>'}
        </article>
        ${renderStorageInventoryCard()}
        <article class="ops-card">
          <div class="row between">
            <h2>Jobs de producao</h2>
            <button onclick="loadJobs(false)">Atualizar</button>
          </div>
          ${typeof renderJobsList === 'function' ? renderJobsList() : '<div class="empty">Jobs indisponiveis.</div>'}
        </article>
        <article class="ops-card">
          <h2>Log da tela</h2>
          <pre>${esc((window.state?.log || []).map(item => `[${item.at}] ${item.message}`).join('\n') || 'Sem eventos ainda.')}</pre>
        </article>
      </section>
    `;
  }

  injectStyles();
  window.loadStorageInventory = loadStorageInventory;
  window.runStorageCleanup = runStorageCleanup;
  window.renderStorageInventoryCard = renderStorageInventoryCard;
  try { renderOps = renderOpsWithStorage; } catch (_error) {}
  window.renderOps = renderOpsWithStorage;
  try { render?.(); } catch (_error) {}
})();
