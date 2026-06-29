# Session operations timeline

Status: implemented in the production pipeline panel.

## Goal

When a Craig upload or worker stalls, the operator should not need to read raw job JSON first. The site should show a compact chronological story of what happened to the selected session.

## Data source

No new table was added in this step. The timeline is derived from the payload already returned by `/api/pipeline-control`:

- `processing_jobs.created_at`, `started_at`, `finished_at`;
- `processing_job_steps.startedAt`, `updatedAt`, `finishedAt`;
- workflow dispatch/run metadata from `workflowRuns`.

## UI behavior

The pipeline panel now renders a `Linha operacional` block after GitHub Actions. It merges recent events into one ordered list with status color:

- job created;
- job started;
- job step updated/finished;
- GitHub workflow requested/running/finalized;
- job finalized or failed.

The detailed job rows remain below the panel. The operational line is only a fast diagnosis layer, not a replacement for full details.

## Why this matters

This is the first step toward a production incident view per session. It makes stuck uploads, retries, workflow runs and operator actions easier to understand from the site before opening logs or database rows.
