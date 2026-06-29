(function () {
  const costState = () => {
    window.state.cost ||= { loading: false, error: null, data: null, sourceSessionId: null };
    return window.state.cost;
  };

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function num(value, suffix = '') {
    const parsed = Number(value || 0);
    const text = Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    return `${text}${suffix}`;
  }

  function chip(text, tone = '') {
    return `<span class="cost-chip ${tone}">${esc(text)}</span>`;
  }

  function card(value, label, tone = '') {
    return `<div class="cost-metric ${tone}"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;
  }

  function injectTab() {
    const tabs = document.getElementById('tabs');
    if (!tabs) return;
    if (!tabs.querySelector('[data-tab="costs"]')) {
      const button = document.createElement('button');
      button.dataset.tab = 'costs';
      button.textContent = 'Custos';
      const ops = tabs.querySelector('[data-tab="ops"]');
      tabs.insertBefore(button, ops || null);
    }
    window.syncTabsA11y?.();
  }

  async function loadAiCost(force = false) {
    const sourceSessionId = window.state.selectedSourceSessionId;
    const cost = costState();
    if (!sourceSessionId) return;
    if (!force && cost.data && cost.sourceSessionId === sourceSessionId) return;
    cost.loading = true;
    cost.error = null;
    cost.sourceSessionId = sourceSessionId;
    renderCostsOnly();
    try {
      const response = await fetch(`/api/ai-cost?sourceSessionId=${encodeURIComponent(sourceSessionId)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || `Falha HTTP ${response.status}`);
      cost.data = payload;
      cost.error = null;
    } catch (error) {
      cost.error = error.message;
      cost.data = null;
    } finally {
      cost.loading = false;
      renderCostsOnly();
    }
  }

  function costWarning(item) {
    const tone = item.level === 'blocked' ? 'danger' : item.level === 'ready' ? 'success' : 'warn';
    return `<div class="cost-warning ${tone}"><strong>${esc(item.code)}</strong><p>${esc(item.message)}</p></div>`;
  }

  function byTypeRows(rows = []) {
    if (!rows.length) return `<div class="empty">Sem work units para esta sessao.</div>`;
    return rows.map(row => `
      <div class="cost-row">
        <strong>${esc(row.unit_type)}</strong>
        <span>${num(row.audio_minutes, ' min')}</span>
        <span>${num(row.units)} units</span>
        <span>${num(row.missing_hash)} sem hash</span>
        <span>${num(row.cache_hits)} cache</span>
        <span>${num(row.candidates)} candidatos</span>
      </div>
    `).join('');
  }

  function ledgerRows(rows = []) {
    if (!rows.length) return `<div class="empty">Nenhum ledger AI registrado.</div>`;
    return rows.map(row => `
      <div class="cost-row">
        <strong>${esc(row.status)}</strong>
        <span>${esc(row.model || '-')}</span>
        <span>${num(row.entries)} entradas</span>
        <span>${num(row.audio_minutes, ' min')}</span>
        <span>$${num(row.estimated_cost_usd)}</span>
      </div>
    `).join('');
  }

  function nextCommand(summary) {
    const id = window.state.selectedSourceSessionId || 'source-session-id';
    if (Number(summary.missingHash || 0) > 0) {
      return `python3 tools/backfill_audio_metadata.py --source-session-id ${id} --write`;
    }
    if (Number(summary.chunkFallbacks || 0) > 0) {
      const limit = Number(summary.speechSlices || 0) > 0 ? 50 : 3;
      return `python3 tools/build_speech_slices.py ${id} --limit ${limit} --write`;
    }
    return `python3 tools/plan_transcription_job.py ${id}`;
  }

  function renderCostDashboard(payload) {
    const summary = payload.summary || {};
    const ledger = payload.ledger || {};
    return `
      <section class="cost-page">
        <div class="cost-head">
          <div>
            <span class="label">Custos OpenAI</span>
            <h2>${esc(summary.sessionTitle || summary.sourceSessionId || 'Sessao')}</h2>
          </div>
          <div class="actions">
            <button onclick="loadAiCost(true)">Atualizar</button>
            <button onclick="copyText('${esc(nextCommand(summary))}', 'Comando copiado.')">Copiar proximo comando</button>
          </div>
        </div>

        <div class="cost-metrics">
          ${card(num(summary.billableAudioMinutes, ' min'), 'minutos cobraveis', Number(summary.missingHash || 0) ? 'danger' : '')}
          ${card(num(summary.rawAudioMinutes, ' min'), 'audio bruto')}
          ${card(num(summary.silentAudioMinutes, ' min'), 'silencio omitido', 'success')}
          ${card(num(summary.missingHash), 'bloqueados sem hash', Number(summary.missingHash || 0) ? 'danger' : '')}
          ${card(num(summary.cacheHits), 'cache hits', 'success')}
          ${card(num(summary.transcribeCandidates), 'candidatos')}
          ${card(num(summary.speechAudioMinutes, ' min'), 'speech slices')}
          ${card(num(summary.fallbackAudioMinutes, ' min'), 'fallback chunks', Number(summary.chunkFallbacks || 0) ? 'warn' : '')}
        </div>

        <div class="cost-warnings">
          ${(payload.warnings || []).map(costWarning).join('') || `<div class="cost-warning success"><strong>ok</strong><p>Nenhum bloqueio de custo detectado para o estado atual.</p></div>`}
        </div>

        <section class="cost-grid">
          <article class="panel">
            <div class="panel-head"><h2>Work units</h2><div class="badges">${chip(`${num(summary.workUnits)} total`, 'blue')}${chip(`${num(summary.silentChunks)} silenciosos`, 'gold')}${chip(payload.model || '-', 'gold')}</div></div>
            <div class="panel-body cost-table">${byTypeRows(payload.byType || [])}</div>
          </article>
          <article class="panel">
            <div class="panel-head"><h2>Ledger AI</h2><div class="badges">${chip(`$${num(ledger.estimatedCostUsd)}`, 'gold')}${chip(`${num(ledger.audioMinutes, ' min')}`, 'blue')}</div></div>
            <div class="panel-body cost-table">${ledgerRows(ledger.byStatus || [])}</div>
          </article>
        </section>

        <article class="panel">
          <div class="panel-head"><h2>Proximo comando</h2>${chip('local', 'blue')}</div>
          <div class="panel-body"><pre>${esc(nextCommand(summary))}</pre></div>
        </article>
      </section>
    `;
  }

  function renderCostsOnly() {
    if (window.state.tab !== 'costs') return;
    const view = document.getElementById('view');
    if (!view) return;
    const cost = costState();
    if (cost.loading) {
      view.innerHTML = `<section class="loading-panel"><div class="loader-line"></div><h2>Carregando custos...</h2></section>`;
      return;
    }
    if (cost.error) {
      view.innerHTML = `<section class="panel"><div class="panel-head"><h2>Custos</h2></div><div class="panel-body"><div class="empty">${esc(cost.error)}</div></div></section>`;
      return;
    }
    if (!cost.data) {
      view.innerHTML = `<section class="panel"><div class="panel-head"><h2>Custos</h2><button onclick="loadAiCost(true)">Carregar</button></div></section>`;
      return;
    }
    view.innerHTML = renderCostDashboard(cost.data);
  }

  function renderWithCosts() {
    injectTab();
    if (window.state.tab !== 'costs') return baseRender();
    renderSessions();
    renderHeader();
    renderStatusStrip();
    updateActionButtons();
    window.syncTabsA11y?.();
    renderCostsOnly();
    loadAiCost(false);
  }

  const baseRender = window.render;
  window.loadAiCost = loadAiCost;
  window.render = renderWithCosts;
  try { render = renderWithCosts; } catch (_error) {}
  injectTab();
})();
