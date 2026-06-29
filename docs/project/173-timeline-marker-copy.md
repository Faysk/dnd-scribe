# Timeline marker copy

Date: 2026-06-29
Status: implemented

## Goal

Make it easy to reference a timeline moment outside the UI while reviewing a session. A marker should carry enough context for the DM, technical admin, or reviewer to understand what was selected.

## What changed

- Added `Copiar marcador` to the timeline inspector actions.
- Marker text includes:
  - session title/source id
  - session-relative time
  - timing confidence label
  - source kind
  - item title
  - lane id
  - selected text/event body

## Why this is useful

Markers can be pasted into Discord, notes, review comments, or future issue/canon workflows without needing a backend feature yet.

## Safety

- No backend change.
- No data mutation.
- No new dependency.
- No cost.

## Future improvement

Once URL routing supports timeline item ids, the marker can include a direct link to reopen the same session and selected item.
