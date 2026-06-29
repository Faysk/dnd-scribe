# Timeline timing confidence

Date: 2026-06-29
Status: implemented

## Goal

Make the timeline honest about timestamp precision. A phrase estimated inside a transcript segment should not look as precise as a full segment timestamp, and external events from Roll20/Discord should show that they are anchored to the session start.

## What changed

- Added a timing confidence classifier in the frontend.
- Added visible counts for timing confidence in the overview panel.
- Timeline blocks now receive timing classes:
  - `timing-exact`
  - `timing-estimated`
  - `timing-anchored`
  - `timing-unsynced`
  - `timing-outside`
- Estimated/outside/unsynced blocks use dashed visual treatment.
- Anchored events get a subtle bottom accent.
- Inspector now shows:
  - confidence badge
  - precision label
  - raw timing mode
  - short explanation of what the timestamp means

## Current classification

- `segment_exact`: exact transcript segment timing.
- `phrase_estimated_from_segment`: local phrase split inside a transcript segment.
- Missing start time or `unsynced`: item has no reliable session position.
- `before_session_start`: timestamp exists but falls before the session anchor.
- Roll20/Discord with a start time and no more specific mode: anchored from session start.

## Why this matters

This prevents the interface from implying false precision. The DM and technical admin can review the session while understanding which data is exact, estimated, anchored, or still needs sync work.

## Next recommended step

Add an audio review dock for the selected speech item:

- Keep the audio control near the timeline instead of only inside the inspector.
- Reuse lazy signed URLs.
- Preserve current no-cost behavior.
- Prepare for future waveform or region playback without requiring it yet.
