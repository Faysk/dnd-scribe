# Timeline UX reference plan

Date: 2026-06-29
Status: planned and started

## Goal

Turn the session timeline into the main workbench for reviewing a DnD session: speech, audio, Roll20 events, Discord messages, dice rolls, images, and future canon/review actions must be visible in one synchronized place.

This is intentionally a product stage, not a small widget. The timeline needs to be readable during long sessions, trustworthy when timing is estimated, and useful before all integrations are perfect.

## Reference notes

Primary references used for this pass:

- wavesurfer.js docs: waveform rendering, timeline/minimap/regions concepts for dense audio navigation. Reference: https://wavesurfer.xyz/docs/
- ELAN: multi-tier annotation model for audio/video, useful for thinking in lanes rather than one flat transcript. Reference: https://archive.mpi.nl/tla/elan
- oTranscribe: lightweight transcription UX with audio controls close to text review. Reference: https://otranscribe.com/
- Audino: open-source audio annotation project, useful as a practical reference for labeled spans and review-oriented datasets. Reference: https://github.com/midas-research/audino

Takeaways for this project:

- Use a session overview strip for navigation before detailed lanes.
- Keep independent lanes for each speaker and external source.
- Make timing confidence visible. Exact segment timing and estimated phrase timing are not the same thing.
- Keep the selected item in a stable inspector, with audio available on demand.
- Avoid generating new OpenAI cost for UI-only refinements. Phrase-level estimates should be local unless a paid alignment step is explicitly approved.
- Support overlap naturally. DnD sessions often have cross-talk, reactions, rolls, and chat messages at the same second.

## Timeline data model

Current production payload already has the right base:

- `items`: speech phrases, Roll20 events, Discord events.
- `lanes`: participant lanes and event lanes.
- `startMs`, `endMs`, `durationMs`: relative timing inside the session.
- `timingMode`: exact segment timing or estimated phrase timing.
- `raw`: source-specific metadata for inspection.

Near-term UI work should keep using this payload. Backend changes should only be added when the interface needs data that cannot be derived locally.

## UX principles

- Overview first: long sessions need a compact density map before the detailed lanes.
- Lanes second: each participant/source needs a scan-friendly lane with count and duration context.
- Inspector always available: selected item should show time, source, text, confidence, and audio/action controls.
- Playback is lazy: signed audio URLs should only be requested when the user asks to play a selected speech item.
- Uncertainty is honest: estimated phrase timing should be visually marked without making the item look broken.
- Source separation matters: speech, Roll20, and Discord need distinct colors and labels, but the palette should stay calm.
- Tables are secondary: transcript and events tables help search/review, but the spatial timeline is the primary surface.

## Controlled stages

1. Add an overview density strip and lane metrics without backend changes.
2. Improve selected-item visibility across lanes, transcript, events, and inspector.
3. Add overlap-aware speech stacking for moments with multiple speakers.
4. Add a compact audio dock for selected speech items, using lazy signed URLs.
5. Add source chips for speech, Roll20, Discord, dice, images, and notes.
6. Add timing confidence indicators: exact, estimated, unsynced, offset-adjusted.
7. Add timeline calibration controls for Roll20/Discord offset correction.
8. Add event clustering for moments where many chat/dice events happen together.
9. Add review actions from the inspector: create note, mark candidate canon, flag issue.
10. Add saved filters/views for DM, player, technical admin, and review modes.
11. Add performance guards for long sessions: virtualization or paged item windows.
12. Run a real-session UX pass after the next full Craig/Roll20/Discord capture.

## First implementation slice

This pass should add:

- A compact overview panel above the detailed lanes.
- Density bars by source type.
- Session duration, visible item count, speech minutes, and external event count.
- Lane labels with item count, speech time, and overlap hints.

Non-goals for this slice:

- No new API contract.
- No paid audio alignment.
- No automatic audio URL generation.
- No destructive changes to existing timeline tables.

## Open decisions

- Whether the final waveform should use wavesurfer.js directly or remain a custom lane renderer with audio only in the inspector.
- Whether phrase timing should stay approximate forever or get an optional paid alignment mode later.
- How much Roll20/Discord offset correction should be automatic versus manually approved by the DM/technical admin.
- Whether the final review/canon actions live inside this timeline page or open a dedicated review workspace.
