# 202 - Timeline source readiness panel

Date: 2026-07-02
Status: implemented

## Goal

The timeline is the heart of the project, so it needs to show not only events,
but also whether the session sources are complete enough to trust.

This step adds a source panel above the main timeline lanes.

## Sources shown

The panel summarizes:

- Audio: phrase count and tracked recording files;
- Roll20: event count, latest event and unsynced count;
- Discord: message count, latest message and unsynced count;
- Sync: how many timeline items have a concrete offset and which session anchor
  is being used.

Each card gives an immediate operator hint:

- listen from the audio dock;
- use Roll20 bridge with direct DOM capture;
- sync Discord manually or rely on daily catch-up;
- confirm the real session start anchor.

## UX intent

The panel is intentionally compact. It should answer, before deep review:

- do we have audio?
- did Roll20 arrive?
- did Discord arrive?
- are the events anchored in the same session clock?

The existing lanes, overlap stacking, confidence layer, filters and audio dock
remain the detailed review tools.

## Future refinement

When the real table tests are complete, the panel can evolve into:

- per-source freshness badges;
- direct retry button for Discord catch-up scoped to the selected session;
- Roll20 bridge last heartbeat and queue status;
- warnings when speech exists but Roll20/Discord are absent for the same time
  window.
