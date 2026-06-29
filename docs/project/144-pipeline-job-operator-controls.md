# 144 - Pipeline job operator controls

Date: 2026-06-29

## Goal

Make individual production jobs operable from the site without terminal access.

The pipeline already showed retryable failures and high-level autopilot actions. The missing production control was a safe way to freeze, resume, or intentionally discard a job while keeping an audit trail.

## Backend

New protected endpoint:

```text
POST /api/jobs/control
```

Required permission:

```text
project.jobs.run
```

Supported actions:

- `pause`
- `resume`
- `discard`

Payload shape:

```json
{
  "campaignSlug": "yuhara-main",
  "jobId": "uuid",
  "action": "pause",
  "reason": "pause_requested_from_ui"
}
```

Discard is intentionally explicit:

```json
{
  "jobId": "uuid",
  "action": "discard",
  "confirm": "DISCARD_JOB"
}
```

## State model

`processing_jobs.status` does not support a native `blocked` state. To stay compatible with the current schema, operator control uses:

- paused job: `status=cancelled`, `output.operatorState=paused`
- resumed job: `status=retrying`, `output.operatorState=active`
- discarded job: `status=cancelled`, `output.operatorState=discarded`

This keeps the database constraint intact and avoids a migration during the production hardening pass.

## Audit trail

Every action appends metadata to `processing_jobs.output`:

- `operatorState`
- `operatorAction`
- `operatorActionAt`
- `operatorActionBy`
- `operatorActionReason`
- `operatorPreviousStatus`
- `workerStatus`
- `paidAiCostUsd=0`

Every action also writes a `processing_job_steps` row:

- `operator_pause`
- `operator_resume`
- `operator_discard`

Existing steps are updated so the UI can explain what happened:

- pause marks pending/retrying steps as `blocked`
- resume marks blocked/failed steps as `retrying`
- discard marks incomplete steps as `skipped` and non-retryable

## Safety rules

- Pause only accepts jobs in `queued` or `retrying`.
- Running jobs are not paused directly because a worker may already be active. Stale running jobs should use the existing recovery flow first.
- Resume only accepts jobs explicitly paused by the operator.
- Discard does not delete storage objects, transcript data, or audit evidence. It only removes the job from the active operational path.
- The old retry endpoint now refuses paused or discarded jobs. Paused jobs must be resumed; discarded jobs stay discarded unless future tooling adds a deliberate restore flow.

## UI

The job list now shows the operator state badge when present.

Per-job actions:

- `Pausar`: available for queued/retrying jobs.
- `Retomar`: available for paused jobs.
- `Descartar`: available for non-running, non-succeeded jobs that are not already discarded.
- `Tentar novamente`: hidden for paused/discarded jobs to prevent accidental reactivation.

The pipeline summary also recognizes paused/discarded jobs and changes the headline/badges accordingly.

## Verification

Local static validation:

```text
node --check api/[...path].js
node --check web/jobs.js
```

Full project checks should still run before deploy:

```text
npm run check:api
npm run check:web
npm run build
```

## Next steps

1. Add session-level discard/archive for a bad Craig upload, separate from job discard.
2. Add workflow run polling and links for GitHub Actions jobs.
3. Add Discord ops notifications when a job is paused, discarded, resumed, failed, or completed.
4. Add a production supervisor that can resume safe zero-cost steps when no operator intervention is required.
