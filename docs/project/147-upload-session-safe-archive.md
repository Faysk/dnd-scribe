# 147 - Upload session safe archive shortcut

Date: 2026-06-29

## Goal

Make a bad or stuck Craig upload easy to remove from the active operational path without deleting evidence.

Hard delete remains intentionally out of scope because a session can cascade into transcripts, Roll20 events, Discord events, notes, candidates, jobs and storage artifacts.

## UI

The upload workspace session card now shows session actions when a session exists:

- `Arquivar`
- `Restaurar`
- `Editar`

This mirrors the existing session management controls but keeps the operator in the upload context while investigating a failed or unwanted upload.

## Behavior

`Arquivar` uses the existing safe session update flow:

- sets `sessions.status=archived`
- keeps recording files
- keeps processing jobs
- keeps storage metadata and R2 objects
- keeps transcript and event evidence

`Restaurar` returns the session to:

- `uploaded` when recording files exist
- `planned` when no recording file exists

## Why not delete yet

Actual deletion needs a separate reviewed admin flow with:

- impact preview
- storage cleanup plan
- explicit confirmation phrase
- audit event
- optional retention window

The safe archive shortcut solves the immediate production need without risking data loss.
