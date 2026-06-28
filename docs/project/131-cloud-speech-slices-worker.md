# 131 - Cloud speech slices worker

## Goal

Move `cloud_detect_speech_slices` from a planned stop into a production-capable cloud worker without adding another Vercel Function and without calling OpenAI.

This stage remains OpenAI `$0`.

## Why GitHub Actions first

Speech slicing needs Linux + ffmpeg and can take longer than a Vercel Function timeout. GitHub Actions gives us a controlled cloud worker with:

- `ubuntu-latest`;
- `ffmpeg` installed by apt;
- direct R2 download/upload through S3-compatible credentials;
- direct Supabase writes through `DATABASE_URL`;
- manual dry-run before write;
- batch limits to avoid processing a full session by accident.

## Files

- `.github/workflows/speech-slices-worker.yml`
- `tools/cloud_speech_slices_worker.py`

## Required GitHub repository secrets

The workflow needs these repository secrets:

- `DATABASE_URL`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_S3_ENDPOINT` or `R2_ENDPOINT`

These are server-side only. They must not be exposed to the browser.

## Manual run inputs

- `source_session_id`: required, for example `craig-BIRq3nIWB4v9`.
- `campaign`: defaults to `yuhara-main`.
- `max_chunks`: defaults to `8`.
- `max_tracks`: defaults to `1`.
- `write`: defaults to `false`; dry-run when false.
- `make_compact`: defaults to `true`; creates `compact_track_opus` for cleanup readiness.
- `replace`: defaults to `false`; only use true for controlled reprocessing.

## What the worker does

1. Finds or creates the `cloud_detect_speech_slices` job for the session.
2. Claims a queued/retrying job when `write=true`.
3. Reads planned `audio_chunks` for extracted Craig tracks.
4. Downloads only the FLAC track files needed for this batch.
5. Optionally creates a permanent compact Opus track.
6. Runs `ffmpeg silencedetect` per selected chunk.
7. Merges nearby speech intervals into transcription-friendly units.
8. Uploads only `speech_slice_wav` objects to R2.
9. Upserts `audio_speech_slices` rows.
10. Upserts `audio_artifacts` inventory rows for compact tracks and speech slices.
11. Marks silent chunks as `skipped_silence` so they do not fall back into paid transcription.
12. Leaves the job as `retrying` while chunks remain, or `succeeded` when all eligible chunks are processed.

## Storage policy impact

The worker does not create full chunk WAV files. That keeps R2 growth lower.

It can create:

- `compact_track_opus`: permanent compact archive, needed before raw FLAC tracks become cleanup-ready.
- `speech_slice_wav`: temporary transcription source, delete-after-success once transcript artifacts exist.

## First production test recommendation

Run the workflow with:

- `source_session_id = craig-BIRq3nIWB4v9`
- `max_tracks = 1`
- `max_chunks = 1`
- `write = false`
- `make_compact = false`

If the dry-run succeeds, run:

- `max_tracks = 1`
- `max_chunks = 1`
- `write = true`
- `make_compact = false`

Only enable `make_compact=true` after the first speech slice write is confirmed, because compacting a five-hour track is heavier than detecting one chunk.

## Next integration

After one successful real run, add a production UI control that dispatches this workflow from the site. That needs a server-side GitHub token with workflow dispatch permission stored in Vercel, not in client code.
