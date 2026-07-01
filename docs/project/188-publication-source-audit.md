# Publication source audit

Date: 2026-06-30
Status: implemented

## Goal

Make the Publications page auditable by showing which outputs have source evidence and allowing the operator/DM to jump back to the exact transcript/audio source when possible.

## What changed

- Added an `Auditabilidade` panel above publications.
- The panel summarizes:
  - total publications
  - publications with source references
  - publications without direct source references
  - review-only publications
  - shareable/public-facing publications
  - draft publications
- Publication cards now parse `Fontes: \`...\`` references from the content and expose source rows.
- Each source row can open the source segment in Review and load audio when the segment exists in the current payload.
- Publications without direct sources show an audit warning.
- Added frontend `rebuildPublications(dryRun)` with simulation and confirmed rebuild actions.

## Safety

- Uses existing `/api/publications/rebuild`.
- Rebuild requires the same backend permissions already enforced by the API.
- The write action asks for confirmation.
- No automatic publication approval or canon decision.

## Why this matters

Final outputs should not be detached from evidence. The page now makes it clear which publications are traceable and which require manual audit before leaving the table context.

## Next recommendation

Improve the backend publication metadata so every generated publication stores structured candidate IDs and segment IDs instead of relying on source references embedded in text.
