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

  function chip(text, tone = '') {
    if (typeof badge === 'function') return badge(text, tone);
    return `<span class="badge ${tone}">${esc(text)}</span>`;
  }

  function ensureState() {
    window.state.storageInventory ||= {
      loading: false,
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
      .storage-tile strong { display: block; margin-top: 3px; font-size: 1.05rem; }
      .storage-session-list { display: grid; gap: 8px; margin-top: 10px; }
      .storage-session-row { display: grid; gap: 8px; border: 1px solid var(--line); border-radius: var(--radius); background: #0d1219; padding: 10px; }
      .storage-session-row.red { border-color: var(--red); background: #1d1011; }
      .storage-session-row.yellow { border-color: var(--gold); background: #1a1710; }
      .storage-category-line { display: grid; grid-template-columns: minmax(130px, 1fr) minmax(80px, auto) minmax(150px, 2fr); gap: 8px; align-items: center; }
      .storage-bar { height: 8px; overflow: hidden; border-radius: 999px; background: #05070a; border: 1px solid var(--line); }
      .storage-bar span { display: block; height: 100%; min-width: 3px; border-radius: inherit; background: linear-gradient(90deg, var(--blue), var(--gold)); }
      .storage-object-list { display: grid; gap: 6px; margin-top: 10px; }
      .storage-object-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; border: 1px solid var(--line); border-radius: var(--radius); padding: 8px; background: #070a0f; }
      .storage-object-row code { color: var(--muted); overflow-wrap: anywhere; }
      @media (max-width: 900px) {
        .storage-inventory-head, .storage-grid, .storage-category-line, .storage-object-row { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
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
      const payload = await api('/api/storage/inventory?maxPages=10&maxKeys=1000');
      inventory.data = payload;
      inventory.loadedAt = new Date().toISOString();
      inventory.error = null;
      remember?.('Inventario R2 atualizado.', {
        objects: payload.totals?.objects || 0,
        bytes: payload.totals?.bytes || 0,
        sessions: payload.sessions?.length || 0
      });
    } catch (error) {
      inventory.error = error.message;
    } finally {
      inventory.loading = false;
      try { render?.(); } catch (_error) {}
    }
  }

  function categoryTone(category = '') {
    if (category === 'media_voice_ref') return 'green';
    if (category === 'raw_zip') return 'orange';
    if (category === 'work_flac' || category === 'work_chunks') return 'gold';
    return 'red';
  }

  function renderCategorySummary(data) {
    const total = Math.max(1, Number(data?.totals?.bytes || 0));
    const categories = data?.categories || [];
    if (!categories.length) return '<div class="empty">Nenhum objeto encontrado nesse prefixo.</div>';
    return `
      <div class="storage-session-list">
        ${categories.map(item => `
          <div class="storage-category-line">
            <div>${chip(item.label || item.category, categoryTone(item.category))}<small>${esc(item.retentionClass || '')}</small></div>
            <strong>${esc(bytes(item.bytes))}</strong>
            <div class="storage-bar"><span style="width:${Math.max(2, Math.round((Number(item.bytes || 0) / total) * 100))}%"></span></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderSessionRows(data) {
    const sessions = data?.sessions || [];
    if (!sessions.length) return '<div class="empty">Sem sessoes no prefixo inventariado.</div>';
    return `
      <div class="storage-session-list">
        ${sessions.slice(0, 12).map(session => `
          <div class="storage-session-row ${esc(session.warning || '')}">
            <div class="row between">
              <div>
                <strong>${esc(session.sourceSessionId || 'unknown')}</strong>
                <small>${esc(session.objects || 0)} objetos • atualizado ${esc(session.latestModified || '-')}</small>
              </div>
              <div class="badges">
                ${chip(bytes(session.bytes), session.warning === 'red' ? 'red' : session.warning === 'yellow' ? 'gold' : 'green')}
                ${chip(session.warning === 'red' ? 'acima de 500 MB' : session.warning === 'yellow' ? 'acima de 250 MB' : 'ok', session.warning === 'red' ? 'red' : session.warning === 'yellow' ? 'gold' : 'green')}
              </div>
            </div>
            ${session.categories.map(category => `
              <div class="storage-category-line">
                <div>${chip(category.label || category.category, categoryTone(category.category))}<small>${esc(category.retentionClass || '')}</small></div>
                <strong>${esc(bytes(category.bytes))}</strong>
                <small>${esc(category.objects)} objetos</small>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderLargestObjects(data) {
    const objects = data?.largestObjects || [];
    if (!objects.length) return '';
    return `
      <div class="storage-object-list">
        ${objects.slice(0, 10).map(item => `
          <div class="storage-object-row">
            <code>${esc(item.key || '')}</code>
            <div class="badges">${chip(bytes(item.sizeBytes), categoryTone(item.category))}${chip(item.label || item.category, 'blue')}</div>
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
    return `
      <article class="ops-card storage-inventory-card">
        <div class="storage-inventory-head">
          <div>
            <span class="label">R2 storage</span>
            <h2>Inventario de audio e artefatos</h2>
            <p>${esc(data?.policy?.note || 'Leitura segura por prefixo. Nada e apagado nesta etapa.')}</p>
          </div>
          <div class="actions">
            <button onclick="loadStorageInventory(true)" ${inventory.loading ? 'disabled' : ''}>${inventory.loading ? 'Atualizando...' : 'Atualizar inventario'}</button>
          </div>
        </div>
        ${inventory.error ? `<div class="empty">${esc(inventory.error)}</div>` : ''}
        ${inventory.loading && !data ? '<div class="empty">Listando objetos do R2...</div>' : ''}
        ${data ? `
          <div class="storage-grid">
            <div class="storage-tile"><span class="label">Total</span><strong>${esc(bytes(data.totals?.bytes))}</strong><small>${esc(data.totals?.objects || 0)} objetos</small></div>
            <div class="storage-tile"><span class="label">Sessoes</span><strong>${esc(data.sessions?.length || 0)}</strong><small>com objetos no R2</small></div>
            <div class="storage-tile"><span class="label">Prefixo</span><strong>${esc(data.prefix || '-')}</strong><small>${esc(data.bucket || '')}</small></div>
            <div class="storage-tile"><span class="label">Meta</span><strong>${esc(bytes(data.policy?.targetPermanentBytes))}</strong><small>permanente por sessao</small></div>
          </div>
          ${data.truncated ? '<div class="empty">Inventario truncado. A proxima etapa adiciona paginacao por continuation token.</div>' : ''}
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
  window.renderStorageInventoryCard = renderStorageInventoryCard;
  try { renderOps = renderOpsWithStorage; } catch (_error) {}
  window.renderOps = renderOpsWithStorage;
  try { render?.(); } catch (_error) {}
})();
