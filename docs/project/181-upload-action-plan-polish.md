# Upload action plan polish

Date: 2026-06-29
Status: implemented

## Goal

Make the Craig upload screen easier to operate during production use, especially when a large ZIP is selected and the operator needs to know the next safe action without reading logs or code.

## What changed

- Added a `Proxima acao` panel to the upload form.
- The panel summarizes:
  - current action recommendation
  - target session
  - raw storage size
  - current OpenAI cost state
  - relevant buttons for upload, simulate, continue, retry and refresh
- Expanded each ingest step with:
  - operational action
  - project impact
  - current state badge
- Preserved selected form values when choosing a ZIP, so selecting a file does not wipe target session or metadata choices.
- Preserved the browser `File` reference in state so the page can re-render while still allowing the selected ZIP to be uploaded.
- Added mobile layout support for the new action metrics.

## Safety

- No API change.
- No database change.
- No storage mutation.
- No new dependency.
- No OpenAI call.
- File preservation is browser-session only; it is not persisted or uploaded until the operator clicks upload.

## Why this matters

Craig ZIPs can be hundreds of MB. The operator needs to see whether the safe next step is upload, retry, continue, wait, or stop. This pass turns the upload page into a practical control surface instead of only a form plus job list.

## Test notes

Automated static checks cover syntax. Real validation still needs a production upload because browser file selection, R2 CORS, presigned PUT and job continuation must be tested together with an actual Craig ZIP.

## Next recommendation

Add the same "next safe action" treatment to the Operation and Monitoring pages, with critical/attention/healthy grouping and direct drill-down.
