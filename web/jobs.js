(function () {
  const endpointByType = {
    cloud_ingest_craig: '/api/pipeline-continue',
    cloud_extract_craig_tracks: '/api/pipeline-continue',
    cloud_plan_audio_chunks: '/api/pipeline-continue'
  };
  const zeroCostPipelineTypes = new Set([
    'cloud_ingest_craig',
    'cloud_extract_craig_tracks',
    'cloud_plan_audio_chunks'
  ]);
  const STALE_RUNNING_MINUTES = 20;

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

  function minutesSince(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  }

  function jobAgeMinutes(job) {
    return minutesSince(job?.startedAt || job?.createdAt);
  }

  function isZeroCostJob(job) {
    return zeroCostPipelineTypes.has(job?.type || '');
  }

  function isStaleRunning(job) {
    return isZeroCostJob(job) && job?.status === 'running' && Number(jobAgeMinutes(job)) >= STALE_RUNNING_MINUTES;
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
    return Boolean(jobEndpoint(job)) && (['queued', 'retrying'].includes(job.status) || isStaleRunning(job));
  }

  function canDryRun(job) {
    return Boolean(jobEndpoint(job)) && ['queued', 'retrying', 'running'].includes(job.status);
  }

  function selectedPipelineSourceSessionId() {
    return window.state?.ingest?.planned?.session?.sourceSessionId
      || window.state?.ingest?.result?.session?.sourceSessionId
      || window.state?.ingest?.result?.sourceSessionId
      || window.state?.ingest?.lastJobResult?.sourceSessionId
      || window.state?.selectedSourceSessionId
      || '';
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

  function pipelineStatus(jobs = []) {
    const relevant = jobs.filter(job => isZeroCostJob(job) || job.type === 'cloud_detect_speech_slices');
    const next = relevant.find(job => isZeroCostJob(job) && ['queued', 'retrying'].includes(job.status));
    const running = relevant.find(job => isZeroCostJob(job) && job.status === 'running');
    const stale = relevant.find(isStaleRunning);
    const blocked = relevant.find(job => job.type === 'cloud_detect_speech_slices' && ['queued', 'retrying', 'running', 'failed'].includes(job.status));
    const failed = relevant.filter(job => job.status === 'failed');
    const counts = relevant.reduce((summary, job) => {
      const status = job.status || 'unknown';
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    }, {});
    return { relevant, next, running, stale, blocked, failed, counts };
  }

  function pipelineTitle(status) {
    if (status.next) return `Proxima etapa: ${status.next.type}`;
    if (status.stale) return `Possivel timeout: ${status.stale.type}`;
    if (status.running) return `Rodando: ${status.running.type}`;
    if (status.failed.length) return `${status.failed.length} job(s) com falha`;
    if (status.blocked) return 'Aguardando worker de fala';
    return 'Sem etapa zero-cost pendente';
  }

  function pipelineDetail(status, sourceSessionId) {
    if (status.next) return `${sourceSessionId || status.next.session?.sourceSessionId || 'sessao'} pronta para continuar sem OpenAI paga.`;
    if (status.stale) return `Rodando ha ${jobAgeMinutes(status.stale)} min. Use Recuperar pipeline para voltar o job para retry e continuar com auditoria.`;
    if (status.running) return `Rodando ha ${jobAgeMinutes(status.running) ?? '-'} min. Atualize antes de disparar outra etapa.`;
    if (status.failed.length) return 'Use Tentar novamente no job falho antes de continuar a esteira.';
    if (status.blocked) return 'ZIP, manifest, extracao e chunks chegaram ao limite atual; falta o worker cloud de fala.';
    return sourceSessionId || 'Selecione uma sessao para inspecionar a esteira.';
  }

  function pipelineBadges(status) {
    const badges = [];
    if (status.counts.queued) badges.push(chip(`${status.counts.queued} fila`, 'gold'));
    if (status.counts.retrying) badges.push(chip(`${status.counts.retrying} retry`, 'orange'));
    if (status.counts.running) badges.push(chip(`${status.counts.running} rodando`, 'orange'));
    if (status.failed.length) badges.push(chip(`${status.failed.length} falha`, 'red'));
    if (status.stale) badges.push(chip(`>${STALE_RUNNING_MINUTES} min`, 'red'));
    if (status.blocked && !status.next) badges.push(chip('fala pendente', 'blue'));
    if (!badges.length) badges.push(chip('OpenAI $0', 'green'));
    return badges.join('');
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
    const inspectButton = job.status === 'running'
      ? `<button onclick="continuePipeline('${esc(job.session?.sourceSessionId || '')}', { dryRun: true, maxRuns: 1 })">Inspecionar</button>`
      : '';
    const primaryLabel = isStaleRunning(job) ? 'Recuperar' : actionLabel(job.type);
    return `
      <div class="job-actions">
        ${limit}
        <button onclick="runCloudJob('${esc(job.id)}', '${esc(job.type)}', true)" ${canDryRun(job) ? '' : 'disabled'}>Simular</button>
        <button class="primary" onclick="runCloudJob('${esc(job.id)}', '${esc(job.type)}', false)" ${canExecute(job) ? '' : 'disabled'}>${esc(primaryLabel)}</button>
        ${inspectButton}
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
    const age = job.status === 'running' ? jobAgeMinutes(job) : null;
    return `
      <div class="job-row ${isStaleRunning(job) ? 'pipeline-stale' : ''}">
        <div class="row between">
          <div>
            <strong>${esc(job.type || 'job')}</strong>
            <small>${esc(job.createdAt || '')}${session ? ` • ${esc(session)}` : ''}</small>
          </div>
          <div class="badges">
            ${chip(status, jobTone(status))}
            ${stepStatus ? chip(`steps: ${stepStatus}`, jobTone(stepStatus)) : ''}
            ${workerStatus ? chip(workerStatus, 'blue') : ''}
            ${age !== null ? chip(`${age} min`, isStaleRunning(job) ? 'red' : 'orange') : ''}
            ${chip(shortId(job.id), 'gold')}
          </div>
        </div>
        ${renderJobSteps(job)}
        ${renderTrackSummary(job)}
        ${isStaleRunning(job) ? `<p>Este job esta rodando ha mais de ${STALE_RUNNING_MINUTES} minutos. Use Recuperar para voltar a etapa a retry com trilha de auditoria e continuar sem OpenAI paga.</p>` : ''}
        ${jobActionControls(job)}
        ${job.error ? `<p>${esc(String(job.error).slice(0, 240))}</p>` : ''}
        ${job.output ? `<pre>${esc(JSON.stringify(job.output, null, 2).slice(0, 900))}</pre>` : ''}
      </div>
    `;
  }

  function renderJobsListWithActions() {
    const jobs = window.state?.jobs || [];
    if (!jobs.length) return `<div class="empty">Nenhum job de producao registrado.</div>`;
    const status = pipelineStatus(jobs);
    const sourceSessionId = selectedPipelineSourceSessionId();
    const controlSourceSessionId = sourceSessionId
      || status.next?.session?.sourceSessionId
      || status.stale?.session?.sourceSessionId
      || status.running?.session?.sourceSessionId
      || '';
    const canContinue = Boolean(status.next || status.stale);
    const controlLabel = status.stale && !status.next ? 'Recuperar pipeline' : 'Continuar pipeline';
    return `
      <div class="pipeline-control">
        <div>
          <span class="label">Pipeline Craig</span>
          <strong>${esc(pipelineTitle(status))}</strong>
          <small>${esc(pipelineDetail(status, controlSourceSessionId))}</small>
          <div class="badges">${pipelineBadges(status)}</div>
        </div>
        <div class="job-actions">
          <button onclick="continuePipeline('${esc(controlSourceSessionId)}', { dryRun: true, maxRuns: 1 })">Simular proxima</button>
          <button class="primary" onclick="continuePipeline('${esc(controlSourceSessionId)}')" ${canContinue ? '' : 'disabled'}>${esc(controlLabel)}</button>
        </div>
      </div>
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

  async function recoverPipeline(sourceSessionId = '', options = {}) {
    if (options.dryRun === true) return null;
    try {
      const payload = await callApi('/api/pipeline-recover', {
        sourceSessionId: sourceSessionId || selectedPipelineSourceSessionId(),
        jobId: options.jobId || '',
        dryRun: false,
        staleMinutes: STALE_RUNNING_MINUTES
      });
      const recovered = payload?.staleRecovery?.recovered?.length || 0;
      if (recovered) {
        remember?.(`${recovered} job(s) travado(s) recuperado(s).`, payload.staleRecovery);
        toast?.(`${recovered} job(s) recuperado(s).`);
        await loadJobs?.(true);
      }
      return payload;
    } catch (error) {
      remember?.(`Recovery de pipeline nao aplicado: ${error.message}`);
      return null;
    }
  }

  async function runCloudJob(jobId, type, dryRun = false) {
    const endpoint = endpointByType[type];
    if (!endpoint) {
      toast?.('Worker ainda nao implementado para este job.');
      return;
    }
    const body = { jobId, dryRun, recoverStale: true, staleMinutes: STALE_RUNNING_MINUTES };
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
      const recovery = dryRun ? null : await recoverPipeline(selectedPipelineSourceSessionId(), { jobId });
      const payload = await callApi(endpoint, body);
      if (recovery?.staleRecovery?.recovered?.length && !payload.staleRecovery) {
        payload.staleRecovery = recovery.staleRecovery;
      }
      if (payload.jobs) window.state.jobs = payload.jobs;
      if (payload.sessions) window.state.sessions = payload.sessions;
      if (payload.jobResult && window.state?.ingest) {
        window.state.ingest = { ...window.state.ingest, lastJobResult: payload.jobResult };
      }
      remember?.(`Job ${type}: ${dryRun ? 'simulado' : 'executado'}.`, payload.jobResult?.summary || payload.summary || payload.message || payload);
      toast?.(payload.message || (dryRun ? 'Simulacao concluida.' : 'Job executado.'));
      await loadJobs?.(true);
      if (!dryRun && (payload.sourceSessionId || payload.jobResult?.sourceSessionId) && typeof loadSessions === 'function') {
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

  function pipelineCompletionToast(payload, dryRun) {
    const recovered = payload?.staleRecovery?.recovered?.length || 0;
    if (recovered) return `${recovered} job(s) antigo(s) recuperado(s); pipeline atualizado.`;
    if (payload?.blockedJob) return payload.message || 'Pipeline pausado na proxima etapa planejada.';
    if (payload?.message) return payload.message;
    return dryRun ? 'Simulacao concluida.' : 'Pipeline atualizado.';
  }

  async function continuePipeline(sourceSessionId = '', options = {}) {
    const resolvedSourceSessionId = sourceSessionId || selectedPipelineSourceSessionId();
    const dryRun = options.dryRun === true;
    const maxRuns = dryRun ? 1 : Math.max(1, Math.min(20, Number(options.maxRuns || 12)));
    const maxTracksInput = Number(document.getElementById('pipelineMaxTracks')?.value || options.maxTracks || 1);
    const maxTracks = Math.max(1, Math.min(3, Number.isFinite(maxTracksInput) ? Math.floor(maxTracksInput) : 1));
    const chunkInput = Number(document.getElementById('ingestChunkSeconds')?.value || options.chunkSeconds || 600);
    const chunkSeconds = Math.max(60, Math.min(1800, Number.isFinite(chunkInput) ? Math.floor(chunkInput) : 600));
    if (!dryRun && !options.auto && !window.confirm('Continuar a esteira zero-cost em producao? A etapa atual nao chama OpenAI paga.')) return null;
    let lastPayload = null;
    let preflightRecovery = null;
    try {
      if (typeof setBusy === 'function') setBusy(true);
      if (window.state?.ingest) {
        window.state.ingest = {
          ...window.state.ingest,
          busy: true,
          phase: dryRun ? 'pipeline-dry-run' : 'pipeline-running',
          progress: null,
          error: null
        };
      }
      render?.();
      if (!dryRun) {
        preflightRecovery = await recoverPipeline(resolvedSourceSessionId, { dryRun: false });
      }
      for (let index = 0; index < maxRuns; index += 1) {
        const payload = await callApi('/api/pipeline-continue', {
          sourceSessionId: resolvedSourceSessionId,
          dryRun,
          maxTracks,
          chunkSeconds,
          recoverStale: true,
          staleMinutes: STALE_RUNNING_MINUTES
        });
        if (preflightRecovery?.staleRecovery?.recovered?.length && !payload.staleRecovery) {
          payload.staleRecovery = preflightRecovery.staleRecovery;
        }
        lastPayload = payload;
        if (payload.jobs) window.state.jobs = payload.jobs;
        if (payload.sessions) window.state.sessions = payload.sessions;
        if (window.state?.ingest) {
          window.state.ingest = {
            ...window.state.ingest,
            busy: !dryRun && Boolean(payload.continueRecommended) && index < maxRuns - 1,
            phase: dryRun ? 'pipeline-dry-run' : 'pipeline-running',
            progress: Math.round(((index + 1) / maxRuns) * 100),
            error: null,
            lastJobResult: payload.jobResult || payload
          };
        }
        remember?.(payload.message || 'Pipeline Craig atualizado.', payload.jobResult?.summary || payload.snapshot || payload);
        render?.();
        if (dryRun || !payload.continueRecommended) break;
      }
      if (lastPayload?.continueRecommended) {
        toast?.('Pipeline pausado para proteger o tempo da Function. Clique em continuar de novo.');
      } else {
        toast?.(pipelineCompletionToast(lastPayload || preflightRecovery, dryRun));
      }
      await loadJobs?.(true);
      if (typeof loadSessions === 'function') await loadSessions(false);
      render?.();
      return lastPayload || preflightRecovery;
    } catch (error) {
      if (window.state?.ingest) {
        window.state.ingest = { ...window.state.ingest, busy: false, phase: null, error: error.message };
      }
      toast?.(error.message);
      remember?.(`Pipeline Craig falhou: ${error.message}`);
      render?.();
      return null;
    } finally {
      if (window.state?.ingest) {
        window.state.ingest = { ...window.state.ingest, busy: false };
      }
      if (typeof setBusy === 'function') setBusy(false);
      render?.();
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
  window.continuePipeline = continuePipeline;
  window.renderJobSteps = renderJobSteps;
  window.renderJobsList = renderJobsListWithActions;
  try { renderJobsList = renderJobsListWithActions; } catch (_error) {}
  try { render?.(); } catch (_error) {}
})();
