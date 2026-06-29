# Upload operational readiness

Date: 2026-06-29
Status: implemented

## Goal

Make the Craig upload page easier to operate in production without reading code or guessing pipeline state.

The upload flow is one of the highest-risk parts of the project because large ZIP files touch storage, R2 operations, job orchestration, and later paid transcription. The page already had detailed steps; this pass adds a compact operational readiness layer above the form.

## What changed

- Added `Prontidao operacional` to the upload form.
- The panel shows:
  - file selected or waiting
  - size classification
  - Craig recording id detection
  - target/new session state
  - job success/total count
  - next recommended operation
  - OpenAI cost guard state
- Failed jobs surface as `atenção`.
- Queued/retrying jobs surface as `continuar`.
- The panel is frontend-only and reuses existing upload/job state.

## Why this matters

During a real session upload, the operator should know:

- whether it is safe to upload
- whether the ZIP is too large
- whether the pipeline is waiting for a manual continue
- whether a job failed
- whether OpenAI can be reached yet

This makes production operation calmer and reduces the chance of leaving a session stuck.

## Safety

- No API change.
- No database change.
- No storage mutation.
- No new cost.
- No new dependency.

## Next recommendation

Add the same style of operational summary to the monitoring/ops page, focusing on the current bottleneck and the most urgent action.
