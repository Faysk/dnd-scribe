(function () {
  const endpointByType = {
    cloud_ingest_craig: '/api/jobs/run-cloud-ingest',
    cloud_extract_craig_tracks: '/api/jobs/run-cloud-extract'
  };

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function chip(text, tone = '') {
    return `<span class="badge ${tone}">${esc(text)}</span>`;
  }

  function shortId(value = '') {
    return String(value || '').slice(0, 8);
  }

  function jobTone(status = '') {
    if (status === 'failed') return 'red';
    if (status === 'blocked') return 'red';
    if (status === 'succeeded') return 'green';
    if (status === 'running') return 'orange';
    if (status === 'retrying') return 'orange';
    return 'gold';
  }

  function jobEndpoint(job) {
    return endpointByType[job?.type] || '';
  }

  function canExecute(job) {
    return Boolean(jobEndpoint(job)) && ['queued', 'retrying'].includes(job.status);
  }

  function canDryRun(job) {
    return Boolean(jobEndpoint(job)) && ['queued', 'retrying', 'running'].includes(job.status);
  }

  function canRetry(job) {
    if (!job || !['failed', 'cancelled'].includes(job.status)) return false;
    const steps = job.steps || [];
    if (!steps.length) return true;
    return steps.some(step => step.retryable !== false && ['failed', 'blocked'].includes(step.status));
  }

  function actionLabel(type) {
    return {
      cloud_ingest_craig: 'Ler manifest',
      cloud_extract_craig_tracks: 'Extrair faixa'
    }[type] || 'Executar';
  }

  function jobActionControls(job) {
    const endpoint = jobEndpoint(job);
    const retryButton = canRetry(job)
      ? `<button class="primary" onclick="retryCloudJob('${esc(job.id)}')">Tentar novamente</button>`
      : '';
    if (!endpoint) {
      const next = job.output?.nextAction || job.output?.workerStatus || '';
      return `${next ? `<p>${esc(next)}</p>` : ''}${retryButton ? `<div class="job-actions">${retryButton}</div>` : ''}`;
    }
    const limit = job.type === 'cloud_extract_craig_tracks'
      ? `<label class="inline-job-limit"><span class="label">Faixas</span><input id="jobLimit_${esc(job.id)}" type="number" min="1" max="3" value="1" /></label>`
      : '';
    return `
      <div class="job-actions">
        ${limit}
        <button onclick="runCloudJob('${esc(job.id)}', '${esc(job.type)}', true)" ${canDryRun(job) ? '' : 'disabled'}>Simular</button>
        <button class="primary" onclick="runCloudJob('${esc(job.id)}', '${esc(job.type)}', false)" ${canExecute(job) ? '' : 'disabled'}>${esc(actionLabel(job.type))}</button>
        ${retryButton}
      </div>
    `;
  }

  function shortProgress(step = {}) {
    const progress = step.progress || {};
    const parts = [];
    if (progress.workerStatus) parts.push(progress.workerStatus);
    if (progress.extractedThisRun !== undefined) parts.push(`${progress.extractedThisRun} extraida(s)`);
    if (progress.remainingTracks !== undefined) parts.push(`${progress.remainingTracks} restante(s)`);
    if (progress.tracks !== undefined) parts.push(`${progress.tracks} faixa(s)`);
    if (progress.participants !== undefined) parts.push(`${progress.participants} participante(s)`);
    if (progress.paidAiCostUsd !== undefined) parts.push(`IA $${Number(progress.paidAiCostUsd || 0).toFixed(4)}`);
    return parts.filter(Boolean).slice(0, 3).join(' • ');
  }

  function renderJobSteps(job) {
    const steps = job.steps || [];
    if (!steps.length) return '';
    return `
      <div class="job-step-list">
        ${steps.map(step => `
          <div class="job-step-row ${esc(step.status || '')}">
            <div>
              <strong>${esc(step.label || step.key || 'Etapa')}</strong>
              <small>${esc(shortProgress(step) || step.updatedAt || '')}</small>
              ${step.error ? `<p>${esc(String(step.error).slice(0, 180))}</p>` : ''}
            </div>
            <div class="badges">
              ${chip(step.status || 'pending', jobTone(step.status || 'pending'))}
              ${chip(`${step.attempts || 0}x`, 'blue')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderJobRow(job) {
    const status = job.status || 'unknown';
    const workerStatus = job.output?.workerStatus || job.output?.uploadStatus || '';
    const session = job.session?.sourceSessionId || '';
    const stepStatus = job.stepSummary?.status || '';
    return `
      <div class="job-row">
        <div class="row between">
          <div>
            <strong>${esc(job.type || 'job')}</strong>
            <small>${esc(job.createdAt || '')}${session ? ` • ${esc(session)}` : ''}</small>
          </div>
          <div class="badges">
            ${chip(status, jobTone(status))}
            ${stepStatus ? chip(`steps: ${stepStatus}`, jobTone(stepStatus)) : ''}
            ${workerStatus ? chip(workerStatus, 'blue') : ''}
            ${chip(shortId(job.id), 'gold')}
          </div>
        </div>
        ${renderJobSteps(job)}
        ${jobActionControls(job)}
        ${job.error ? `<p>${esc(String(job.error).slice(0, 240))}</p>` : ''}
        ${job.output ? `<pre>${esc(JSON.stringify(job.output, null, 2).slice(0, 900))}</pre>` : ''}
      </div>
    `;
  }

  function renderJobsListWithActions() {
    const jobs = window.state?.jobs || [];
    if (!jobs.length) return `<div class="empty">Nenhum job de producao registrado.</div>`;
    return `
      <div class="job-list">
        ${jobs.slice(0, 12).map(renderJobRow).join('')}
      </div>
    `;
  }

  async function callApi(path, body) {
    if (typeof api === 'function') {
      return api(path, {
        method: 'POST',
        body: JSON.stringify(body)
      });
    }
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    return payload;
  }

  async function runCloudJob(jobId, type, dryRun = false) {
    const endpoint = endpointByType[type];
    if (!endpoint) {
      toast?.('Worker ainda nao implementado para este job.');
      return;
    }
    const body = { jobId, dryRun };
    if (type === 'cloud_extract_craig_tracks') {
      const limit = Number(document.getElementById(`jobLimit_${jobId}`)?.value || 1);
      body.maxTracks = Math.max(1, Math.min(3, Number.isFinite(limit) ? Math.floor(limit) : 1));
    }
    if (!dryRun && !window.confirm('Executar este job em producao? Esta etapa nao usa OpenAI paga.')) return;

    try {
      if (typeof setBusy === 'function') setBusy(true);
      const payload = await callApi(endpoint, body);
      remember?.(`Job ${type}: ${dryRun ? 'simulado' : 'executado'}.`, payload.summary || payload.message || payload);
      toast?.(dryRun ? 'Simulacao concluida.' : 'Job executado.');
      await loadJobs?.(true);
      if (!dryRun && payload.sourceSessionId && typeof loadSessions === 'function') {
        await loadSessions(false);
      }
      render?.();
      return payload;
    } catch (error) {
      toast?.(error.message);
      remember?.(`Job ${type} falhou: ${error.message}`);
      return null;
    } finally {
      if (typeof setBusy === 'function') setBusy(false);
    }
  }

  async function retryCloudJob(jobId, reason = 'retry_requested_from_ui') {
    if (!window.confirm('Colocar este job de volta na fila de retry?')) return null;
    try {
      if (typeof setBusy === 'function') setBusy(true);
      const payload = await callApi('/api/jobs/retry', { jobId, reason });
      if (payload.jobs) window.state.jobs = payload.jobs;
      remember?.('Job reenfileirado para retry.', { jobId, reason });
      toast?.('Job reenfileirado.');
      await loadJobs?.(true);
      render?.();
      return payload;
    } catch (error) {
      toast?.(error.message);
      remember?.(`Retry falhou: ${error.message}`);
      return null;
    } finally {
      if (typeof setBusy === 'function') setBusy(false);
    }
  }

  window.runCloudJob = runCloudJob;
  window.retryCloudJob = retryCloudJob;
  window.renderJobSteps = renderJobSteps;
  window.renderJobsList = renderJobsListWithActions;
  try { renderJobsList = renderJobsListWithActions; } catch (_error) {}
  try { render?.(); } catch (_error) {}
})();
