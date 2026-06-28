# 135 - Production pipeline autopilot

Date: 2026-06-29

## Goal

Move the careful manual audio-ingestion procedure into the production product itself.

After a Craig ZIP upload, the site must be able to show what is ready, what is running, what failed, what costs money, what can be retried, and what can be safely cleaned up without requiring terminal access.

## Product contract

The upload and operations screens now share a production pipeline control panel.

It answers:

- current pipeline stage for the selected session
- running, failed, retriable and completed jobs
- missing prerequisites such as GitHub workflow dispatch token
- pending speech-slicing, transcription and cleanup work
- estimated transcription minutes and cost before paid work starts
- storage that is ready for safe cleanup
- next available actions for the operator

The panel is intentionally action-oriented. It does not replace the detailed job list; it sits above it as the "what should I do now?" layer.

## Backend

New protected routes:

```text
GET /api/pipeline-control?sourceSessionId=...
GET /api/pipeline/status?sourceSessionId=...
POST /api/pipeline-control
POST /api/pipeline/action
```

The routes require campaign access, and mutating actions require:

```text
project.jobs.run
```

The backend derives a single control snapshot from:

- `processing_jobs`
- `audio_chunk`
- `audio_speech_slice`
- `audio_transcript_segment`
- `ai_usage_ledger`
- `audio_storage_object`
- `audio_storage_cleanup_candidates`

## Actions

Supported actions:

- `inspect`: refreshes the pipeline snapshot
- `continue_zero_cost`: resumes manifest, track extraction and chunk planning
- `dispatch_speech_slices`: dispatches the GitHub speech-slicing worker
- `dispatch_transcription`: dispatches the GitHub transcription worker after cost approval
- `dispatch_storage_cleanup`: dispatches the GitHub cleanup worker after an explicit cleanup confirmation

Each action returns a fresh control snapshot and the recent jobs for the session.

## Worker model

Long-running or heavy work must not run inside the Vercel request lifecycle.

The site only orchestrates:

- validates permissions and prerequisites
- estimates cost or cleanup risk
- dispatches a GitHub Actions workflow
- records a dispatch job in `processing_jobs`
- refreshes the UI state

The actual workers remain in GitHub Actions:

```text
.github/workflows/speech-slices-worker.yml
.github/workflows/transcription-worker.yml
.github/workflows/storage-cleanup-worker.yml
```

This keeps production responsive and avoids Vercel timeouts while still making the process operable from the site.

## Required production env

Add this secret to Vercel when site-driven worker dispatch is enabled:

```text
GITHUB_WORKFLOW_TOKEN
```

The token must be scoped narrowly to this repository and allow workflow dispatch. The API also supports:

```text
GITHUB_WORKFLOW_REPOSITORY=Faysk/dnd-scribe
GITHUB_WORKFLOW_REF=main
```

If the token is missing, the UI keeps inspection and zero-cost local continuation available, but disables worker dispatch buttons and shows the missing prerequisite.

## Safety rules

- Transcription dispatch requires an approved cost ceiling.
- Cleanup dispatch requires the exact confirmation phrase `DELETE_READY_R2`.
- Cleanup candidates still come from the readiness view; the UI does not choose arbitrary files.
- Secret values are never returned to the browser.
- Dispatch records are written to `processing_jobs` for auditability.

## UX

The first UI version is available both in:

- the dedicated Craig upload workspace
- the operations page

It shows:

- stage badge
- concise status explanation
- pipeline metrics
- suggested actions
- action inputs such as limit, cost approval and cleanup confirmation
- detailed job state underneath

## Next steps

1. Add workflow run polling so the panel can show GitHub Actions run status and URL changes in near real time.
2. Add pause/resume intent rows so an operator can freeze automatic continuation for a session.
3. Add a discard/archive flow that marks a failed or unwanted upload without deleting evidence immediately.
4. Add a scheduled production supervisor that periodically resumes safe zero-cost steps.
5. Add Discord ops notifications for failed stages, completed transcription and cleanup completion.
6. Add per-stage retry buttons directly beside each failed job row.
7. Add a session-level incident timeline that combines uploads, jobs, workflow dispatches and cleanup.
8. Add storage budget warnings before upload when the ZIP size would exceed a configured threshold.
9. Add a compact "ready for DM review" final state after transcription and cleanup finish.
10. Add operator audit fields for who dispatched paid work and who confirmed cleanup.
