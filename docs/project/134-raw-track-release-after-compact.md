# 134 - Raw track release after compact audio

## Goal

Reduce R2 storage after a Craig session has been safely transcribed.

The previous policy kept `raw_track_flac` for seven days even after the project already had:

- permanent `compact_track_opus` for playback/timeline;
- completed speech slices/work units;
- persisted transcript segments and transcription cache.

That was safe, but too expensive for production because each session can keep hundreds of MB of FLAC after the useful data is already captured.

## New rule

`raw_track_flac` can become `delete_ready` before the fixed retention window expires only when all these are true:

- the matching `compact_track_opus` exists for the same `session_id` + `track_key`;
- the retention policy allows superseded deletion;
- no transcription work units are pending for that track;
- at least one work unit for that track is completed as `transcribed`, `cached`, or `skipped_silence`;
- the artifact is not under permanent/review/legal hold.

The cleanup runner still does the destructive part separately. The migration only marks readiness and writes audit events.

## Related polish

The migration also updates old `audio_chunks` from `pending` to `transcribed` or `skipped_silence` when all their speech slices are already complete. This keeps monitoring from showing a finished session as stuck.

It also recovers stale `transcription_execute` jobs that remained `running` after all work units were complete, marking them succeeded with an explicit recovery marker in `processing_jobs.output`.

## Rollback

If we need to keep raw FLAC longer again, restore the previous cleanup view from `schemas/20260628_023_silent_speech_slice_cleanup.sql` and apply it. Already deleted R2 objects are not recoverable unless restored from an external backup.
