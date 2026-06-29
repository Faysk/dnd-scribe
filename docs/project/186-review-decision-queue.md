# Review decision queue

Date: 2026-06-30
Status: implemented

## Goal

Make Review and Candidates start with a decision queue for the DM: what needs review, what is canon-related, what is still only a draft, and where AI output may need an explicit note.

## What changed

- Added `Fila do DM` to Review and Candidates.
- The queue summarizes:
  - open transcript segments
  - open AI candidates
  - local draft decisions
  - segments that need review
  - canon-related AI signals
  - quote and outtake candidates
  - candidates without source segment IDs
  - AI-important segments rejected/private without a note
- Added quick filters for:
  - review-needed segments
  - canon segment candidates
  - canon candidates
  - open candidates
  - applying saved drafts

## Safety

- No API change.
- No database change.
- No automatic canon decision.
- The DM still makes the final call; this only improves visibility and filtering.

## Why this matters

The project can collect a lot of material from audio, Roll20 and Discord. A DM-facing queue keeps review work from becoming a flat wall of cards, and makes it easier to see where a note is needed for auditability.

## Next recommendation

Add source drill-down from candidate cards back to the exact transcript/timeline segment, including audio playback at the source moment.
