# 106 - Timeline reference concept

Date: 2026-06-27

Reference image:

```text
D:\Projects\dnd\tmp\ChatGPT Image Jun 27, 2026, 11_47_05 PM.png
/mnt/d/projects/dnd/tmp/ChatGPT Image Jun 27, 2026, 11_47_05 PM.png
```

The image is a visual reference only and should stay out of version control.

## Product idea

The timeline should become the heart of DnD Scribe: one synchronized view where
speech, audio, Roll20 events, Discord chat, images, AI findings, canon decisions,
backstage notes and secrets can be inspected at the same time.

## Main structure

Top navigation:

- session selector;
- compact session map / minimap;
- filters for Falas, Roll20, Discord, Imagens, IA, Canon, Bastidores, Segredos;
- zoom controls and playback state.

Core timeline:

- horizontal time axis in seconds and milliseconds;
- one or more speaker lanes;
- overlapping speech blocks when multiple people speak at once;
- event lanes for Roll20, Discord, media and AI;
- markers for canon candidates, notes, dice rolls and important moments.

Audio area:

- multitrack waveform aligned to the same time axis;
- one row per player/Craig track;
- per-track solo/mute/volume controls;
- click-to-seek from waveform, event card or transcript.

Transcript area:

- synchronized transcript table;
- speaker, character, start/end/duration, confidence and text;
- quick visibility/status chips;
- ability to jump to exact audio.

Inspector:

- selected event details;
- speaker and character identity;
- start/end/duration;
- linked transcript/audio/roll/chat/media;
- confidence and visibility;
- actions for canon, quote, backstage, secret and review.

## UX principles

1. Time is the primary axis. Every captured thing must have a start time,
   approximate time or explicit "unsynced" state.
2. The UI must support overlap. Two or more people can speak in the same second,
   and Roll20/Discord events can happen during that overlap.
3. The inspector is where complexity goes. The main timeline should stay
   scannable; deep metadata appears after selecting an item.
4. Audio must be first-class. The user should be able to hear a single speaker,
   the full mix or a precise slice related to any event.
5. Permissions still apply. DM-only/backstage/secret material should render only
   for roles that have the right narrative permissions.

## Data needs

Each timeline item should eventually normalize to:

```text
id
source_system
source_type
source_id
session_id
start_ms
end_ms
confidence
speaker_profile_id
character_name
visibility
payload
linked_audio_file/chunk/slice
```

Roll20 already has `approx_start_ms`. Audio/transcript already has segment
timing. Discord ingestion now has a production REST sync path through
`/api/discord-sync-channel`; messages are stored in `table_notes` and receive
`metadata.timeline.startMs` when the session has a reliable `started_at`.

## Suggested implementation stages

1. Build a read-only timeline data endpoint merging transcript segments,
   participants, recording files and Roll20 events.
2. Render lanes with deterministic layout and overlap handling.
3. Add synchronized audio seek/playback for existing signed audio URLs.
4. Add transcript table linked to timeline selection.
5. Add inspector panel for selected event details.
6. Add Discord events once capture is production-ready.
7. Add images/media lane.
8. Add AI/canon/backstage/secret overlays with RBAC-aware visibility.
9. Add editing/review actions from the inspector.
10. Add performance virtualization for long sessions.

## Progress

Step 107 implemented the first read-only version of items 1-5:

- `/api/timeline`;
- speaker/event lanes;
- phrase-level transcript estimates generated locally;
- selected-item inspector;
- on-demand audio playback from signed track URLs.

The remaining timeline work should now focus on production Discord capture,
media/AI overlays, review actions and virtualization.
