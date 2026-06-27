(function () {
  const endpointByType = {
    cloud_ingest_craig: '/api/jobs/run-cloud-ingest',
    cloud_extract_craig_tracks: '/api/jobs/run-cloud-extract',
    cloud_plan_audio_chunks: '/api/jobs/run-cloud-plan-chunks'
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
    if (status === 'succeeded') return 'green';
    if (status === 'running') return 'orange';
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

  function actionLabel(type) {
    return {
      cloud_ingest_craig: 'Ler manifest',
      cloud_extract_craig_tracks: 'Extrair faixa',
      cloud_plan_audio_chunks: 'Planejar chunks'
    }[type] || 'Executar';
  }

  function jobActionControls(job) {
    const endpoint = jobEndpoint(job);
    if (!endpoint) {
      const next = job.output?.nextAction || job.output?.workerStatus || '';
      return next ? `<p>${esc(next)}</p>` : '';
    }
    const limit = job.type === 'cloud_extract_craig_tracks'
      ? `<label class="inline-job-limit"><span class="label">Faixas</span><input id="jobLimit_${esc(job.id)}" type="number" min="1" max="3" value="1" /></label>`
      : '';
    const chunkSeconds = job.type === 'cloud_plan_audio_chunks'
      ? `<label class="inline-job-limit"><span class="label">Chunk s</span><input id="jobChunkSeconds_${esc(job.id)}" type="number" min="60" max="1800" step="30" value="600" /></label>`
      : '';
    return `
      <div class="job-actions">
        ${limit}
        ${chunkSeconds}
        <button onclick="runCloudJob('${esc(job.id)}', '${esc(job.type)}', true)" ${canDryRun(job) ? '' : 'disabled'}>Simular</button>
        <button class="primary" onclick="runCloudJob('${esc(job.id)}', '${esc(job.type)}', false)" ${canExecute(job) ? '' : 'disabled'}>${esc(actionLabel(job.type))}</button>
      </div>
    `;
  }

  function renderJobRow(job) {
    const status = job.status || 'unknown';
    const workerStatus = job.output?.workerStatus || job.output?.uploadStatus || '';
    const session = job.session?.sourceSessionId || '';
    return `
      <div class="job-row">
        <div class="row between">
          <div>
            <strong>${esc(job.type || 'job')}</strong>
            <small>${esc(job.createdAt || '')}${session ? ` • ${esc(session)}` : ''}</small>
          </div>
          <div class="badges">
            ${chip(status, jobTone(status))}
            ${workerStatus ? chip(workerStatus, 'blue') : ''}
            ${chip(shortId(job.id), 'gold')}
          </div>
        </div>
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
    } catch (error) {
      toast?.(error.message);
      remember?.(`Job ${type} falhou: ${error.message}`);
    } finally {
      if (typeof setBusy === 'function') setBusy(false);
    }
  }

  window.runCloudJob = runCloudJob;
  window.renderJobsList = renderJobsListWithActions;
  try { renderJobsList = renderJobsListWithActions; } catch (_error) {}
  try { render?.(); } catch (_error) {}
})();
