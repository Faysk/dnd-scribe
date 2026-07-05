# Full autopilot after Craig upload

## Decision

For production Craig uploads, confirming the ZIP upload is the operational
authorization to run the full automated pipeline within configured project
guardrails.

The normal path must not require:

- pressing `Continuar`;
- approving transcription in the middle of the pipeline;
- keeping the browser tab open;
- manually dispatching the next GitHub Actions batch.

Manual buttons remain only for recovery, inspection and exceptional operator
actions.

## Implementation

- `/api/uploads/craig-complete` already stores:
  - `pipeline_autopilot_approved=true`;
  - approved paid stages: `transcription`, `review_generation`.
- The same route now dispatches `pipeline-supervisor-worker.yml` with
  `approveAutopilotPaid=true`.
- The upload page no longer calls `continuePipeline` from the browser after the
  server confirms the upload. The browser monitors; the server orchestrates.
- Transcription batches now update `sessions.metadata.transcription` and
  `sessions.updated_at` after each execute run, so the UI can show fresh
  progress instead of looking frozen while batch processing continues.

## Expected Flow

1. Operator uploads a Craig ZIP.
2. Browser uploads the ZIP directly to R2.
3. Browser confirms upload with production API.
4. API creates the first cloud ingest job.
5. API dispatches the pipeline supervisor server-side.
6. Supervisor advances zero-cost stages.
7. Speech/transcription/review/cleanup workers self-chain through callbacks.
8. Daily cron remains as recovery if a callback is missed.

## Guardrails

Automation is allowed to stop only for real blockers:

- failed job;
- missing secret or provider outage;
- cost cap exceeded;
- absent source artifact;
- explicit operator pause/discard.

It should not stop merely because a browser was closed or because a workflow
batch completed while the current GitHub run was still marked active.

