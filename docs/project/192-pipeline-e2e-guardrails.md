# Pipeline E2E Guardrails

## Why

The first production E2E pass proved the heavy zero-cost Craig path works, but it also showed operator risks:

- `cloud_detect_speech_slices` can be healthy while its job is `retrying`, because each GitHub Actions batch may process only part of the session.
- Large worker summaries can bloat `processing_jobs.output` and GitHub logs.
- The next operator needs one repeatable command to audit a session after upload, instead of reconstructing ad-hoc SQL.
- Roll20 and Discord timeline ingestion must stay visible as missing until tested with real session data.

## Changes

- `/api/pipeline-control` now includes `speechProgress`:
  - `totalChunks`;
  - `coveredChunks`;
  - `remainingChunks`;
  - `percent`;
  - `objects`;
  - `minutes`;
  - last worker batch summary when available.
- Pipeline state copy distinguishes:
  - first speech slicing run;
  - partial healthy speech slicing;
  - running speech worker;
  - actual failed jobs.
- The Jobs UI shows speech slicing progress as `X/Y chunks`, slice count and a progress bar.
- Speech action labels become `Continuar fala` when a batch is partial.
- New operator audit command:

```bash
npm run audit:session -- manual-2026-07-01-20260701-sessao-235100
```

## Audit Output

The audit command checks:

- session status;
- processing jobs and attempts;
- source audio minutes/chunks;
- speech slices and chunk coverage;
- pending transcription objects/minutes/cost estimate;
- audio artifacts and cleanup readiness;
- AI usage ledger;
- Roll20 event count;
- Discord interaction presence.

It exits non-zero in `--strict` mode when the evaluation is not clean:

```bash
npm run audit:session -- manual-2026-07-01-20260701-sessao-235100 --strict
```

Use non-strict mode during normal pipeline work because pending paid transcription, Roll20 or Discord may be expected at intermediate stages.

## Current Session Evidence

For `manual-2026-07-01-20260701-sessao-235100`:

- Craig/speech jobs are all `succeeded`;
- source audio: `705.006m`, `72` chunks;
- speech slicing: `306.476m`, `72/72` chunks, `654` slices;
- pending transcription: `624` objects, `294.394m`, estimated `$0.883182`;
- Roll20 events: `0`;
- Discord interactions in last 24h: `0`.

## Remaining Gate

The session is ready for paid transcription, but the correct next production move is still a controlled paid batch before running all candidates.
