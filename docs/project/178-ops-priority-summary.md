# Ops priority summary

Date: 2026-06-29
Status: implemented

## Goal

Make the production Ops page show the most important operational signal first.

During the audit, one important issue was found: `storage-inventory.js` overrides the base `renderOps` and the final Ops page no longer included the automatic pipeline card from `web/app.js`. This pass restores that card and adds a prioritized operations summary.

## What changed

- Added `Resumo operacional` as the first card in Ops.
- The summary prioritizes:
  - failed jobs
  - pipeline load errors
  - queued/retrying jobs
  - delete-ready storage
  - unapplied local decisions
  - stable state
- The summary shows compact signals:
  - priority
  - jobs
  - pipeline stage
  - storage status
  - safely releasable storage
- Restored `Esteira automatica` to the final Ops page rendered by `storage-inventory.js`.

## Why this matters

Ops is supposed to let the technical admin operate production without reading code. The first visible thing should answer:

- What needs attention now?
- Are jobs failing?
- Is the pipeline loaded?
- Is storage healthy?
- Is there cleanup or local review work waiting?

## Safety

- Frontend-only.
- No API change.
- No database change.
- No job execution change.
- No storage mutation.

## Next recommendation

After a real session upload, compare this summary against the actual bottleneck. If the priority is wrong, adjust the priority order rather than adding more cards.
