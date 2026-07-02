# 148 - Production pipeline supervisor cron

Date: 2026-06-29

## Goal

Let production make bounded progress on Craig ingestion, speech slicing, transcription dispatch, review generation and cleanup without requiring an operator click every time.

The supervisor is protected by `CRON_SECRET` and follows a bounded autopilot policy. Zero-cost stages still run first; paid and destructive stages only run when their configured guardrails allow it.

## Endpoint

```text
GET /api/pipeline-supervisor
GET /api/cron/pipeline-supervisor
```

Authentication:

```text
Authorization: Bearer ${CRON_SECRET}
```

If `CRON_SECRET` is missing, the endpoint returns `503`. If the header is wrong or missing, it returns `401`.

## Vercel Cron

`vercel.json` now registers one daily production cron:

```json
{
  "path": "/api/pipeline-supervisor",
  "schedule": "15 4 * * *"
}
```

This is intentionally conservative because Vercel Hobby allows at most two cron jobs with a minimum daily interval. If the project is moved to Pro, the same endpoint can safely run hourly or every few minutes with low limits.

## What It Does

For non-archived sessions with runnable or pending Craig pipeline work, the supervisor:

1. recovers stale running zero-cost jobs through `recoverStaleJobs`;
2. selects the next queued/retrying job among:
   - `cloud_ingest_craig`
   - `cloud_extract_craig_tracks`
   - `cloud_plan_audio_chunks`
3. runs a small bounded number of zero-cost steps per invocation;
4. when no zero-cost step ran in that invocation, inspects the pipeline control state;
5. dispatches at most one workflow for the next safe stage:
   - `speech-slices-worker.yml`
   - `transcription-worker.yml`
   - `review-generation-worker.yml`
   - `storage-cleanup-worker.yml`
6. stops when a stage is running, failed, over budget, missing configuration, or already has an active/recent workflow dispatch.

Default limits:

- `maxSessions=4`
- `maxRuns=2` per session
- `maxTracks=1` per extraction run
- `chunkSeconds=600`
- `staleMinutes=20`
- `speechMaxChunks=12`
- `transcriptionLimit=50`
- `transcriptionApprovalUsd=1`
- `transcriptionSessionCapUsd=2`
- `reviewBatchSize=80`
- `reviewMaxBatches=1`
- `cleanupLimit=50`
- `activeWorkflowWindowMinutes=360`

Query overrides are supported for controlled testing:

```text
/api/pipeline-supervisor?dryRun=true&sourceSessionId=...&maxRuns=1
```

Useful safety toggles:

```text
paidEnabled=false
speechEnabled=false
reviewEnabled=false
cleanupEnabled=false
```

## Safety

- Dry-run never calls OpenAI, dispatches GitHub Actions or deletes R2.
- Real transcription dispatch is capped by batch and session cost.
- Cleanup dispatch only sends `confirm=DELETE_READY_R2` for objects already marked delete-ready.
- A workflow is not dispatched again if the same workflow for that session is active or was dispatched recently.
- No archived sessions.
- No unauthenticated access.
- Sends a Discord ops notification when real progress happened.

## Environment

`CRON_SECRET` was added to `.env.example` and configured in Vercel Production.

The real secret stays in `.env.local` and Vercel encrypted env vars; it is not committed.

## Verification

Before deploy:

```text
npm run check:api
npm run build
```

After deploy:

```text
GET /api/pipeline-supervisor -> 401 without Authorization
GET /api/pipeline-supervisor with Bearer CRON_SECRET and dryRun=true -> 200
```

## Next steps

1. Add a visible autopilot run history card to the upload/pipeline page.
2. Persist supervisor no-op decisions as lightweight audit jobs if daily automation needs a full paper trail.
3. Increase schedule only after confirming Vercel plan limits and runtime behavior in production.
