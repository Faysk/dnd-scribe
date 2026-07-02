# 197 - Pipeline supervisor autopilot

Date: 2026-07-02

## Goal

After a Craig ZIP upload is accepted, production should be able to keep moving the session pipeline without an operator watching code, logs or GitHub by hand.

The upload screen already estimates cost before the operator starts. From this point on, the supervisor may spend within policy limits.

## Endpoint

```text
GET /api/pipeline-supervisor
GET /api/cron/pipeline-supervisor
```

Required header:

```text
Authorization: Bearer ${CRON_SECRET}
```

`dryRun=true` keeps the full decision path visible without running jobs, dispatching workflows, calling OpenAI or deleting R2.

## Decision Order

For each selected non-archived session, the supervisor:

1. recovers stale running zero-cost jobs;
2. runs at most one zero-cost Craig job in this invocation:
   - `cloud_ingest_craig`
   - `cloud_extract_craig_tracks`
   - `cloud_plan_audio_chunks`
3. stops the current session if zero-cost work ran, so the next invocation re-reads fresh database state;
4. if no zero-cost work ran, reads `/api/pipeline-control` logic internally;
5. dispatches exactly one next-stage workflow when safe:
   - speech slicing
   - transcription
   - review generation/publication packet
   - storage cleanup

This keeps production autonomous without stacking multiple expensive or destructive actions in the same pass.

## Guardrails

- `CRON_SECRET` is mandatory.
- Failed jobs stop automation for that session.
- Running jobs stop automation for that session.
- Speech failed state stops automation instead of retrying forever.
- A workflow is not dispatched if the same workflow for that session is active or recently dispatched.
- Transcription uses both a per-batch cap and a per-session cap.
- Cleanup only dispatches the dedicated cleanup worker with `confirm=DELETE_READY_R2`.
- Dry-run never mutates state.

## Defaults

```text
maxSessions=4
maxRuns=2
maxTracks=1
chunkSeconds=600
staleMinutes=20
speechMaxChunks=12
speechMaxTracks=1
transcriptionLimit=50
transcriptionApprovalUsd=1
transcriptionSessionCapUsd=2
reviewBatchSize=80
reviewMaxBatches=1
cleanupLimit=50
activeWorkflowWindowMinutes=360
```

## Environment Overrides

```text
PIPELINE_AUTOPILOT_ENABLED
PIPELINE_AUTOPILOT_PAID_ENABLED
PIPELINE_AUTOPILOT_SPEECH_ENABLED
PIPELINE_AUTOPILOT_REVIEW_ENABLED
PIPELINE_AUTOPILOT_CLEANUP_ENABLED
PIPELINE_AUTOPILOT_MAX_SESSIONS
PIPELINE_AUTOPILOT_MAX_ZERO_COST_RUNS
PIPELINE_AUTOPILOT_MAX_TRACKS
PIPELINE_AUTOPILOT_CHUNK_SECONDS
PIPELINE_AUTOPILOT_STALE_MINUTES
PIPELINE_AUTOPILOT_SPEECH_MAX_CHUNKS
PIPELINE_AUTOPILOT_SPEECH_MAX_TRACKS
PIPELINE_AUTOPILOT_TRANSCRIPTION_LIMIT
PIPELINE_AUTOPILOT_TRANSCRIPTION_APPROVAL_USD
PIPELINE_AUTOPILOT_TRANSCRIPTION_SESSION_CAP_USD
PIPELINE_AUTOPILOT_REVIEW_BATCH_SIZE
PIPELINE_AUTOPILOT_REVIEW_MAX_BATCHES
PIPELINE_AUTOPILOT_CLEANUP_LIMIT
PIPELINE_AUTOPILOT_ACTIVE_WORKFLOW_WINDOW_MINUTES
```

`DND_` aliases are accepted for the paid and stage enablement flags where production naming already uses that convention.

## Operational Meaning

The supervisor is not a canon publisher. It only advances technical processing:

- upload ingestion;
- track extraction;
- chunk planning;
- speech slicing;
- transcription;
- AI review candidate generation;
- safe R2 cleanup.

DM approval and review decisions stay manual.

## Verification

Local syntax:

```text
npm run check:api
npm run check:monitoring
```

Production dry-run:

```text
GET /api/pipeline-supervisor?dryRun=true&sourceSessionId=<session>
Authorization: Bearer ${CRON_SECRET}
```

Production execution for one session:

```text
GET /api/pipeline-supervisor?sourceSessionId=<session>&maxSessions=1&maxRuns=1
Authorization: Bearer ${CRON_SECRET}
```

## Next Polish

1. Add a visible supervisor history card to the upload/pipeline screen.
2. Add per-session autopilot policy values beside the cost estimate.
3. Persist no-op supervisor decisions if we need full audit trails beyond workflow dispatch jobs.
