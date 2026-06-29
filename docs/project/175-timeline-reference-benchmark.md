# Timeline reference benchmark

Date: 2026-06-29
Status: benchmark complete for the current MVP cycle

## Goal

Use real product and open-source references to guide the timeline UX before adding heavier features like waveform, timeline calibration, and review/canon actions.

The current objective is not to copy another product. The DnD timeline has a specific shape: multi-speaker audio, Roll20, Discord, dice, notes, review/canon decisions, and technical audit context in one authenticated app.

## References reviewed

### ELAN

Source: https://archive.mpi.nl/tla/elan

What matters here:

- Multi-tier annotation is the strongest mental model for our timeline.
- Audio/video media and annotations are viewed together.
- Dense annotation work needs explicit tiers/layers rather than one flat list.
- User pain in ELAN-style workflows often comes from timing alignment, waveform visibility, zoom, and navigation.

Decision for DnD Scribe:

- Keep speaker/source lanes as first-class UI.
- Add confidence and sync status visibly.
- Treat waveform as a future enhancement, not as the first required timeline layer.

### wavesurfer.js

Source: https://wavesurfer.xyz/docs/

What matters here:

- Waveform, timeline, minimap, hover, regions, and zoom are proven primitives for browser audio review.
- Regions map well to transcript segments and future canon/review selections.
- Minimap/overview is useful for long audio sessions.

Decision for DnD Scribe:

- The current custom overview is correct for MVP.
- If waveform becomes necessary, use wavesurfer.js rather than hand-rolling waveform rendering.
- Waveform should be lazy and scoped to selected tracks to avoid loading large audio by default.

### BBC React Transcript Editor

Source: https://github.com/bbc/react-transcript-editor

What matters here:

- Transcript correction and media playback need to be close together.
- Keyboard-friendly review is important for long-form editing.
- Word/phrase timing can power transcript navigation, but precision must be treated carefully.

Decision for DnD Scribe:

- Keep transcript rows linked to timeline selection.
- Keep keyboard navigation.
- Do not pretend locally estimated phrase timing is exact.

### Audino

Source: https://github.com/midas-research/audino

What matters here:

- Audio annotation workflows often need speaker identification, VAD, diarization, transcription, and annotation in one workspace.
- Export/review structures matter as much as the annotation UI.

Decision for DnD Scribe:

- Keep audio processing and UI review separated.
- Use review/canon actions on selected timeline items later.
- Preserve technical metadata for auditability.

### Label Studio

Source: https://github.com/HumanSignal/label-studio

What matters here:

- General annotation systems solve workflow, review, permissions, and task status well.
- Labeling interfaces benefit from clear task state and explicit review controls.

Decision for DnD Scribe:

- Do not turn the timeline into a generic labeling tool.
- Borrow workflow ideas: status, review queues, assignee/approver concepts, and source evidence.

### CVAT

Source: https://github.com/cvat-ai/cvat

What matters here:

- CVAT is not an audio timeline reference, but it is a strong reference for annotation at scale, review workflows, issue tracking, and quality control.

Decision for DnD Scribe:

- Use CVAT-style thinking for review quality, not visual design.
- Future canon/review flows should support issue/flag/reopen behavior.

## Benchmark decisions already implemented

- Overview/minimap-like density strip.
- Multi-lane speaker/source layout.
- Overlap stacking inside lanes.
- Cluster indicators for dense Roll20/Discord moments.
- Timing confidence labels.
- Lazy audio dock.
- Keyboard navigation.
- Copyable markers and hash deep links.

## Gaps to close after real-session testing

1. Waveform decision
   - Keep custom overview if enough.
   - Add wavesurfer.js only if reviewers need visible waveform shape.

2. Calibration
   - Roll20/Discord need offset controls when timestamps do not line up with audio.

3. Review actions
   - Selected timeline items should become notes, canon candidates, issue flags, or DM tasks.

4. Performance
   - Large sessions may need virtualization, pagination, or per-lane item windows.

5. Quality state
   - The page should show what is complete, partial, estimated, unsynced, or missing.

## Current recommendation

Finish a quality/status layer for the timeline before adding waveform. The timeline still needs to tell the operator whether it is healthy enough to review:

- Does it have speech?
- Does it have external events?
- How many items are unsynced?
- Are there estimated phrases?
- Is audio playable on demand?
- Are there dense clusters worth reviewing?

This gives practical value before adding a heavier audio visualization dependency.
