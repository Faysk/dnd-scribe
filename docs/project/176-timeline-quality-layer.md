# Timeline quality layer

Date: 2026-06-29
Status: implemented

## Goal

Add a technical quality layer to the timeline so the operator can quickly see whether a session is ready for review or needs attention.

This came directly from the reference benchmark: before adding waveform or heavier editor features, the timeline should be clear about completeness and sync health.

## What changed

- Added a compact `Qualidade da timeline` panel below the overview.
- The panel shows:
  - session anchor state
  - visible speech count
  - audio track/file availability
  - Roll20/Discord event count
  - estimated phrase count
  - unsynced item count
  - dense cluster count
- The panel derives all signals from the existing timeline payload.

## Readiness labels

- `review pronta`: speech and audio are available, with no warning signals.
- `atenção`: at least one warning signal exists.
- `parcial`: useful data exists, but it is not enough to call the timeline review-ready.

## Why this is safe

- Frontend-only.
- No API change.
- No database change.
- No new dependency.
- No OpenAI or storage cost.

## Next recommendation

Use this quality layer during the next real session test. If it shows repeated `atenção`, the next work should focus on the failing signal rather than adding new visual features.
