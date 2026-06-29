# 148 - Production pipeline supervisor cron

Date: 2026-06-29

## Goal

Let production make bounded progress on safe Craig ingestion steps without requiring an operator click every time.

The supervisor only touches zero-cost pipeline stages and is protected by `CRON_SECRET`.

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

For non-archived sessions with runnable Craig jobs, the supervisor:

1. recovers stale running zero-cost jobs through `recoverStaleJobs`;
2. selects the next queued/retrying job among:
   - `cloud_ingest_craig`
   - `cloud_extract_craig_tracks`
   - `cloud_plan_audio_chunks`
3. runs a small bounded number of steps per invocation;
4. stops before speech slicing, transcription, review generation or cleanup dispatch.

Default limits:

- `maxSessions=4`
- `maxRuns=2` per session
- `maxTracks=1` per extraction run
- `chunkSeconds=600`
- `staleMinutes=20`

Query overrides are supported for controlled testing:

```text
/api/pipeline-supervisor?dryRun=true&sourceSessionId=...&maxRuns=1
```

## Safety

- No OpenAI call.
- No GitHub Actions dispatch.
- No R2 deletion.
- No archived sessions.
- No unauthenticated access.
- Sends a Discord ops notification only when real zero-cost progress happened.

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

1. Add the supervisor state to the monitoring page.
2. Persist supervisor runs as lightweight audit jobs if daily automation becomes important.
3. Increase schedule only after confirming Vercel plan limits and runtime behavior in production.
