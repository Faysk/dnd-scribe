# 130 - Pipeline polish and recovery plan

## What was improved now

The Craig job UI now gives a stronger operational view before the backend recovery pass:

- summarizes queued, retrying, running and failed Craig jobs;
- highlights jobs that have been running longer than 20 minutes;
- shows the next zero-cost step in one place;
- keeps `Simular proxima` and `Continuar pipeline` as the main controls;
- sends `recoverStale=true` and `staleMinutes=20` to `/api/pipeline-continue` so the client is ready for backend stale-job recovery;
- keeps the intentional stop at `cloud_detect_speech_slices` visible instead of looking like a silent failure.

## Remaining backend hardening

The next backend pass should add real recovery behavior inside `/api/pipeline-continue`:

1. Detect stale `running` jobs for the selected session.
2. Move stale zero-cost jobs back to `retrying` when they exceed the safe timeout window.
3. Write an audit marker to `processing_jobs.output`.
4. Add or update a `processing_job_steps` row named `stale_recovery`.
5. Re-select the next runnable job after recovery.
6. Return `staleRecovery.recovered[]` to the UI.

This must be done as a precise patch in `api/[...path].js`, not by replacing the whole API file through the GitHub contents API.

## Target behavior

A real stuck upload should resolve like this:

1. Operator opens Upload.
2. Pipeline panel shows whether the job is queued, running, failed, stale or waiting on speech detection.
3. Operator clicks `Simular proxima` for a no-write check.
4. Operator clicks `Continuar pipeline`.
5. Backend recovers stale `running` jobs if needed.
6. Backend executes one safe zero-cost unit.
7. UI receives updated jobs and sessions.
8. Pipeline either continues, asks for another click to protect Function duration, or clearly stops at `cloud_detect_speech_slices`.

## Cost rule

Everything in this stage remains OpenAI `$0`. The pipeline must not call transcription until the speech-slice worker and a separate explicit transcription control are implemented.
