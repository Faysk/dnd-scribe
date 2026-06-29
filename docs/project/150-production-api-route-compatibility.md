# 150 - Production API route compatibility

Date: 2026-06-29

## Goal

Keep older nested API paths working in production without adding more Vercel Functions.

The project uses `api/[...path].js` for many top-level API routes. In production, Vercel does not route nested paths such as `/api/jobs/retry` into that catch-all automatically. The UI now uses top-level canonical routes, but existing docs, manual tests or old browser tabs may still hit nested aliases.

## Rewrites

`vercel.json` now rewrites compatibility aliases:

```text
/api/jobs/retry -> /api/job-retry
/api/jobs/control -> /api/job-control
/api/jobs/pipeline-continue -> /api/pipeline-continue
/api/jobs/run-cloud-plan-chunks -> /api/run-cloud-plan-chunks
```

## Why rewrites instead of wrapper files

Wrapper files under `api/jobs/*` would create extra Vercel Functions. The project is already near the function-count limit, so rewrites preserve compatibility without increasing deploy surface.

## Verification

After deploy:

```text
POST /api/jobs/retry -> protected response, not 404
POST /api/jobs/control -> protected response, not 404
```
