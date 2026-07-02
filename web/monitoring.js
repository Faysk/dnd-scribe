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
    if (!tabs) return;
    if (!tabs.querySelector('[data-tab="monitoring"]')) {
      const button = document.createElement('button');
      button.dataset.tab = 'monitoring';
      button.textContent = 'Monitor';
      const ops = tabs.querySelector('[data-tab="ops"]');
      tabs.insertBefore(button, ops || null);
    }
    window.syncTabsA11y?.();
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

  function monitorTriageItems(data = {}) {
    const items = [];
    const push = (source, item = {}, level = item.status || item.level || '') => {
      const status = level === 'warning' ? 'attention' : level;
      items.push({
        source,
        id: item.id || item.label || item.title || source,
        label: item.label || item.title || item.id || source,
        detail: item.description || item.detail || item.error || item.note || '',
        status
      });
    };
    (data.checks || []).forEach(item => push('API', item));
    (data.env || []).forEach(item => push('Env', item));
    (data.metrics || []).forEach(item => push('Metricas', item));
    (data.readiness?.items || []).forEach(item => push('Prontidao', item));
    (data.recommendations || []).forEach(item => push('Recomendacao', item, item.level));
    return items;
  }

  function monitorActionText(item, data = {}) {
    if (!item) return 'Atualizar snapshot antes de decidir.';
    const label = `${item.source} ${item.label}`.toLowerCase();
    if (label.includes('env') || label.includes('token') || label.includes('secret')) return 'Conferir variaveis e expiracao antes de rodar testes reais.';
    if (label.includes('storage') || label.includes('r2') || label.includes('limpeza')) return 'Auditar storage e rodar limpeza apenas em modo confirmado.';
    if (label.includes('job') || label.includes('pipeline')) return 'Abrir Operacao, revisar job falho e usar retry/pausa/descarte.';
    if (label.includes('roll20') || label.includes('discord')) return 'Validar ingestao da fonte e ultima mensagem/evento recebido.';
    if (data.deep) return 'Corrigir o item critico ou reexecutar verificacao profunda apos ajuste.';
    return 'Rodar verificacao profunda para confirmar antes de agir.';
  }

  function renderMonitorTriage(data = {}) {
    const items = monitorTriageItems(data);
    const critical = items.filter(item => item.status === 'critical');
    const attention = items.filter(item => ['attention', 'warning'].includes(item.status));
    const healthy = items.filter(item => item.status === 'ok');
    const unknown = items.filter(item => ['standby', 'not_checked', ''].includes(item.status || ''));
    const focus = critical[0] || attention[0] || unknown[0] || null;
    const triageStatus = critical.length ? 'critical' : attention.length ? 'attention' : unknown.length ? 'standby' : 'ok';
    const title = critical.length
      ? `${critical.length} item(ns) critico(s)`
      : attention.length
        ? `${attention.length} item(ns) em atencao`
        : unknown.length
          ? `${unknown.length} item(ns) sem teste profundo`
          : 'Tudo saudavel no snapshot';
    const detail = focus
      ? `${focus.source}: ${focus.label}${focus.detail ? ` - ${focus.detail}` : ''}`
      : 'Nenhum bloqueio operacional encontrado no snapshot atual.';
    return `
      <section class="monitor-triage ${tone(triageStatus)}">
        <div class="monitor-triage-main">
          <div>
            <span class="label">Triagem tecnica</span>
            <h2>${esc(title)}</h2>
            <p>${esc(detail)}</p>
          </div>
          <div class="badges">
            ${chip(`${num(critical.length)} criticos`, critical.length ? 'red' : 'green')}
            ${chip(`${num(attention.length)} atencoes`, attention.length ? 'orange' : 'green')}
            ${chip(`${num(healthy.length)} ok`, 'green')}
            ${unknown.length ? chip(`${num(unknown.length)} sem teste`, 'blue') : ''}
          </div>
        </div>
        <div class="monitor-triage-grid">
          <div><span class="label">Acao segura</span><strong>${esc(monitorActionText(focus, data))}</strong></div>
          <div><span class="label">Snapshot</span><strong>${esc(data.snapshotId || '-')}</strong></div>
          <div><span class="label">Gerado</span><strong>${esc(data.generatedAt || '-')}</strong></div>
          <div><span class="label">Modo</span><strong>${esc(data.deep ? 'profundo' : 'rapido')}</strong></div>
        </div>
        <div class="actions monitor-triage-actions">
          <button onclick="loadMonitoring(false, true)">Atualizar rapido</button>
          <button class="primary" onclick="loadMonitoring(true, true)">Verificacao profunda</button>
          <button onclick="state.tab='ops'; render();">Abrir Operacao</button>
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

  function renderStoragePolicyPanel(storageBudget = {}, cleanup = {}) {
    const policy = storageBudget.policy || {};
    const cards = [
      {
        label: 'Total rastreado',
        value: bytes(storageBudget.totalBytes || 0),
        detail: `${num(storageBudget.usagePercent || 0)}% do limite operacional`,
        tone: storageBudget.status || ''
      },
      {
        label: 'Meta por sessao',
        value: bytes(policy.sessionRetainedTargetBytes || 0),
        detail: `media atual ${bytes(storageBudget.averageSessionBytes || 0)}`,
        tone: Number(storageBudget.averageRetainedTargetPercent || 0) >= 100 ? 'attention' : 'ok'
      },
      {
        label: 'Upload grande',
        value: bytes(policy.uploadZipWarningBytes || 0),
        detail: 'aviso antes de aceitar ZIP Craig pesado',
        tone: 'blue'
      },
      {
        label: 'Limpeza segura',
        value: bytes(cleanup.deleteReadyBytes || 0),
        detail: `${num(cleanup.deleteReadyObjects || 0)} objeto(s) delete_ready`,
        tone: Number(cleanup.deleteReadyObjects || 0) ? 'attention' : 'ok'
      }
    ];
    return `
      <section class="monitor-storage-policy">
        <div>
          <span class="label">Politica de retencao</span>
          <h2>Guardar o util, remover o bruto</h2>
          <p>${esc(policy.note || 'ZIP/FLAC/WAV temporario deve sair depois que Opus compacto, manifest, transcript e evidencias estiverem seguros.')}</p>
        </div>
        <div class="monitor-storage-policy-grid">
          ${cards.map(card => `
            <article class="${tone(card.tone)}">
              <span class="label">${esc(card.label)}</span>
              <strong>${esc(card.value)}</strong>
              <small>${esc(card.detail)}</small>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderMonitoringDashboard(data) {
    const sessions = metricById(data, 'sessions');
    const content = metricById(data, 'content');
    const storage = metricById(data, 'storage');
    const roll20Bridge = metricById(data, 'roll20-bridge-events');
    const discordSync = metricById(data, 'discord-sync');
    const cleanup = metricById(data, 'audio-cleanup');
    const storageBudget = metricById(data, 'storage-budget');
    const audio = metricById(data, 'audio-pipeline');
    const ai = metricById(data, 'ai-usage');
    const jobs = metricById(data, 'jobs');
    const totals = storageTotals(storage);
    const storageUsage = Number.isFinite(Number(storageBudget.usagePercent))
      ? `${num(storageBudget.usagePercent)}%`
      : '-';
    const storageAverageTone = Number(storageBudget.averageRetainedTargetPercent || 0) >= 100 ? 'attention' : '';
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

        ${renderMonitorTriage(data)}

        <div class="monitor-overview">
          ${summaryMetric(statusLabel(data.overallStatus), 'estado geral', data.overallStatus)}
          ${summaryMetric(num(sessions.total), 'sessoes')}
          ${summaryMetric(num(content.segments), 'segmentos')}
          ${summaryMetric(num(content.roll20Events), 'eventos Roll20')}
          ${summaryMetric(num(roll20Bridge.total), 'ponte Roll20', Number(roll20Bridge.total || 0) ? 'ok' : 'attention')}
          ${summaryMetric(num(discordSync.total), 'mensagens Discord', Number(discordSync.total || 0) ? 'ok' : 'attention')}
          ${summaryMetric(bytes(totals.bytes), 'dados em arquivos')}
          ${summaryMetric(storageUsage, 'limite storage', storageBudget.status || '')}
          ${summaryMetric(bytes(storageBudget.averageSessionBytes), 'media/sessao storage', storageBudget.status === 'critical' ? 'critical' : storageAverageTone)}
          ${summaryMetric(bytes(cleanup.deleteReadyBytes), 'limpeza pronta', Number(cleanup.deleteReadyBytes || 0) ? 'attention' : '')}
          ${summaryMetric(`${num(audio.speechSliceMinutes, 2)} min`, 'audio em slices')}
          ${summaryMetric(money(ai.estimatedCostUsd), 'IA estimada')}
          ${summaryMetric(num(jobs.failedLast24h), 'falhas 24h', Number(jobs.failedLast24h || 0) ? 'critical' : '')}
          ${summaryMetric(num(cleanup.blockedObjects), 'limpeza bloqueada', Number(cleanup.blockedObjects || 0) ? 'attention' : '')}
        </div>

        ${renderReadiness(data.readiness || {})}
        ${renderStoragePolicyPanel(storageBudget, cleanup)}

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
    window.syncTabsA11y?.();
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
