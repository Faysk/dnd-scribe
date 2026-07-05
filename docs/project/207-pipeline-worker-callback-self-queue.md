# Pipeline worker callback self-queue

## Problem

During the 2026-07-05 production session, the Craig pipeline reached
transcription but did not keep advancing by itself after the first paid batches.

Observed production state:

- session: `manual-2026-07-05-20260705-sessao-000806`;
- status: `processing`;
- `cloud_ingest_craig`, `cloud_extract_craig_tracks`,
  `cloud_plan_audio_chunks` and `cloud_detect_speech_slices`: succeeded;
- transcription work units: 100 transcribed, 563 still pending;
- the last `Transcription Worker` runs succeeded and their
  `Continue pipeline supervisor` step also succeeded;
- no new `Pipeline Supervisor Worker` run was created after those callbacks.

## Root cause

Worker callbacks call `/api/pipeline-supervisor` before the current GitHub
Actions run is fully completed.

The supervisor checks recent workflow runs before dispatching the next worker.
For the same session and same workflow, the current run still appears active at
callback time. That made the supervisor skip dispatching the next batch with a
safe-but-wrong decision: "a worker is already active".

This is especially visible in batched stages:

- speech slicing can require many workflow batches;
- transcription can require many paid batches;
- review generation can require multiple batches;
- cleanup can require multiple delete batches.

## Fix

Worker callbacks now pass two pieces of context to the supervisor:

- `callbackWorkflow`;
- `callbackRunId`.

The supervisor ignores only that exact run while checking whether another run is
active. If no other active run exists, it can dispatch the next worker
immediately. GitHub Actions concurrency then queues the next run until the
current one exits.

This keeps duplicate protection for manual clicks and cron calls, while making
worker-to-worker chaining automatic.

## Files

- `.github/workflows/speech-slices-worker.yml`
- `.github/workflows/transcription-worker.yml`
- `.github/workflows/review-generation-worker.yml`
- `.github/workflows/storage-cleanup-worker.yml`
- `tools/trigger_pipeline_supervisor.py`
- `api/[...path].js`

## Acceptance

After any successful worker batch:

1. the callback calls production supervisor with the current `github.run_id`;
2. the supervisor ignores only that current run;
3. if the same stage still has pending work, the next workflow is dispatched;
4. if the stage is complete, the next stage is dispatched when eligible;
5. if cost limits, approval, config or a real failure blocks progress, the UI
   reports that blocker instead of silently stopping.

