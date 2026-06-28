(function () {
  function monitoringState() {
    window.state.monitoring ||= {
      loading: false,
      error: null,
      data: null,
      deep: false,
      loadedAt: null
    };
    return window.state.monitoring;
  }

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function num(value, decimals = 0) {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed)) return '0';
    return parsed.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function money(value) {
    return `$${num(value, 4)}`;
  }

  function bytes(value) {
    let amount = Number(value || 0);
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let index = 0;
    while (amount >= 1024 && index < units.length - 1) {
      amount /= 1024;
      index += 1;
    }
    const decimals = index <= 1 ? 0 : 2;
    return `${num(amount, decimals)} ${units[index]}`;
  }

  function chip(text, tone = '') {
    return `<span class="badge ${tone}">${esc(text)}</span>`;
  }

  function tone(status = '') {
    return {
      ok: 'green',
      critical: 'red',
      attention: 'orange',
      warning: 'gold',
      standby: 'blue',
      not_checked: 'blue'
    }[status] || 'gold';
  }

  function statusLabel(status = '') {
    return {
      ok: 'ok',
      critical: 'critico',
      attention: 'atencao',
      warning: 'aviso',
      standby: 'standby',
      not_checked: 'nao testado'
    }[status] || status || 'desconhecido';
  }

  function metricById(data, id) {
    return (data?.metrics || []).find(item => item.id === id)?.data || {};
  }

  function injectTab() {
    const tabs = document.getElementById('tabs');
    if (!tabs || tabs.querySelector('[data-tab="monitoring"]')) return;
    const button = document.createElement('button');
    button.dataset.tab = 'monitoring';
    button.textContent = 'Monitor';
    const ops = tabs.querySelector('[data-tab="ops"]');
    tabs.insertBefore(button, ops || null);
  }

  async function loadMonitoring(deep = false, force = false) {
    const mon = monitoringState();
    if (!force && mon.data && mon.deep === deep) return mon.data;
    mon.loading = true;
    mon.error = null;
    mon.deep = deep;
    renderMonitoringOnly();
    try {
      const path = deep ? '/api/monitoring?deep=1' : '/api/monitoring';
      const payload = await api(path);
      mon.data = payload;
      mon.loadedAt = new Date().toISOString();
      mon.error = null;
      remember?.(`Monitor atualizado${deep ? ' com verificacao profunda' : ''}.`, {
        status: payload.overallStatus,
        snapshotId: payload.snapshotId
      });
    } catch (error) {
      mon.error = error.message;
      mon.data = null;
    } finally {
      mon.loading = false;
      renderMonitoringOnly();
    }
    return mon.data;
  }

  function summaryMetric(value, label, status = '') {
    return `<div class="monitor-metric ${status}"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;
  }

  function recommendation(item) {
    return `
      <div class="monitor-alert ${tone(item.level)}">
        <strong>${esc(item.title)}</strong>
        <p>${esc(item.detail)}</p>
      </div>
    `;
  }

  function readinessTitle(readiness = {}) {
    if (!readiness.ready) return 'Bloqueado para teste real';
    if (Number(readiness.attention || 0) > 0) return 'Pronto com atencoes';
    return 'Pronto para sessao';
  }

  function readinessCopy(readiness = {}) {
    if (!readiness.ready) return `${num(readiness.blocking)} bloqueio(s) precisam ser resolvidos antes de usar em mesa.`;
    if (Number(readiness.attention || 0) > 0) return `${num(readiness.attention)} ponto(s) merecem conferencia, mas sem bloqueio critico.`;
    return 'Servicos essenciais, dados e operacao estao verdes no snapshot atual.';
  }

  function readinessItem(item = {}) {
    return `
      <div class="monitor-readiness-item ${tone(item.status)}">
        <div class="row between">
          <strong>${esc(item.label || item.id)}</strong>
          ${chip(statusLabel(item.status), tone(item.status))}
        </div>
        <p>${esc(item.detail || '')}</p>
      </div>
    `;
  }

  function renderReadiness(readiness = {}) {
    const items = readiness.items || [];
    return `
      <section class="monitor-readiness ${tone(readiness.status)}">
        <div class="monitor-readiness-head">
          <div>
            <span class="label">Prontidao operacional</span>
            <h2>${esc(readinessTitle(readiness))}</h2>
            <p>${esc(readinessCopy(readiness))}</p>
          </div>
          <div class="badges">
            ${chip(`${num(readiness.blocking)} bloqueios`, readiness.blocking ? 'red' : 'green')}
            ${chip(`${num(readiness.attention)} atencoes`, readiness.attention ? 'orange' : 'green')}
          </div>
        </div>
        <div class="monitor-readiness-grid">
          ${items.map(readinessItem).join('') || '<div class="empty">Sem dados de prontidao neste snapshot.</div>'}
        </div>
      </section>
    `;
  }

  function jsonDetails(label, status, description, data, open = false) {
    return `
      <details class="monitor-detail" ${open ? 'open' : ''}>
        <summary>
          <span>${esc(label)}</span>
          <span class="badges">${chip(statusLabel(status), tone(status))}</span>
        </summary>
        ${description ? `<p>${esc(description)}</p>` : ''}
        <pre>${esc(JSON.stringify(data || {}, null, 2))}</pre>
      </details>
    `;
  }

  function renderEnvItem(item) {
    const shown = {
      required: item.required,
      mode: item.mode,
      configured: item.configured,
      presentKeys: item.presentKeys,
      missingKeys: item.missingKeys,
      secrets: item.secrets,
      note: item.note || null
    };
    return jsonDetails(item.label, item.status, item.description, shown);
  }

  function renderCheckItem(item) {
    return jsonDetails(item.label || item.id, item.status, item.description, {
      ms: item.ms,
      data: item.data || null,
      error: item.error || null,
      missingKeys: item.missingKeys || null
    });
  }

  function renderMetricItem(item) {
    return jsonDetails(item.label || item.id, item.status, item.error || '', item.data, item.status !== 'ok');
  }

  function storageTotals(rows = []) {
    return rows.reduce((acc, row) => {
      acc.files += Number(row.files || 0);
      acc.bytes += Number(row.bytes || 0);
      acc.minutes += Number(row.audio_minutes || 0);
      return acc;
    }, { files: 0, bytes: 0, minutes: 0 });
  }

  function renderRecentJobs(jobs = []) {
    if (!jobs.length) return `<div class="empty">Nenhum job recente registrado.</div>`;
    return `
      <div class="monitor-log-list">
        ${jobs.map(job => `
          <details class="monitor-log-row">
            <summary>
              <span>
                <strong>${esc(job.job_type || 'job')}</strong>
                <small>${esc(job.source_session_id || 'sem sessao')} - ${esc(job.created_at || '')}</small>
              </span>
              <span class="badges">${chip(job.status || 'unknown', tone(job.status === 'failed' ? 'critical' : job.status === 'succeeded' ? 'ok' : 'attention'))}</span>
            </summary>
            ${job.error ? `<p>${esc(job.error)}</p>` : ''}
            <pre>${esc(JSON.stringify(job, null, 2))}</pre>
          </details>
        `).join('')}
      </div>
    `;
  }

  function renderMonitoringDashboard(data) {
    const sessions = metricById(data, 'sessions');
    const content = metricById(data, 'content');
    const storage = metricById(data, 'storage');
    const audio = metricById(data, 'audio-pipeline');
    const ai = metricById(data, 'ai-usage');
    const jobs = metricById(data, 'jobs');
    const totals = storageTotals(storage);
    return `
      <section class="monitor-page">
        <div class="monitor-head">
          <div>
            <span class="label">Central operacional</span>
            <h2>Monitoramento do projeto</h2>
            <p>Snapshot ${esc(data.snapshotId || '-')} - ${esc(data.generatedAt || '')}</p>
          </div>
          <div class="actions">
            <button onclick="loadMonitoring(false, true)">Atualizar rapido</button>
            <button class="primary" onclick="loadMonitoring(true, true)">Verificacao profunda</button>
          </div>
        </div>

        <div class="monitor-overview">
          ${summaryMetric(statusLabel(data.overallStatus), 'estado geral', data.overallStatus)}
          ${summaryMetric(num(sessions.total), 'sessoes')}
          ${summaryMetric(num(content.segments), 'segmentos')}
          ${summaryMetric(num(content.roll20Events), 'eventos Roll20')}
          ${summaryMetric(bytes(totals.bytes), 'dados em arquivos')}
          ${summaryMetric(`${num(audio.speechSliceMinutes, 2)} min`, 'audio em slices')}
          ${summaryMetric(money(ai.estimatedCostUsd), 'IA estimada')}
          ${summaryMetric(num(jobs.failedLast24h), 'falhas 24h', Number(jobs.failedLast24h || 0) ? 'critical' : '')}
        </div>

        ${renderReadiness(data.readiness || {})}

        <section class="monitor-section">
          <div class="panel-head">
            <h2>Atencao</h2>
            <div class="badges">${chip(data.deep ? 'profundo' : 'rapido', data.deep ? 'green' : 'blue')}</div>
          </div>
          <div class="monitor-alert-grid">
            ${(data.recommendations || []).map(recommendation).join('')}
          </div>
        </section>

        <section class="monitor-grid">
          <article class="monitor-panel">
            <div class="panel-head"><h2>APIs e servicos</h2></div>
            <div class="monitor-detail-list">${(data.checks || []).map(renderCheckItem).join('')}</div>
          </article>

          <article class="monitor-panel">
            <div class="panel-head"><h2>Tokens e env</h2></div>
            <div class="monitor-detail-list">${(data.env || []).map(renderEnvItem).join('')}</div>
          </article>
        </section>

        <section class="monitor-grid">
          <article class="monitor-panel wide">
            <div class="panel-head"><h2>Banco e consumo</h2></div>
            <div class="monitor-detail-list">${(data.metrics || []).map(renderMetricItem).join('')}</div>
          </article>

          <article class="monitor-panel">
            <div class="panel-head"><h2>Logs recentes</h2>${chip(`${num(jobs.total)} jobs`, 'blue')}</div>
            ${renderRecentJobs(jobs.recent || [])}
          </article>
        </section>
      </section>
    `;
  }

  function renderMonitoringOnly() {
    if (window.state.tab !== 'monitoring') return;
    const view = document.getElementById('view');
    if (!view) return;
    const mon = monitoringState();
    if (!canViewMonitoring?.()) {
      view.innerHTML = `
        <section class="loading-panel">
          <h2>Monitoramento restrito</h2>
          <p>Esta pagina mostra tokens, status de APIs e consumo operacional. Ela exige permissao tecnica project.monitor.read.</p>
        </section>
      `;
      return;
    }
    if (mon.loading) {
      view.innerHTML = `<section class="loading-panel"><div class="loader-line"></div><h2>Gerando snapshot operacional...</h2></section>`;
      return;
    }
    if (mon.error) {
      view.innerHTML = `
        <section class="panel">
          <div class="panel-head"><h2>Monitoramento</h2><button onclick="loadMonitoring(false, true)">Tentar de novo</button></div>
          <div class="panel-body"><div class="empty">${esc(mon.error)}</div></div>
        </section>
      `;
      return;
    }
    if (!mon.data) {
      view.innerHTML = `
        <section class="panel">
          <div class="panel-head"><h2>Monitoramento</h2><button class="primary" onclick="loadMonitoring(false, true)">Carregar</button></div>
          <div class="panel-body"><p>Carrega saude das APIs, envs, banco, consumo e jobs reais de producao.</p></div>
        </section>
      `;
      return;
    }
    view.innerHTML = renderMonitoringDashboard(mon.data);
  }

  function renderWithMonitoring() {
    injectTab();
    if (window.state.tab !== 'monitoring') return baseRender();
    renderSiteGate();
    renderSessions();
    renderHeader();
    renderStatusStrip();
    updateActionButtons();
    if (window.state.auth.ready && !canReadCampaign() && !canViewMonitoring?.()) {
      document.getElementById('view').innerHTML = authGateView();
      return;
    }
    document.querySelectorAll('#tabs button').forEach(button => {
      button.classList.toggle('active', button.dataset.tab === window.state.tab);
    });
    renderMonitoringOnly();
    loadMonitoring(false, false);
  }

  const baseRender = window.render;
  window.loadMonitoring = loadMonitoring;
  window.renderMonitoringOnly = renderMonitoringOnly;
  window.render = renderWithMonitoring;
  try { render = renderWithMonitoring; } catch (_error) {}
  injectTab();
})();
