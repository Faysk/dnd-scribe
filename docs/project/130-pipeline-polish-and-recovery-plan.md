# 130 - Pipeline polish and recovery plan

## What was improved now

The Craig job UI now gives a stronger operational view and is wired to backend stale-job recovery:

- summarizes queued, retrying, running and failed Craig jobs;
- highlights jobs that have been running longer than 20 minutes;
- shows the next zero-cost step in one place;
- keeps `Simular proxima` and `Continuar pipeline` as the main controls;
- shows `Recuperar pipeline` when a zero-cost job is stale;
- calls `/api/pipeline-recover` before `/api/pipeline-continue` on real runs;
- keeps `recoverStale=true` and `staleMinutes=20` in `/api/pipeline-continue` payloads for compatibility;
- keeps the intentional stop at `cloud_detect_speech_slices` visible instead of looking like a silent failure.

## Backend recovery implemented

`/api/pipeline-recover` is a small authenticated production endpoint for stale zero-cost Craig jobs. To stay under the Vercel Hobby limit of 12 Serverless Functions, it is routed by `vercel.json` to the existing `/api/ai-cost?pipelineRecover=1` Function and implemented in `lib/pipeline-recovery.js`.

It requires:

- a valid Supabase Auth session from Discord or Google;
- `project.jobs.run` in RBAC, with owner/master fallback only when RBAC tables are not available;
- one of `sourceSessionId`, `jobId`, or `recoverAll=true`.

It only touches these job types:

- `cloud_ingest_craig`;
- `cloud_extract_craig_tracks`;
- `cloud_plan_audio_chunks`.

When a target job is `running` for more than the safe timeout window, it:

1. moves the job back to `retrying`;
2. clears stale `started_at`, `finished_at`, and `error` values;
3. writes `workerStatus=recovered_stale_running` into `processing_jobs.output`;
4. marks running/blocked job steps as `retrying`;
5. upserts a `processing_job_steps` row named `stale_recovery`;
6. returns `staleRecovery.recovered[]` to the UI.

## Target behavior

A real stuck upload should resolve like this:

1. Operator opens Upload or Jobs.
2. Pipeline panel shows whether the job is queued, running, failed, stale or waiting on speech detection.
3. Operator clicks `Simular proxima` for a no-write check.
4. Operator clicks `Continuar pipeline` or `Recuperar pipeline`.
5. Backend recovers stale `running` jobs if needed.
6. Backend executes one safe zero-cost unit.
7. UI receives updated jobs and sessions.
8. Pipeline either continues, asks for another click to protect Function duration, or clearly stops at `cloud_detect_speech_slices`.

## Current known stop

The current designed stop remains `cloud_detect_speech_slices`. That worker is the next production milestone before paid transcription. ZIP upload, manifest, track extraction and chunk planning stay OpenAI `$0`.

## Cost rule

Everything in this stage remains OpenAI `$0`. The pipeline must not call transcription until the speech-slice worker and a separate explicit transcription control are implemented.
