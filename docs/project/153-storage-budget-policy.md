# Storage budget policy

Status: implemented in monitoring snapshot and storage inventory UI.

## Goal

The project should keep production useful without letting raw Craig uploads become a silent storage cost. The policy is not a hard deletion rule. It is an operational budget that tells the admin when the archive is drifting away from the intended shape.

Long-term storage should prefer compact and useful artifacts:

- compact audio for review/playback when needed;
- manifests and metadata;
- speech slices/transcript evidence while they are still useful;
- final transcripts, timeline events, Roll20/Discord records and DM review decisions.

Raw ZIP, extracted FLAC tracks, intermediate WAV chunks and temporary work files should be treated as processing material. They can exist while the pipeline is working, but should become cleanup candidates once compact artifacts and transcript evidence are confirmed.

## Default thresholds

The monitor applies defaults even when no env override is present:

- `DND_STORAGE_TOTAL_SOFT_LIMIT_BYTES`: `5GiB`
- `DND_STORAGE_SESSION_RETAINED_TARGET_BYTES`: `250MiB`
- `DND_STORAGE_SESSION_ACTIVE_WARNING_BYTES`: `1500MiB`
- `DND_STORAGE_UPLOAD_ZIP_WARNING_BYTES`: `1200MiB`

Values accept raw bytes or units such as `250MiB`, `1.5GiB`, `5GB`.

## How it appears in production

The `/api/monitoring` payload now includes `storage-budget` with:

- total tracked bytes from `recording_files`;
- average bytes per session;
- largest sessions by storage usage;
- delete-ready and blocked cleanup bytes;
- policy thresholds and computed status.

The Monitor page surfaces storage usage percentage and average-per-session at the top of the operational dashboard. The Ops storage inventory uses the same policy, shows the heaviest sessions, and keeps cleanup execution behind the existing safe `delete_ready` flow.

## Operating rule

When storage enters `attention`, the next action should be cleanup or compaction before new paid transcription work. When storage enters `critical`, pause new bulk uploads until the ready cleanup queue or artifact policy is resolved.

No automatic hard delete was added here. Deletion still requires the explicit safe cleanup action and only targets artifacts classified as `delete_ready`.
