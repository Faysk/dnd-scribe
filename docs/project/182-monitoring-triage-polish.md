# Monitoring triage polish

Date: 2026-06-29
Status: implemented

## Goal

Make the technical monitoring page start with a practical operator answer: what is critical, what needs attention, what is healthy, and what is the safest next action.

## What changed

- Added `Triagem tecnica` above the monitoring overview.
- The triage consolidates:
  - API checks
  - environment/token checks
  - metrics
  - readiness items
  - recommendations
- The panel counts critical, attention, healthy and untested items.
- The panel selects the most urgent focus item and derives a safe action:
  - env/token: check variables and expiry
  - storage/R2: audit storage and cleanup only with confirmation
  - jobs/pipeline: open Operation and use retry/pause/discard
  - Roll20/Discord: validate source ingestion and latest event
  - unknown: run deep verification
- Added direct actions for fast refresh, deep verification and Operation.

## Safety

- No API change.
- No database change.
- No storage mutation.
- No new dependency.
- No paid provider call.

## Why this matters

The monitoring page already had detailed diagnostics. During production operation, the first screen should answer "what should I care about now?" before showing the full detail list. This keeps incident response and session prep calmer.

## Next recommendation

Apply the same triage language to the Operation page cards, then connect monitoring focus items to their exact detail section anchors.
