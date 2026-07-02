# 149 - Monitoring supervisor cron

Date: 2026-06-29

## Goal

Expose the production Craig supervisor in the technical monitoring center.

The cron endpoint is now part of the same admin visibility model as database, R2, Discord, Roll20 bridge, cleanup and jobs.

## Monitoring Additions

New environment group:

```text
cron-supervisor
```

It checks:

- `CRON_SECRET`
- `DND_CRON_SECRET`

New runtime check:

```text
pipeline-supervisor
```

Shallow mode:

- verifies a cron secret exists
- reports endpoint as configured

Deep mode:

- calls `/api/pipeline-supervisor?dryRun=true&maxSessions=1&maxRuns=1`
- sends `Authorization: Bearer ${CRON_SECRET}`
- expects `{ ok: true, mode: "pipeline_supervisor", dryRun: true }`
- reads the autopilot policy returned by the endpoint

## Readiness

Readiness now includes:

```text
Supervisor Craig
```

This makes the central admin panel show whether the automatic Craig pipeline supervisor is ready.

## Safety

The deep monitoring call uses `dryRun=true`, so it does not execute jobs, dispatch workers, call OpenAI or delete storage.
