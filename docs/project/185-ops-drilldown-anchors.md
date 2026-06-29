# Ops drill-down anchors

Date: 2026-06-30
Status: implemented

## Goal

Make the Operation drill-down actionable, not only descriptive, by linking each summary row to the card that contains the matching evidence or controls.

## What changed

- Added scroll targets for:
  - local decision draft
  - Supabase summary
  - Roll20 events
  - storage inventory
  - automatic pipeline
  - production jobs
- Added `scrollOpsTarget(...)` as a small frontend helper.
- Drill-down rows now include a button that scrolls to the related card.
- Target cards receive a focus outline through `:target` so the operator sees where they landed.

## Safety

- No API change.
- No database change.
- No storage mutation.
- No cost.

## Next recommendation

Add the same anchor style to Monitoring details once the backend returns stable IDs for checks, envs and metrics.
