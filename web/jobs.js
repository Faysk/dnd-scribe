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

  function operatorState(job) {
    return job?.output?.operatorState || '';
  }

  function isPausedJob(job) {
    return job?.status === 'cancelled' && operatorState(job) === 'paused';
  }

  function isDiscardedJob(job) {
    return operatorState(job) === 'discarded';
  }

  function canRetry(job) {
    if (!job || !['failed', 'cancelled'].includes(job.status)) return false;
    if (isPausedJob(job) || isDiscardedJob(job)) return false;
    const steps = job.steps || [];
    if (!steps.length) return true;
    return steps.some(step => step.retryable !== false && ['failed', 'blocked'].includes(step.status));
  }

  function canPauseJob(job) {
    return Boolean(job) && ['queued', 'retrying'].includes(job.status) && !isDiscardedJob(job);
  }

  function canResumeJob(job) {
    return isPausedJob(job);
  }

  function canDiscardJob(job) {
    return Boolean(job) && !['running', 'succeeded'].includes(job.status) && !isDiscardedJob(job);
  }

  function jobOperatorControls(job) {
    const buttons = [];
    if (canPauseJob(job)) buttons.push(`<button onclick="controlCloudJob('${esc(job.id)}', 'pause')">Pausar</button>`);
    if (canResumeJob(job)) buttons.push(`<button class="primary" onclick="controlCloudJob('${esc(job.id)}', 'resume')">Retomar</button>`);
    if (canDiscardJob(job)) buttons.push(`<button class="danger" onclick="controlCloudJob('${esc(job.id)}', 'discard')">Descartar</button>`);
    return buttons.join('');
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
    const paused = relevant.find(isPausedJob);
    const discarded = relevant.filter(isDiscardedJob);
    const failed = relevant.filter(job => job.status === 'failed');
    const counts = relevant.reduce((summary, job) => {
      const status = job.status || 'unknown';
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    }, {});
    return { relevant, next, running, stale, blocked, paused, discarded, failed, counts };
  }

  function pipelineTitle(status) {
    if (status.paused) return `Pipeline pausado: ${status.paused.type}`;
    if (status.next) return `Proxima etapa: ${status.next.type}`;
    if (status.stale) return `Possivel timeout: ${status.stale.type}`;
    if (status.running) return `Rodando: ${status.running.type}`;
    if (status.failed.length) return `${status.failed.length} job(s) com falha`;
    if (status.blocked) return 'Aguardando worker de fala';
    return 'Sem etapa zero-cost pendente';
  }

  function pipelineDetail(status, sourceSessionId) {
    if (status.paused) return 'Retome o job pausado quando quiser continuar a esteira desta sessao.';
    if (status.next) return `${sourceSessionId || status.next.session?.sourceSessionId || 'sessao'} pronta para continuar sem OpenAI paga.`;
    if (status.stale) return `Rodando ha ${jobAgeMinutes(status.stale)} min. Use Recuperar pipeline para voltar o job para retry e continuar com auditoria.`;
    if (status.running) return `Rodando ha ${jobAgeMinutes(status.running) ?? '-'} min. Atualize antes de disparar outra etapa.`;
    if (status.failed.length) return 'Use Tentar novamente no job falho antes de continuar a esteira.';
    if (status.blocked) return 'ZIP, manifest, extracao e chunks chegaram ao limite atual; falta o worker cloud de fala.';
    if (status.discarded.length) return `${status.discarded.length} job(s) descartado(s) por decisao operacional.`;
    return sourceSessionId || 'Selecione uma sessao para inspecionar a esteira.';
  }

  function pipelineBadges(status) {
    const badges = [];
    if (status.counts.queued) badges.push(chip(`${status.counts.queued} fila`, 'gold'));
    if (status.counts.retrying) badges.push(chip(`${status.counts.retrying} retry`, 'orange'));
    if (status.counts.running) badges.push(chip(`${status.counts.running} rodando`, 'orange'));
    if (status.paused) badges.push(chip('pausado', 'orange'));
    if (status.discarded.length) badges.push(chip(`${status.discarded.length} descartado`, 'red'));
    if (status.failed.length) badges.push(chip(`${status.failed.length} falha`, 'red'));
    if (status.stale) badges.push(chip(`>${STALE_RUNNING_MINUTES} min`, 'red'));
    if (status.blocked && !status.next) badges.push(chip('fala pendente', 'blue'));
    if (!badges.length) badges.push(chip('OpenAI $0', 'green'));
    return badges.join('');
  }

  function stageTone(stage = '', fallback = '') {
    if (fallback) return fallback;
    if (stage.includes('failed') || stage.includes('attention')) return 'red';
    if (stage.includes('running')) return 'orange';
    if (stage.includes('ready')) return 'blue';
    return 'green';
  }

  function pipelineMetric(label, value, tone = '') {
    return `
      <div class="pipeline-metric ${esc(tone)}">
        <span class="label">${esc(label)}</span>
        <strong>${esc(value)}</strong>
      </div>
    `;
  }

  function renderPipelineControl(variant = 'ops') {
    const control = window.state?.pipelineControl || null;
    const sourceSessionId = selectedPipelineSourceSessionId();
    if (window.state?.pipelineControlLoading) {
      return `
        <div class="autopilot-panel">
          <div class="loader-line"></div>
          <strong>Atualizando esteira...</strong>
        </div>
      `;
    }
    if (window.state?.pipelineControlError) {
      return `
        <div class="autopilot-panel error">
          <div>
            <span class="label">Esteira automatica</span>
            <strong>Falha ao carregar</strong>
            <small>${esc(window.state.pipelineControlError)}</small>
          </div>
          <button onclick="refreshPipelineControl(true)">Tentar de novo</button>
        </div>
      `;
    }
    if (!control || control.sourceSessionId !== sourceSessionId) {
      return `
        <div class="autopilot-panel muted">
          <div>
            <span class="label">Esteira automatica</span>
            <strong>${esc(sourceSessionId || 'Selecione uma sessao')}</strong>
            <small>Carrega upload, jobs, speech slicing, transcricao, custo e cleanup em uma visao unica.</small>
          </div>
          <button onclick="refreshPipelineControl(true)" ${sourceSessionId ? '' : 'disabled'}>Carregar</button>
        </div>
      `;
    }
    const metrics = control.metrics || {};
    const work = metrics.workUnits || {};
    const limited = metrics.limitedTranscription || {};
    const cleanup = metrics.cleanup || {};
    const storage = metrics.storage || {};
    const ledger = metrics.ledger || {};
    const segments = metrics.segments || {};
    const review = metrics.reviewGeneration || {};
    const github = control.workflowDispatch || {};
    const actions = control.actions || [];
    const reviewCandidateTotal = Number(review.canon_candidates || 0) + Number(review.quote_candidates || 0) + Number(review.outtake_candidates || 0);
    return `
      <div class="autopilot-panel ${esc(stageTone(control.stage, control.tone))}">
        <div class="autopilot-head">
          <div>
            <span class="label">Esteira automatica</span>
            <strong>${esc(control.title || 'Pipeline Craig')}</strong>
            <small>${esc(control.detail || control.sourceSessionId)}</small>
          </div>
          <div class="badges">
            ${chip(control.stage || 'pipeline', stageTone(control.stage, control.tone))}
            ${chip(github.configured ? 'GitHub Actions ok' : 'GitHub token faltando', github.configured ? 'green' : 'red')}
            ${chip(control.sourceSessionId || '-', 'gold')}
          </div>
        </div>
        <div class="pipeline-metrics">
          ${pipelineMetric('transcrever', `${Number(work.total_candidates || 0)} un`, Number(work.total_candidates || 0) ? 'gold' : 'green')}
          ${pipelineMetric('lote atual', `${Number(limited.billable_minutes || 0).toFixed(3)} min`, Number(limited.billable_minutes || 0) ? 'blue' : 'green')}
          ${pipelineMetric('custo lote', `$${Number(control.estimatedBatchCostUsd || 0).toFixed(6)}`, Number(control.estimatedBatchCostUsd || 0) ? 'gold' : 'green')}
          ${pipelineMetric('custo sessao', `$${Number(ledger.cost || 0).toFixed(6)}`, 'blue')}
          ${pipelineMetric('review IA', `${Number(segments.classified || 0)}/${Number(segments.non_empty || segments.segments || 0)}`, Number(segments.pending_review || 0) ? 'gold' : 'green')}
          ${pipelineMetric('candidatos', `${reviewCandidateTotal} un`, reviewCandidateTotal ? 'blue' : '')}
          ${pipelineMetric('limpavel', formatBytes(cleanup.delete_ready_bytes || 0), Number(cleanup.delete_ready_bytes || 0) ? 'green' : '')}
          ${pipelineMetric('ativo R2', formatBytes(storage.active_bytes || 0), 'blue')}
        </div>
        ${renderPipelineActionBar(actions, variant, github.configured)}
        ${renderPipelineControlDetail(control)}
      </div>
    `;
  }

  function renderPipelineControlDetail(control) {
    const byTrack = control.metrics?.limitedByTrack || [];
    if (!byTrack.length && !control.workflowDispatch?.missingEnv) return '';
    return `
      <div class="autopilot-detail">
        ${control.workflowDispatch?.missingEnv ? `<p>Para disparar workers pelo site, configure ${esc(control.workflowDispatch.missingEnv)} na Vercel. Enquanto isso, o painel continua monitorando e as etapas locais zero-cost seguem funcionando.</p>` : ''}
        ${byTrack.length ? `
          <div class="badges">
            ${byTrack.map(item => chip(`${item.track_key || 'track'} ${Number(item.minutes || 0).toFixed(2)}m`, 'blue')).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderPipelineActionBar(actions, variant, githubConfigured) {
    if (!actions.length) {
      return `
        <div class="job-actions">
          <button onclick="refreshPipelineControl(true)">Atualizar</button>
          <button onclick="loadJobs(true)">Atualizar jobs</button>
        </div>
      `;
    }
    const needsGithub = new Set(['dispatch_speech_slices', 'dispatch_transcription', 'dispatch_review_generation', 'dispatch_storage_cleanup']);
    return `
      <div class="autopilot-actions">
        ${renderPipelineInputs(variant)}
        <div class="job-actions">
          ${actions.map(item => `
            <button class="${esc(item.tone || '')}" onclick="runPipelineControlActionById('${esc(item.id)}', '${esc(variant)}')" ${needsGithub.has(item.action) && !githubConfigured ? 'disabled' : ''}>${esc(item.label)}</button>
          `).join('')}
          <button onclick="refreshPipelineControl(true)">Atualizar</button>
        </div>
      </div>
    `;
  }

  function renderPipelineInputs(variant) {
    return `
      <div class="autopilot-inputs">
        <label class="inline-job-limit"><span class="label">Faixas</span><input id="pipelineSpeechTracks_${esc(variant)}" type="number" min="1" max="4" value="1" /></label>
        <label class="inline-job-limit"><span class="label">Chunks fala</span><input id="pipelineSpeechChunks_${esc(variant)}" type="number" min="1" max="80" value="12" /></label>
        <label class="inline-job-limit"><span class="label">Transcr.</span><input id="pipelineTranscriptionLimit_${esc(variant)}" type="number" min="1" max="100" value="50" /></label>
        <label class="inline-job-limit"><span class="label">Teto $</span><input id="pipelineApproveCost_${esc(variant)}" type="number" min="0" max="10" step="0.001" value="0.08" /></label>
        <label class="inline-job-limit"><span class="label">Review seg</span><input id="pipelineReviewBatchSize_${esc(variant)}" type="number" min="1" max="200" value="80" /></label>
        <label class="inline-job-limit"><span class="label">Review lotes</span><input id="pipelineReviewMaxBatches_${esc(variant)}" type="number" min="1" max="20" value="1" /></label>
        <label class="inline-job-limit"><span class="label">Cleanup</span><input id="pipelineCleanupLimit_${esc(variant)}" type="number" min="1" max="100" value="50" /></label>
      </div>
    `;
  }

  function jobActionControls(job) {
    const endpoint = jobEndpoint(job);
    const retryButton = canRetry(job)
      ? `<button class="primary" onclick="retryCloudJob('${esc(job.id)}')">Tentar novamente</button>`
      : '';
    const operatorButtons = jobOperatorControls(job);
    if (!endpoint) {
      const next = job.output?.nextAction || job.output?.workerStatus || '';
      const buttons = `${retryButton}${operatorButtons}`;
      return `${next ? `<p>${esc(next)}</p>` : ''}${buttons ? `<div class="job-actions">${buttons}</div>` : ''}`;
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
        ${operatorButtons}
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
    const state = operatorState(job);
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
            ${state ? chip(state, state === 'discarded' ? 'red' : state === 'paused' ? 'orange' : 'blue') : ''}
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

  async function refreshPipelineControl(showToast = false) {
    const sourceSessionId = selectedPipelineSourceSessionId();
    if (!sourceSessionId) {
      if (window.state) {
        window.state.pipelineControl = null;
        window.state.pipelineControlError = null;
      }
      if (showToast) toast?.('Selecione uma sessao para carregar a esteira.');
      render?.();
      return null;
    }
    try {
      if (window.state) {
        window.state.pipelineControlLoading = true;
        window.state.pipelineControlError = null;
      }
      render?.();
      const payload = await api(`/api/pipeline-control?sourceSessionId=${encodeURIComponent(sourceSessionId)}`);
      if (window.state) {
        window.state.pipelineControl = payload;
        window.state.pipelineControlError = null;
      }
      if (showToast) toast?.('Esteira atualizada.');
      return payload;
    } catch (error) {
      if (window.state) window.state.pipelineControlError = error.message;
      if (showToast) toast?.(error.message);
      return null;
    } finally {
      if (window.state) window.state.pipelineControlLoading = false;
      render?.();
    }
  }

  function numberInput(id, fallback) {
    const value = Number(document.getElementById(id)?.value || fallback);
    return Number.isFinite(value) ? value : fallback;
  }

  function pipelineActionOptions(action, item, variant) {
    const options = { ...item };
    if (action === 'dispatch_speech_slices') {
      options.maxTracks = numberInput(`pipelineSpeechTracks_${variant}`, 1);
      options.maxChunks = numberInput(`pipelineSpeechChunks_${variant}`, 12);
    }
    if (action === 'dispatch_transcription') {
      options.limit = numberInput(`pipelineTranscriptionLimit_${variant}`, 50);
      options.approveCostUsd = numberInput(`pipelineApproveCost_${variant}`, 0.08);
      options.maxEstimatedCostUsd = options.approveCostUsd;
    }
    if (action === 'dispatch_review_generation') {
      options.batchSize = numberInput(`pipelineReviewBatchSize_${variant}`, 80);
      options.maxBatches = numberInput(`pipelineReviewMaxBatches_${variant}`, 1);
      const pendingReview = Number(window.state?.pipelineControl?.metrics?.segments?.pending_review || options.selectedReviewSegments || 0);
      options.selectedReviewSegments = Math.min(pendingReview || options.batchSize * options.maxBatches, options.batchSize * options.maxBatches);
      if (options.execute) options.confirm = 'RUN_REVIEW_AI';
    }
    if (action === 'dispatch_storage_cleanup') {
      options.limit = numberInput(`pipelineCleanupLimit_${variant}`, 50);
      if (options.execute) options.confirm = 'DELETE_READY_R2';
    }
    return options;
  }

  function confirmPipelineAction(action, options) {
    if (action === 'continue_zero_cost' && !options.dryRun) {
      return window.confirm('Continuar a proxima etapa zero-cost em producao?');
    }
    if (action === 'dispatch_speech_slices' && options.write) {
      return window.confirm('Disparar GitHub Actions para gerar Opus compacto e speech slices no R2?');
    }
    if (action === 'dispatch_transcription' && options.execute) {
      const estimate = Number(options.estimatedCostUsd || 0).toFixed(6);
      const cap = Number(options.approveCostUsd || 0).toFixed(6);
      return window.confirm(`Disparar transcricao paga deste lote? Estimado US$ ${estimate}, teto aprovado US$ ${cap}.`);
    }
    if (action === 'dispatch_review_generation' && options.execute) {
      const selected = Number(options.selectedReviewSegments || options.batchSize || 0);
      return window.confirm(`Gerar classificacoes e candidatos com OpenAI para ate ${selected} segmento(s) neste run?`);
    }
    if (action === 'dispatch_storage_cleanup' && options.execute) {
      return window.confirm('Apagar do R2 apenas objetos marcados delete_ready para esta sessao?');
    }
    return true;
  }

  async function runPipelineControlActionById(actionId, variant = 'ops') {
    const item = (window.state?.pipelineControl?.actions || []).find(action => action.id === actionId);
    if (!item) {
      toast?.('Acao de esteira indisponivel. Atualize a tela.');
      return null;
    }
    return runPipelineControlAction(item.action, item, variant);
  }

  async function runPipelineControlAction(action, item = {}, variant = 'ops') {
    const sourceSessionId = selectedPipelineSourceSessionId();
    const options = pipelineActionOptions(action, item, variant);
    if (!sourceSessionId) {
      toast?.('Selecione uma sessao.');
      return null;
    }
    if (!confirmPipelineAction(action, options)) return null;
    try {
      if (typeof setBusy === 'function') setBusy(true);
      const payload = await callApi('/api/pipeline-control', {
        ...options,
        action,
        sourceSessionId
      });
      if (payload.pipeline && window.state) window.state.pipelineControl = payload.pipeline;
      if (payload.jobs && window.state) window.state.jobs = payload.jobs;
      if (payload.sessions && window.state) window.state.sessions = payload.sessions;
      const dispatched = payload.dispatch?.run?.id ? ` run ${payload.dispatch.run.id}` : '';
      remember?.(`Esteira: ${action}${payload.dispatched ? dispatched || ' disparado' : ' atualizado'}.`, payload);
      toast?.(payload.message || (payload.dispatched ? 'Worker disparado.' : 'Esteira atualizada.'));
      await loadJobs?.(true);
      window.setTimeout(() => {
        loadJobs?.(true);
        refreshPipelineControl(false);
      }, payload.dispatched ? 8000 : 2500);
      render?.();
      return payload;
    } catch (error) {
      toast?.(error.message);
      remember?.(`Esteira falhou: ${error.message}`);
      return null;
    } finally {
      if (typeof setBusy === 'function') setBusy(false);
    }
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
      const payload = await callApi('/api/job-retry', { jobId, reason });
      if (payload.jobs) window.state.jobs = payload.jobs;
      remember?.('Job reenfileirado para retry.', { jobId, reason });
      toast?.('Job reenfileirado.');
      await loadJobs?.(true);
      await refreshPipelineControl(false);
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

  async function controlCloudJob(jobId, action) {
    const labels = {
      pause: 'Pausar este job e impedir que ele continue automaticamente?',
      resume: 'Retomar este job pausado e voltar para retry?',
      discard: 'Descartar este job sem apagar evidencias? Ele sairá da fila operacional.'
    };
    if (!labels[action]) {
      toast?.('Acao de job indisponivel.');
      return null;
    }
    if (!window.confirm(labels[action])) return null;
    const body = { jobId, action, reason: `${action}_requested_from_ui` };
    if (action === 'discard') body.confirm = 'DISCARD_JOB';
    try {
      if (typeof setBusy === 'function') setBusy(true);
      const payload = await callApi('/api/job-control', body);
      if (payload.jobs) window.state.jobs = payload.jobs;
      if (payload.sessions) window.state.sessions = payload.sessions;
      remember?.(`Job ${action}.`, { jobId, action, status: payload.status, operatorState: payload.operatorState });
      toast?.({ pause: 'Job pausado.', resume: 'Job retomado.', discard: 'Job descartado.' }[action]);
      await loadJobs?.(true);
      await refreshPipelineControl(false);
      render?.();
      return payload;
    } catch (error) {
      toast?.(error.message);
      remember?.(`Controle de job falhou: ${error.message}`);
      return null;
    } finally {
      if (typeof setBusy === 'function') setBusy(false);
    }
  }

  window.runCloudJob = runCloudJob;
  window.retryCloudJob = retryCloudJob;
  window.controlCloudJob = controlCloudJob;
  window.continuePipeline = continuePipeline;
  window.refreshPipelineControl = refreshPipelineControl;
  window.runPipelineControlAction = runPipelineControlAction;
  window.runPipelineControlActionById = runPipelineControlActionById;
  window.renderPipelineControl = renderPipelineControl;
  window.renderJobSteps = renderJobSteps;
  window.renderJobsList = renderJobsListWithActions;
  try { renderJobsList = renderJobsListWithActions; } catch (_error) {}
  try { render?.(); } catch (_error) {}
})();
