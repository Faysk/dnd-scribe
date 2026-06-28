# 129 - Craig pipeline continuation orchestrator

## Context

The production Craig upload flow was already able to:

- upload the ZIP directly from the browser to R2;
- confirm the upload in Supabase;
- create and run `cloud_ingest_craig`;
- create and run `cloud_extract_craig_tracks`;
- create and run `cloud_plan_audio_chunks`.

The weak point was orchestration. After one step created the next job, the UI depended on an operator manually finding and running the next worker. A real session reached this state:

- source session: `craig-BIRq3nIWB4v9`;
- upload, manifest and track extraction had already succeeded;
- `cloud_plan_audio_chunks` stayed queued with `workerStatus=pending_worker_implementation`;
- Vercel logs did not show a runtime crash, which points to missing continuation rather than failed execution.

## Production fix

Add `/api/pipeline-continue` as the shallow, authenticated continuation endpoint for zero-cost Craig steps.

It requires `project.jobs.run` and supports:

- `sourceSessionId` to continue the next step for one session;
- `jobId` to execute a specific eligible job;
- `dryRun=true` to show the next step without changing data;
- `maxTracks` for bounded Craig track extraction per call;
- `chunkSeconds` for chunk planning.

The endpoint runs only one safe unit per request:

1. `cloud_ingest_craig`
2. `cloud_extract_craig_tracks`
3. `cloud_plan_audio_chunks`

After each unit it returns:

- `executedJob`;
- `jobResult`;
- `nextJob`;
- `blockedJob`;
- `continueRecommended`;
- updated `jobs` and `sessions`.

This keeps each Vercel function call short enough for large ZIPs and lets the browser loop a few calls when it is safe.

The old direct POST endpoints remain importable internally, but production POST access is disabled by default:

- `/api/jobs/run-cloud-ingest`
- `/api/jobs/run-cloud-extract`

They can only be re-enabled with `DND_ALLOW_LEGACY_JOB_ENDPOINTS=true`, which should stay off for normal production use.

## Intentional stop

The endpoint does not continue into transcription or paid AI.

When the next known job is `cloud_detect_speech_slices`, it reports a blocked/waiting state:

> Pipeline chegou na etapa de renderizar audio compacto e detectar fala. Esta etapa ainda precisa do worker cloud dedicado antes de transcrever.

That is intentional. The next production phase is the speech-slice worker, not OpenAI transcription.

## UI behavior

The upload workspace now has a `Pipeline` control with:

- next zero-cost step;
- session source id;
- `Faixas/vez` for bounded extraction;
- `Simular`;
- `Continuar`.

After a new ZIP upload is confirmed, the UI stays on the upload screen and automatically attempts bounded zero-cost continuation. If there is still work after the loop limit, it asks the operator to click `Continuar` again instead of leaving the session silent.

## Operational rule

If a future upload appears stuck:

1. open the Upload workspace;
2. check the Pipeline card;
3. click `Simular` to see the next step;
4. click `Continuar`;
5. if the card says worker de fala is pending, the ZIP pipeline is done for now and the next missing component is `cloud_detect_speech_slices`.

This is still OpenAI `$0` until a separate, explicit transcription step is implemented and enabled.
