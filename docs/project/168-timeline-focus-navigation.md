# Timeline focus navigation

Date: 2026-06-29
Status: implemented

## Goal

Make timeline review faster in long sessions. After the overview and overlap stacking, the next UX problem is keeping the selected item easy to find while moving through speech, Roll20, and Discord events.

## What changed

- Added previous/next controls to the timeline toolbar.
- Navigation uses the current visible/filterable item list.
- Items are ordered by session time, then duration/source/id for stable movement.
- The active timeline block is marked with `aria-pressed`.
- The selected block scrolls into view after selection from:
  - overview density bins
  - lane blocks
  - transcript table
  - events table
  - previous/next controls

## Why this is safe

- No backend changes.
- No database changes.
- No paid OpenAI processing.
- No new dependency.
- Works on the existing timeline payload.

## UX notes

The toolbar now acts like a review console:

- Filter/search define the visible item set.
- Previous/next walks only that visible set.
- The count shows current position inside the visible set.
- The inspector remains the detailed readout for the selected item.

## Next recommended step

Add explicit timing confidence in the UI:

- Exact transcript segment.
- Locally estimated phrase.
- Roll20/Discord anchored by session start.
- Unsynced item.

This will help the DM and technical admin trust the timeline without pretending every timestamp has the same precision.
