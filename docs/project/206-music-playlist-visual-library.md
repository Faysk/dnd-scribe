# 206 - Music playlist visual library

## Goal

Turn the Dandelion YouTube playlist from a small hidden player into a visual
music library that is easier to scan during a session.

## Source

The public playlist catalog currently has 46 tracks captured in:

```text
lore/05_musicas/catalogo_youtube.md
```

The track list is public YouTube metadata, so the frontend can include titles,
durations, video ids, narrative grouping, and direct links without exposing
private lore text.

## UI changes

The dock now keeps the video hidden and focuses on audio control. When expanded,
it shows:

- active track title and duration;
- category filters;
- search by title, arc, or mood;
- grouped sections for Dandelion tavern chaos, Dandelion identity, Astel/corvos,
  and Euclix/fenix;
- compact track cards with duration, version label, YouTube link, and direct play.

## Playback behavior

Clicking a track loads that specific YouTube video through the existing hidden
iframe player. Next/previous now follows the structured track order from the
catalog instead of relying only on the YouTube playlist controls.

## Future improvements

- Mark canonical versions per song family.
- Add session/cena tags after the DM approves music usage.
- Add local/native audio only for files that the table is allowed to store and
  play outside YouTube.
