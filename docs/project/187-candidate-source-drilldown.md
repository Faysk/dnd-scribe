# Candidate source drill-down

Date: 2026-06-30
Status: implemented

## Goal

Connect AI candidates back to their transcript evidence so the DM can review the exact source before accepting canon, quotes or backstage material.

## What changed

- Candidate cards now show source segment rows when `source_segment_ids` are available.
- Each source row includes:
  - timestamp and speaker/track
  - a short transcript preview
  - `Abrir` to jump back to Review
  - `Ouvir` to open the source segment and load its audio
- Candidates without source segment IDs now show an explicit audit warning.
- Added `openCandidateSource(segmentId, playAudio)` as a frontend helper.

## Safety

- No API change.
- No database change.
- No new storage access beyond the existing segment audio loader.
- No automatic canon decision.

## Why this matters

The DM should never have to trust an AI candidate as a floating claim. Every useful candidate should be traceable back to the transcript and, when possible, to the audio moment that generated it.

## Next recommendation

Add the same source drill-down from publications back to the candidates and segments that produced each output.
