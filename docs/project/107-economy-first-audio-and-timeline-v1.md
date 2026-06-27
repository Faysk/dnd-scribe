# 107 - Economy-first audio and timeline v1

Date: 2026-06-28

## Decision

Do not fragment audio into words or phrases before paid transcription.

The low-cost path is:

```text
raw Craig track
-> chunk
-> remove silence
-> merge nearby speech into context units
-> transcribe once
-> split transcript into phrases locally for the timeline
```

This preserves the silence-reduction savings without multiplying provider
requests or losing phrase context.

## Builder changes

`tools/build_speech_slices.py` now groups speech intervals before exporting WAV
files.

New defaults:

```text
merge gap: 2.5 seconds
minimum transcription unit: 12 seconds
maximum transcription unit: 90 seconds
padding: 250 ms
```

The generated row metadata stores:

- raw interval count;
- merged interval count;
- raw speech intervals;
- merge/min/max settings.

This lets us audit cost and quality later.

## Timeline endpoint

`GET /api/timeline` is production-read-only and requires campaign login.

It returns:

- session metadata;
- lanes;
- participants;
- recording files;
- transcript segments;
- locally estimated phrase items;
- Roll20 events;
- merged timeline items.

Phrase timestamps are estimated inside each already-transcribed segment by text
length. This does not call OpenAI and does not increase transcription cost.

## Frontend

The Timeline tab now loads `/api/timeline` lazily and renders:

- time scale;
- speaker lanes;
- Roll20 lane;
- future Discord/media/AI lanes;
- transcript table;
- detail inspector;
- on-demand signed audio playback for selected speech items.

Audio URLs are fetched only when the user clicks to hear an item.

## Known limits

1. Phrase timestamps are approximate unless the provider response has word or
   segment timestamps.
2. The first version is read-only.
3. Discord/media/AI lanes are placeholders until production capture/overlay data
   is implemented.
4. Long-session virtualization is still pending.

## Next steps

1. Validate UI with a real transcribed session.
2. Add Discord event capture into the same time axis.
3. Add media/image lane.
4. Add AI/canon/backstage/secret overlays with RBAC filtering.
5. Add inspector actions for review/canon/quote/backstage.
6. Add virtualization for long sessions.
