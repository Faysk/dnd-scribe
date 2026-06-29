# Timeline overlap stacking

Date: 2026-06-29
Status: implemented

## Why this matters

DnD sessions regularly contain overlapping speech, quick reactions, dice rolls, Roll20 commands, and Discord messages in the same few seconds. A single flat lane hides that concurrency and makes the timeline feel less trustworthy.

This step makes each lane behave more like a real editor timeline: concurrent items are stacked inside the lane instead of being drawn on top of each other.

## What changed

- Each timeline lane now calculates internal rows from item start/end ranges.
- Items that overlap in time are moved to the next available row.
- Lane height grows based on the required row count.
- Lane metrics now count overlaps across all visible lane items, not only speech.
- The lane containing the selected item receives a stronger visual focus.

## Scope

This is a frontend-only change. It does not change:

- The timeline API payload.
- OpenAI usage or paid processing.
- Audio file handling.
- Roll20/Discord ingestion.

## Behavior

For every lane:

1. Items are sorted by start time, end time, then original order.
2. The renderer reuses the first internal row whose previous item has already ended.
3. If no row is free, a new row is created.
4. The visual track height is calculated from the number of rows.

This keeps dense moments readable while preserving the same session-relative timing.

## Known limits

- Overlap stacking is still lane-local. It does not yet show a global cross-speaker conflict band.
- Point events such as Roll20 and Discord messages still use a small visual width; dense clusters may need a future cluster popover.
- There is no waveform yet. The current view remains metadata/timeline based.

## Next recommended step

Add a selected-item focus loop:

- Keep the selected block visually centered when selected from the transcript, events table, or overview.
- Add keyboard navigation for previous/next timeline item.
- Add clearer confidence badges for exact timing versus estimated phrase timing.
