# Zero-cost worker queue check

Date: 2026-06-27

## Goal

After enabling Discord worker notifications, check whether there are safe zero-cost production jobs ready to run.

Only these job types were considered safe for automatic execution in this step:

- `cloud_ingest_craig`
- `cloud_extract_craig_tracks`

Both have `paidAiCostUsd: 0` in the current implementation.

## Result

Supabase queue check returned no eligible jobs:

```json
{
  "summary": [],
  "eligible": []
}
```

No worker was executed because there was nothing queued/retrying/running for the zero-cost Craig ingestion/extraction stages.

## Decision

Do not create artificial processing just to test notifications.

The next real Craig upload or queued extract job should exercise:

- Discord notification to `rec` on success/partial progress;
- Discord notification to `dnd-scribe-logs` on failure;
- processing job state updates in Supabase.

## Production state

The latest Vercel deployment for the current main branch is ready:

- commit `c94de3f`
- state `READY`
