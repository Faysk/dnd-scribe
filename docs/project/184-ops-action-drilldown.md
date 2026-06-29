# Ops action drill-down

Date: 2026-06-30
Status: implemented

## Goal

Make the Operation page answer the next operational question without requiring code/log inspection: what is the safest thing to do now, why, and what should not be done blindly?

## What changed

- Added `Proxima acao segura` below the existing operations summary.
- The panel prioritizes:
  - failed jobs
  - pipeline control errors
  - queued/retrying pipeline work
  - storage cleanup opportunities
  - local review decision drafts
  - stable/no-blocker state
- Each state shows:
  - recommended action
  - operational risk
  - focused buttons
  - status rows for failures, queue, running jobs, cleanup and draft decisions

## Safety

- No API change.
- No database change.
- No storage mutation.
- No paid provider call.
- Destructive cleanup is still only exposed through existing confirmed cleanup functions.

## Why this matters

The Ops page already had the raw cards. This pass adds an operator layer that turns those cards into a readable runbook: retry only when a job failed, continue pipeline only in the right session context, simulate cleanup before delete, and apply decisions only after review.

## Next recommendation

Add anchors from the drill-down rows to the exact card/row below, so clicking `Falhas`, `Fila`, `Limpeza` or `Rascunho` scrolls to the relevant detail.
