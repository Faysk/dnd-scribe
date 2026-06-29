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
      objectLoading: false,
      r2Loading: false,
      cleanupRunning: false,
      error: null,
      objectError: null,
      r2Error: null,
      r2Data: null,
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
      .storage-object-row code { display: block; color: var(--muted); overflow-wrap: anywhere; }
      .storage-object-row small { display: block; overflow-wrap: anywhere; }
      .storage-object-footer { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; margin-top: 8px; }
      .ops-priority-card { grid-column: 1 / -1; }
      .ops-priority-layout { display: grid; grid-template-columns: minmax(190px, 260px) minmax(0, 1fr); gap: 12px; align-items: center; }
      .ops-priority-signals { display: grid; grid-template-columns: repeat(5, minmax(90px, 1fr)); gap: 8px; }
      .ops-priority-signal { border: 1px solid var(--line); border-radius: var(--radius); background: #0d1219; padding: 9px; min-width: 0; }
      .ops-priority-signal.green { border-color: var(--green); }
      .ops-priority-signal.gold { border-color: var(--gold); background: #1a1710; }
      .ops-priority-signal.red { border-color: var(--red); background: #1d1011; }
      .ops-priority-signal.blue { border-color: var(--blue); }
      .ops-priority-signal strong { display: block; margin-top: 3px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      .ops-action-card { grid-column: 1 / -1; }
      .ops-action-layout { display: grid; grid-template-columns: minmax(220px, 330px) minmax(0, 1fr); gap: 12px; align-items: start; }
      .ops-action-focus { display: grid; gap: 8px; border: 1px solid var(--line); border-radius: var(--radius); background: #0d1219; padding: 12px; min-width: 0; }
      .ops-action-focus.green { border-color: var(--green); }
      .ops-action-focus.gold { border-color: var(--gold); background: #1a1710; }
      .ops-action-focus.red { border-color: var(--red); background: #1d1011; }
      .ops-action-focus.blue { border-color: var(--blue); background: #101822; }
      .ops-action-focus strong, .ops-action-focus small { display: block; overflow-wrap: anywhere; }
      .ops-action-steps { display: grid; gap: 8px; }
      .ops-action-step { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; border: 1px solid var(--line); border-radius: var(--radius); background: #0d1219; padding: 9px; }
      .ops-action-step.green { border-color: var(--green); }
      .ops-action-step.gold { border-color: var(--gold); background: #1a1710; }
      .ops-action-step.red { border-color: var(--red); background: #1d1011; }
      .ops-action-step.blue { border-color: var(--blue); background: #101822; }
      .ops-action-step strong, .ops-action-step small { display: block; overflow-wrap: anywhere; }
      .r2-audit-panel { border: 1px solid var(--line); border-radius: var(--radius); background: #080c12; padding: 10px; margin-top: 10px; }
      .r2-audit-panel.red { border-color: var(--red); background: #1d1011; }
      .cleanup-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
      .cleanup-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; border: 1px solid var(--line); border-radius: var(--radius); background: #070a0f; padding: 8px; }
      .cleanup-row.red { border-color: var(--red); background: #1d1011; }
      .cleanup-row.gold { border-color: var(--gold); background: #1a1710; }
      .cleanup-row.green { border-color: var(--green); }
      .cleanup-row code { display: block; color: var(--muted); overflow-wrap: anywhere; }
      .cleanup-row small { overflow-wrap: anywhere; }
      @media (max-width: 900px) {
        .storage-inventory-head, .storage-grid, .storage-category-line, .storage-object-row, .cleanup-grid, .cleanup-row, .ops-priority-layout, .ops-priority-signals, .ops-action-layout, .ops-action-step { grid-template-columns: 1fr; }
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

  function normalizeStorageObject(row = {}) {
    const fileType = row.file_type || row.fileType || 'unknown';
    const sourceSystem = row.source_system || row.sourceSystem || 'unknown';
    const retentionClass = retentionFor(fileType, sourceSystem);
    return {
      id: row.id || '',
      sourceSessionId: row.source_session_id || row.sourceSessionId || 'unknown',
      sessionTitle: row.session_title || row.sessionTitle || '',
      sessionStatus: row.session_status || row.sessionStatus || '',
      fileType,
      sourceSystem,
      sourceFileRole: row.source_file_role || row.sourceFileRole || '',
      storageBucket: row.storage_bucket || row.storageBucket || '',
      storagePath: row.storage_path || row.storagePath || '',
      originalFilename: row.original_filename || row.originalFilename || '',
      mimeType: row.mime_type || row.mimeType || '',
      sizeBytes: Number(row.size_bytes || row.sizeBytes || 0),
      durationMs: Number(row.duration_ms || row.durationMs || 0),
      createdAt: row.created_at || row.createdAt || null,
      updatedAt: row.updated_at || row.updatedAt || null,
      retentionClass,
      label: `${fileType} / ${sourceSystem}`
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
      objectPage: null,
      objectCategories: [],
      policy
    };
  }

  async function fetchStorageObjectsPage(offset = 0, limit = 25) {
    const payload = await api(`/api/storage-inventory?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`);
    return {
      objects: (payload.objects || []).map(normalizeStorageObject),
      page: payload.page || { limit, offset, hasMore: false, nextOffset: null, totalObjects: 0, totalBytes: 0 },
      categories: payload.categories || []
    };
  }

  function normalizeR2Object(row = {}) {
    return {
      key: row.key || '',
      sizeBytes: Number(row.sizeBytes || row.size_bytes || 0),
      lastModified: row.lastModified || row.last_modified || null,
      etag: row.etag || '',
      tracked: Boolean(row.tracked),
      status: row.status || (row.tracked ? 'tracked' : 'orphan_candidate')
    };
  }

  function r2Tone(status = '') {
    if (status === 'tracked') return 'green';
    if (status === 'orphan_candidate') return 'gold';
    return 'blue';
  }

  async function loadR2InventoryPage(reset = false) {
    const inventory = ensureState();
    if (inventory.r2Loading) return null;
    const token = reset ? '' : inventory.r2Data?.nextContinuationToken;
    if (!reset && !token) return null;
    inventory.r2Loading = true;
    inventory.r2Error = null;
    try { render?.(); } catch (_error) {}
    try {
      const path = `/api/r2-inventory?limit=100${token ? `&continuationToken=${encodeURIComponent(token)}` : ''}`;
      const payload = await api(path);
      const objects = (payload.objects || []).map(normalizeR2Object);
      inventory.r2Data = reset || !inventory.r2Data
        ? { ...payload, objects }
        : {
            ...payload,
            objects: [...(inventory.r2Data.objects || []), ...objects],
            summary: {
              ...payload.summary,
              loadedObjects: (inventory.r2Data.objects || []).length + objects.length
            }
          };
      inventory.r2Error = null;
      remember?.('Auditoria R2 carregada.', {
        loaded: inventory.r2Data.objects.length,
        orphanCandidates: inventory.r2Data.objects.filter(item => !item.tracked).length,
        truncated: inventory.r2Data.isTruncated
      });
      return inventory.r2Data;
    } catch (error) {
      inventory.r2Error = error.message;
      toast?.(error.message);
      return null;
    } finally {
      inventory.r2Loading = false;
      try { render?.(); } catch (_error) {}
    }
  }

  async function loadStorageObjectsPage(reset = false) {
    const inventory = ensureState();
    if (inventory.objectLoading) return null;
    if (!inventory.data) return null;
    const currentPage = inventory.data.objectPage || {};
    const offset = reset ? 0 : currentPage.nextOffset;
    if (offset === null || offset === undefined) return null;
    inventory.objectLoading = true;
    inventory.objectError = null;
    try { render?.(); } catch (_error) {}
    try {
      const page = await fetchStorageObjectsPage(offset, currentPage.limit || 25);
      inventory.data.largestObjects = reset
        ? page.objects
        : [...(inventory.data.largestObjects || []), ...page.objects];
      inventory.data.objectPage = page.page;
      inventory.data.objectCategories = page.categories;
      inventory.objectError = null;
      remember?.('Pagina de objetos de storage carregada.', {
        offset: page.page.offset,
        visible: inventory.data.largestObjects.length,
        total: page.page.totalObjects
      });
      return page;
    } catch (error) {
      inventory.objectError = error.message;
      toast?.(error.message);
      return null;
    } finally {
      inventory.objectLoading = false;
      try { render?.(); } catch (_error) {}
    }
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
      const [payload, objectPage] = await Promise.all([
        api('/api/monitoring?deep=1'),
        fetchStorageObjectsPage(0, 25)
      ]);
      const data = inventoryFromMonitoring(payload);
      data.largestObjects = objectPage.objects;
      data.objectPage = objectPage.page;
      data.objectCategories = objectPage.categories;
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

  function renderR2Audit() {
    const inventory = ensureState();
    const audit = inventory.r2Data;
    if (!audit) {
      return `
        <div class="r2-audit-panel">
          <div class="row between">
            <div>
              <strong>Auditoria direta do bucket R2</strong>
              <small>Consulta sob demanda para comparar objetos reais do bucket com os registros do banco.</small>
            </div>
            <button onclick="loadR2InventoryPage(true)" ${inventory.r2Loading ? 'disabled' : ''}>${inventory.r2Loading ? 'Auditando...' : 'Auditar R2'}</button>
          </div>
        </div>
      `;
    }
    const objects = audit.objects || [];
    const orphanCount = objects.filter(item => !item.tracked).length;
    const orphanBytes = objects.filter(item => !item.tracked).reduce((total, item) => total + Number(item.sizeBytes || 0), 0);
    return `
      <div class="r2-audit-panel ${orphanCount ? 'red' : ''}">
        <div class="row between">
          <div>
            <strong>Auditoria direta do bucket R2</strong>
            <small>Objetos sem rastro sao candidatos a revisao, nao a delete automatico.</small>
          </div>
          <div class="actions">
            <button onclick="loadR2InventoryPage(true)" ${inventory.r2Loading ? 'disabled' : ''}>Reauditar</button>
            <button onclick="loadR2InventoryPage(false)" ${inventory.r2Loading || !audit.nextContinuationToken ? 'disabled' : ''}>${inventory.r2Loading ? 'Carregando...' : audit.nextContinuationToken ? 'Carregar mais R2' : 'Tudo lido'}</button>
          </div>
        </div>
        <div class="storage-grid">
          <div class="storage-tile"><span class="label">Pagina R2</span><strong>${esc(objects.length)}</strong><small>${esc(bytes(objects.reduce((total, item) => total + Number(item.sizeBytes || 0), 0)))}</small></div>
          <div class="storage-tile"><span class="label">Rastreados</span><strong>${esc(objects.length - orphanCount)}</strong><small>recording_files/audio_artifacts</small></div>
          <div class="storage-tile"><span class="label">Orfaos candidatos</span><strong>${esc(orphanCount)}</strong><small>${esc(bytes(orphanBytes))}</small></div>
        </div>
        <div class="storage-object-list">
          ${objects.slice(-100).map(item => `
            <div class="storage-object-row">
              <div>
                <strong>${esc(item.key.split('/').pop() || item.key)}</strong>
                <code>${esc(item.key)}</code>
                <small>${esc(item.lastModified || '')}</small>
              </div>
              <div class="badges">
                ${chip(bytes(item.sizeBytes), r2Tone(item.status))}
                ${chip(item.status, r2Tone(item.status))}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderLargestObjects(data) {
    const inventory = ensureState();
    const objects = data?.largestObjects || [];
    const page = data?.objectPage || {};
    if (!objects.length) return '<div class="empty">Nenhum objeto rastreado em recording_files para esta campanha.</div>';
    return `
      <div class="storage-object-list">
        ${objects.map(item => `
          <div class="storage-object-row">
            <div>
              <strong>${esc(item.originalFilename || item.sourceFileRole || item.fileType || 'objeto')}</strong>
              <code>${esc(item.storagePath || '')}</code>
              <small>${esc(item.sessionTitle || item.sourceSessionId)} • ${esc(item.sourceSessionId)} • ${esc(item.retentionClass || '')}</small>
            </div>
            <div class="badges">
              ${chip(bytes(item.sizeBytes), categoryTone(item.fileType, item.retentionClass))}
              ${chip(item.label || item.fileType, 'blue')}
              ${item.durationMs ? chip(minutes(item.durationMs / 60000), 'green') : ''}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="storage-object-footer">
        <small>Mostrando ${esc(objects.length)} de ${esc(page.totalObjects || objects.length)} objeto(s) rastreados no banco.</small>
        <button onclick="loadStorageObjectsPage(false)" ${inventory.objectLoading || !page.hasMore ? 'disabled' : ''}>${inventory.objectLoading ? 'Carregando...' : page.hasMore ? 'Carregar mais objetos' : 'Tudo carregado'}</button>
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
        ${inventory.objectError ? `<div class="empty">${esc(inventory.objectError)}</div>` : ''}
        ${inventory.r2Error ? `<div class="empty">${esc(inventory.r2Error)}</div>` : ''}
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
          ${renderR2Audit()}
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

  function opsDraftCounts() {
    if (typeof buildDecisionPayload !== 'function') return { segmentDecisions: [], candidateDecisions: [] };
    return buildDecisionPayload();
  }

  function renderOpsPrioritySummary() {
    const jobs = window.state?.jobs || [];
    const failedJobs = jobs.filter(job => job.status === 'failed').length;
    const runningJobs = jobs.filter(job => job.status === 'running').length;
    const queuedJobs = jobs.filter(job => ['queued', 'retrying'].includes(job.status)).length;
    const control = window.state?.pipelineControl || null;
    const storage = ensureState().data || null;
    const storageStatus = storage?.budget?.status || storage?.status || 'desconhecido';
    const cleanupBytes = Number(storage?.cleanup?.deleteReadyBytes || 0);
    const draft = opsDraftCounts();
    const draftTotal = Number(draft.segmentDecisions?.length || 0) + Number(draft.candidateDecisions?.length || 0);
    const priority = failedJobs
      ? 'corrigir falhas'
      : window.state?.pipelineControlError
        ? 'recarregar esteira'
        : queuedJobs
          ? 'continuar pipeline'
          : cleanupBytes
            ? 'revisar limpeza'
            : draftTotal
              ? 'aplicar decisoes'
              : 'estavel';
    const signals = [
      {
        label: 'Prioridade',
        value: priority,
        tone: failedJobs || window.state?.pipelineControlError ? 'red' : queuedJobs || cleanupBytes || draftTotal ? 'gold' : 'green'
      },
      {
        label: 'Jobs',
        value: `${failedJobs} falha / ${runningJobs} rodando / ${queuedJobs} fila`,
        tone: failedJobs ? 'red' : runningJobs || queuedJobs ? 'gold' : 'green'
      },
      {
        label: 'Esteira',
        value: control?.stage || (window.state?.pipelineControlError ? 'erro' : 'carregar'),
        tone: window.state?.pipelineControlError ? 'red' : control ? 'blue' : 'gold'
      },
      {
        label: 'Storage',
        value: storageStatus,
        tone: ['critical', 'attention'].includes(storageStatus) ? 'red' : storage ? 'green' : 'gold'
      },
      {
        label: 'Liberavel',
        value: bytes(cleanupBytes),
        tone: cleanupBytes ? 'gold' : 'green'
      }
    ];
    return `
      <article class="ops-card ops-priority-card">
        <div class="ops-priority-layout">
          <div>
            <span class="label">Resumo operacional</span>
            <h2>${esc(priority)}</h2>
            <small>${esc(window.state?.selectedSourceSessionId || 'Sem sessao selecionada')}</small>
          </div>
          <div class="ops-priority-signals">
            ${signals.map(signal => `
              <div class="ops-priority-signal ${esc(signal.tone)}">
                <span class="label">${esc(signal.label)}</span>
                <strong>${esc(signal.value)}</strong>
              </div>
            `).join('')}
          </div>
        </div>
      </article>
    `;
  }

  function opsActionModel() {
    const jobs = window.state?.jobs || [];
    const failedJobs = jobs.filter(job => job.status === 'failed');
    const runningJobs = jobs.filter(job => job.status === 'running');
    const queuedJobs = jobs.filter(job => ['queued', 'retrying'].includes(job.status));
    const control = window.state?.pipelineControl || null;
    const storage = ensureState().data || null;
    const cleanup = storage?.cleanup || {};
    const cleanupBytes = Number(cleanup.deleteReadyBytes || 0);
    const draft = opsDraftCounts();
    const draftTotal = Number(draft.segmentDecisions?.length || 0) + Number(draft.candidateDecisions?.length || 0);
    const sourceSessionId = window.state?.selectedSourceSessionId || '';
    const rows = [
      {
        label: 'Falhas',
        value: `${failedJobs.length} job(s)`,
        tone: failedJobs.length ? 'red' : 'green',
        detail: failedJobs[0]?.error || failedJobs[0]?.type || 'Nenhuma falha carregada.'
      },
      {
        label: 'Fila',
        value: `${queuedJobs.length} job(s)`,
        tone: queuedJobs.length ? 'gold' : 'green',
        detail: queuedJobs[0]?.type || 'Nada esperando continuacao.'
      },
      {
        label: 'Rodando',
        value: `${runningJobs.length} job(s)`,
        tone: runningJobs.length ? 'gold' : 'green',
        detail: runningJobs[0]?.type || 'Nenhum job em execucao.'
      },
      {
        label: 'Limpeza',
        value: bytes(cleanupBytes),
        tone: cleanupBytes ? 'gold' : 'green',
        detail: cleanupBytes ? 'Simular antes de executar qualquer delete.' : 'Nada delete_ready no snapshot.'
      },
      {
        label: 'Rascunho',
        value: `${draftTotal} decisao(oes)`,
        tone: draftTotal ? 'gold' : 'green',
        detail: draftTotal ? 'Aplicar decisoes quando a revisao estiver correta.' : 'Sem rascunho local pendente.'
      }
    ];

    if (failedJobs.length) {
      return {
        tone: 'red',
        title: 'Corrigir falhas antes de avançar',
        action: 'Atualize jobs, abra o erro e use retry apenas no job correto.',
        risk: 'Continuar sem resolver falha pode duplicar etapa ou esconder um timeout real.',
        rows,
        buttons: [
          '<button onclick="loadJobs(true)">Atualizar jobs</button>',
          failedJobs[0]?.id ? `<button class="primary" onclick="retryCloudJob('${esc(failedJobs[0].id)}')">Retry primeiro job falho</button>` : ''
        ]
      };
    }
    if (window.state?.pipelineControlError) {
      return {
        tone: 'red',
        title: 'Esteira precisa recarregar',
        action: 'Recarregue o controle da esteira antes de executar qualquer etapa.',
        risk: window.state.pipelineControlError,
        rows,
        buttons: [
          `<button class="primary" onclick="refreshPipelineControl(true)">Recarregar esteira</button>`,
          '<button onclick="loadJobs(true)">Atualizar jobs</button>'
        ]
      };
    }
    if (queuedJobs.length || control?.actions?.length) {
      return {
        tone: 'gold',
        title: 'Pipeline tem continuação',
        action: 'Use a esteira automatica abaixo; simule quando houver custo ou delete envolvido.',
        risk: sourceSessionId ? `Sessao alvo: ${sourceSessionId}` : 'Selecione uma sessao para evitar executar no contexto errado.',
        rows,
        buttons: [
          '<button onclick="refreshPipelineControl(true)">Atualizar esteira</button>',
          '<button onclick="state.tab=\'upload\'; render();">Abrir Upload</button>'
        ]
      };
    }
    if (cleanupBytes) {
      return {
        tone: 'gold',
        title: 'Storage tem limpeza possivel',
        action: 'Simule a limpeza, confira objetos delete_ready e execute só com confirmação.',
        risk: 'Limpeza segura não apaga sessão nem transcrição, mas ainda remove objetos R2.',
        rows,
        buttons: [
          '<button class="primary" onclick="runStorageCleanup(true)">Simular limpeza</button>',
          '<button onclick="loadStorageInventory(true)">Atualizar storage</button>'
        ]
      };
    }
    if (draftTotal) {
      return {
        tone: 'gold',
        title: 'Decisões locais pendentes',
        action: 'Revise o pacote local e aplique decisões quando estiver pronto.',
        risk: 'Enquanto não aplicar, o banco não reflete o review atual.',
        rows,
        buttons: [
          '<button class="primary" onclick="applyDecisions()">Aplicar decisoes</button>',
          '<button onclick="state.tab=\'review\'; render();">Abrir Review</button>'
        ]
      };
    }
    return {
      tone: 'green',
      title: 'Operação estável',
      action: 'Atualize monitoramento ou rode auditorias sob demanda antes da próxima sessão real.',
      risk: 'Sem bloqueio local detectado no snapshot atual.',
      rows,
      buttons: [
        '<button onclick="state.tab=\'monitoring\'; render();">Abrir Monitor</button>',
        '<button onclick="loadStorageInventory(true)">Atualizar storage</button>',
        '<button onclick="loadJobs(true)">Atualizar jobs</button>'
      ]
    };
  }

  function renderOpsActionDrilldown() {
    const model = opsActionModel();
    return `
      <article class="ops-card ops-action-card">
        <div class="ops-action-layout">
          <div class="ops-action-focus ${esc(model.tone)}">
            <span class="label">Proxima acao segura</span>
            <strong>${esc(model.title)}</strong>
            <small>${esc(model.action)}</small>
            <small>${esc(model.risk)}</small>
            <div class="actions">${model.buttons.filter(Boolean).join('')}</div>
          </div>
          <div class="ops-action-steps">
            ${model.rows.map(row => `
              <div class="ops-action-step ${esc(row.tone)}">
                <div>
                  <span class="label">${esc(row.label)}</span>
                  <strong>${esc(row.value)}</strong>
                  <small>${esc(row.detail)}</small>
                </div>
                ${chip(row.tone === 'red' ? 'critico' : row.tone === 'gold' ? 'acao' : 'ok', row.tone)}
              </div>
            `).join('')}
          </div>
        </div>
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
        ${renderOpsPrioritySummary()}
        ${renderOpsActionDrilldown()}
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
            <h2>Esteira automatica</h2>
            <button onclick="refreshPipelineControl(true)">Atualizar</button>
          </div>
          ${typeof window.renderPipelineControl === 'function' ? window.renderPipelineControl('ops') : '<div class="empty">Modulo de esteira carregando.</div>'}
        </article>
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
  window.loadStorageObjectsPage = loadStorageObjectsPage;
  window.loadR2InventoryPage = loadR2InventoryPage;
  window.runStorageCleanup = runStorageCleanup;
  window.renderStorageInventoryCard = renderStorageInventoryCard;
  try { renderOps = renderOpsWithStorage; } catch (_error) {}
  window.renderOps = renderOpsWithStorage;
  try { render?.(); } catch (_error) {}
})();
