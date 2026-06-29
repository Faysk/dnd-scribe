# Project-wide polish audit

Date: 2026-06-29

## Goal

Review every screen, flow and operational step as a product surface, then improve the project in controlled slices. The focus is production usability: clear status, safe actions, role-aware visibility, low-cost processing, auditable operations and a calm interface that can be used during a real DnD session without opening code.

## Reference baseline

- WAI-ARIA Authoring Practices tabs pattern: main app navigation should expose tab semantics, selected state and keyboard navigation.
- GOV.UK validation pattern: forms and ingest flows should explain what failed, preserve user input and guide the next action without forcing the operator to start over.
- Grafana dashboard practice: operational pages should lead with health, ownership, freshness and drill-down instead of raw ungrouped metrics.
- Azure RBAC model: permissions should be assigned through roles and scopes, not hard-coded to one current DM identity.
- Timeline tooling references already captured in `166-timeline-ux-reference-plan.md` and `175-timeline-reference-benchmark.md`: overlap, confidence, source provenance and media playback must stay visible together.

## Current screen inventory

- App shell and login gate: global access boundary, session rail, topbar, navigation tabs and music dock.
- Sessions: create/update session metadata and select the active source session.
- Upload: Craig ZIP ingest, R2 direct upload, pipeline status and production job handoff.
- Review: transcript/candidate review and DM decisions.
- Timeline: synchronized speech, Roll20, Discord, notes and audio references.
- Candidates: AI-derived canon/quote/outtake candidates.
- Roll20: parsed command review and ingestion preview.
- Publications: DM/player/publication outputs.
- Operation: production jobs, health, storage inventory, cost hints and operator actions.
- Monitoring: API, token, webhook and infrastructure status.
- Costs: OpenAI/R2/storage consumption and budget visibility.
- Access: account linking, player identity, role assignment and approval.
- Notes: DM/operator notes and working log.

## Quality rules for the next passes

- Every screen needs a primary next action and a visible current state.
- Every async process needs retry/continue/pause/discard semantics where applicable.
- Every destructive or paid action needs confirmation, estimate or dry-run mode.
- Every operational list needs freshness, source and owner.
- Every role-sensitive view must degrade safely when the viewer has limited permissions.
- Every major navigation surface must be keyboard reachable and screen-reader understandable.
- Timeline events must preserve timestamp, source, confidence and playback reference.

## First implementation slice

Applied an app-shell accessibility pass:

- Main navigation now uses `role="tablist"`, `role="tab"` and `role="tabpanel"`.
- Active tab state now updates `aria-selected`, `tabindex` and `aria-labelledby`.
- ArrowLeft/ArrowRight/Home/End keyboard navigation now works across top-level areas.
- Focus-visible styling was standardized for buttons, links, fields and the main view.

This is intentionally small and structural. It improves every screen without changing domain behavior, then gives the next screen-specific passes a cleaner base.

## Next ten polish slices

1. Upload: convert each Craig step into an action row with retry, continue, pause, discard and freshness.
2. Upload: add storage budget estimates before accepting large ZIPs and show what will be kept/deleted.
3. Operation: group health by critical, attention and healthy, with one-click drill-down.
4. Monitoring: expose token/webhook/API checks with last checked time and remediation text.
5. Costs: show session-level OpenAI/R2 estimates and cumulative budget trend.
6. Timeline: add source filters, density modes and per-source confidence legends.
7. Timeline: improve multi-speaker overlap readability and audio segment focus states.
8. Access: implement role assignment UX inspired by scoped RBAC, including current DM handoff.
9. Review/Candidates: add decision queues and conflict warnings when AI, Roll20 or DM notes disagree.
10. Roll20/Discord: harden ingestion visibility with source status, last event received and replay safety.

## Open production risks

- Real paid transcription still needs a deliberate production validation session.
- Roll20 bridge needs real table testing because Roll20 CSP blocks direct remote script injection; the Chrome extension route is the safer path.
- Discord message ingest depends on bot permissions, gateway/intents and channel coverage in the real server.
- Storage cleanup should remain conservative until at least one full session is processed end to end and verified.
