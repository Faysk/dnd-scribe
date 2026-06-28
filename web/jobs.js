(function () {
  const endpointByType = {
    cloud_ingest_craig: '/api/jobs/run-cloud-ingest',
    cloud_extract_craig_tracks: '/api/jobs/run-cloud-extract',
    cloud_plan_audio_chunks: '/api/run-cloud-plan-chunks'
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

  function formatBytes(bytes = 0) {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit += 1;
    }
    return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
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
      cloud_extract_craig_tracks: 'Extrair faixa',
      cloud_plan_audio_chunks: 'Planejar chunks'
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
      : job.type === 'cloud_plan_audio_chunks'
        ? `<label class="inline-job-limit"><span class="label">Chunk s</span><input id="jobChunkSeconds_${esc(job.id)}" type="number" min="60" max="1800" step="60" value="600" /></label>`
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
    if (progress.trackProgress?.extraction_status) parts.push(`faixas: ${progress.trackProgress.extraction_status}`);
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

  function renderTrackSummary(job) {
    const summary = job.trackSummary;
    if (!summary || !summary.total) return '';
    const succeeded = Number(summary.succeeded || 0);
    const total = Math.max(1, Number(summary.total || 0));
    const percent = Math.max(0, Math.min(100, Math.round((succeeded / total) * 100)));
    const tracks = Array.isArray(summary.tracks) ? summary.tracks : [];
    const visibleTracks = tracks.filter(track => track.status !== 'succeeded' || track.error).slice(0, 8);
    const hidden = Math.max(0, tracks.length - visibleTracks.length);
    return `
      <div class="track-progress">
        <div class="track-progress-head">
          <strong>Faixas Craig</strong>
          <div class="badges">
            ${chip(summary.status || 'pending', jobTone(summary.status || 'pending'))}
            ${chip(`${succeeded}/${total}`, 'green')}
            ${summary.failed ? chip(`${summary.failed} falha(s)`, 'red') : ''}
            ${summary.pending ? chip(`${summary.pending} pendente(s)`, 'gold') : ''}
          </div>
        </div>
        <div class="track-progress-bar" aria-label="Progresso das faixas Craig">
          <span style="width:${percent}%"></span>
        </div>
        <small>${esc(formatBytes(summary.extractedBytes))} extraidos de ${esc(formatBytes(summary.sourceCompressedBytes))} comprimidos no ZIP</small>
        ${visibleTracks.length ? `
          <div class="track-list">
            ${visibleTracks.map(track => `
              <div class="track-row ${esc(track.status || '')}">
                <span>${esc(track.trackKey || track.filename || 'faixa')}</span>
                <span>${esc(track.status || 'pending')} · ${esc(track.attempts || 0)}x · ${esc(formatBytes(track.sizeBytes))}</span>
                ${track.error ? `<small>${esc(String(track.error).slice(0, 160))}</small>` : ''}
              </div>
            `).join('')}
            ${hidden > 0 ? `<small>${hidden} faixa(s) concluida(s) ocultas nesta visao compacta.</small>` : ''}
          </div>
        ` : ''}
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
        ${renderTrackSummary(job)}
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
    if (type === 'cloud_plan_audio_chunks') {
      const seconds = Number(document.getElementById(`jobChunkSeconds_${jobId}`)?.value || 600);
      body.chunkSeconds = Math.max(60, Math.min(1800, Number.isFinite(seconds) ? Math.floor(seconds) : 600));
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
