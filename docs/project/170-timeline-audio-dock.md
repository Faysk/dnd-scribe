# Timeline audio dock

Date: 2026-06-29
Status: implemented

## Goal

Make audio review feel native to the timeline. The inspector already had an audio action, but the primary review surface needs a compact player close to the lanes and overview.

## What changed

- Added a timeline audio dock below the overview.
- The dock follows the selected item.
- Speech items with `trackKey` can load audio directly from the dock.
- Roll20/Discord/non-audio items show that they do not have a direct audio track.
- The dock reuses the existing lazy signed URL flow.
- Autoplay now prefers the dock player, falling back to the inspector player.
- The load button is disabled while the signed URL is being generated.

## Cost behavior

No new storage or OpenAI cost is introduced.

The signed R2 URL is still generated only after the user clicks `Ouvir trecho`. The dock does not preload or request audio automatically when selecting items.

## UX behavior

- Selected speech item: shows track, start time, timing confidence, and a play action.
- Loaded speech item: shows the native audio control and R2 metadata badges.
- Selected external event: keeps the timeline stable and explains that there is no direct audio file.

## Next recommended step

Add event clustering for dense Roll20/Discord moments:

- Keep lane readability when many events occur in the same second.
- Show a cluster count on the timeline.
- Expand cluster details in the inspector or a small popover.
