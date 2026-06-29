# Timeline event clusters

Date: 2026-06-29
Status: implemented

## Goal

Improve dense Roll20/Discord review moments without hiding individual events. Dice rolls, chat bursts, and Discord comments can happen within the same few seconds, so the timeline needs to signal that a selected event belongs to a larger moment.

## What changed

- Added frontend-only cluster detection for non-speech items.
- Events in the same lane within a short window are marked as a cluster.
- Timeline lane metrics now include cluster count.
- Clustered blocks get a compact count badge.
- Clustered blocks receive a slightly wider visual footprint for readability.
- Inspector now shows cluster context for selected clustered events:
  - cluster range
  - event count
  - first few cluster members

## Current behavior

- Cluster window: 2 seconds.
- Applies to non-speech items only.
- Works per lane, so Roll20 and Discord clusters are calculated independently.
- Does not alter timeline API payload or database state.

## Why this is safe

- No backend change.
- No new dependency.
- No data mutation.
- No new cost.
- Individual items remain selectable.

## Future improvement

If a real session produces very dense bursts, the next version can collapse clusters into one expandable block. For now, this version keeps every event visible while making dense moments easier to spot.
