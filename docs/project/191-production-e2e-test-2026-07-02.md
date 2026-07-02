# Production E2E Test - 2026-07-02

## Scope

Validated the production path for the new Craig upload:

- source session: `manual-2026-07-01-20260701-sessao-235100`;
- campaign: `yuhara-main`;
- production site: `https://dnd.faysk.dev`;
- paid OpenAI transcription was not executed in this pass.

The logical session date is `2026-07-01` in `Europe/London`. In the database this appears as `2026-06-30T23:00:00.000Z`, which is the UTC representation of London midnight.

## Production Checks

- Route smoke passed: `7/7`.
- Vercel runtime log check did not show production 5xx during the monitored window.
- GitHub Actions notifications to Discord succeeded with HTTP `204`.
- Storage cleanup dry-run succeeded without deleting any object.

## Pipeline Result

| Stage | Result | Notes |
| --- | --- | --- |
| `craig_direct_upload` | succeeded | ZIP uploaded directly to R2. |
| `cloud_ingest_craig` | succeeded | Manifest stage completed with `$0` OpenAI cost. |
| `cloud_extract_craig_tracks` | succeeded | Needed 2 attempts; final state clean. |
| `cloud_plan_audio_chunks` | succeeded | Planned 72 chunks. |
| `cloud_detect_speech_slices` | succeeded | Ran in two GitHub Actions batches. |

Speech slicing totals:

- source audio: `705.006` minutes across `72` chunks;
- speech slices: `654` slices across `72` chunks;
- speech audio retained: `306.476` minutes;
- transcription work currently eligible: `624` speech-slice objects, `294.394` minutes;
- configured transcription estimate: `294.394 * 0.003 = $0.883182`.

By track:

| Track | Chunks | Slices | Speech minutes |
| --- | ---: | ---: | ---: |
| `arutorux` | 18 | 190 | 91.468 |
| `faysk` | 18 | 127 | 52.818 |
| `renanyuhara` | 18 | 180 | 91.214 |
| `sunnrq` | 18 | 157 | 70.976 |

## Storage Result

Active artifacts after speech slicing:

- `compact_track_opus`: 4 objects, `93,595,090` bytes;
- `raw_track_flac`: 4 objects, `297,886,919` bytes;
- `speech_slice_wav`: 654 objects, `588,485,156` bytes.

Cleanup dry-run:

- candidate objects: `30`;
- candidate bytes: `23,200,708`;
- execute: `false`;
- deleted objects: `0`.

The dry-run selected only `speech_slice_wav` objects already classified as `delete_ready`. Destructive cleanup remains behind the existing explicit confirmation flow.

## Findings

1. The supervisor stops before speech slicing by design. The production path works through GitHub Actions, but the UI should keep making this explicit as a worker handoff instead of looking like a stall.
2. Partial speech slicing reports `retrying` while remaining chunks exist. This is correct mechanically, but operator copy should say "partial batch complete; continue worker" rather than imply a failure.
3. The speech worker originally persisted and printed the full per-slice detail in the job summary. That works but bloats logs and `processing_jobs.output` on large sessions. The worker now stores compact summaries and leaves detailed data in `audio_speech_slices` and `audio_artifacts`.
4. Roll20 event ingestion is still unvalidated for this session: `0` Roll20 events.
5. Discord session-message ingestion is not present yet. Current production Discord coverage is webhook/interactions, not full channel history capture.

## Next Gate

Before running paid transcription for this session:

1. Confirm the configured cost estimate on the site.
2. Run a limited paid transcription batch first, preferably 10-30 minutes.
3. Validate transcript timing and speaker attribution in the timeline.
4. Only then run the rest of the transcription candidates.
5. After verified transcription, run safe cleanup to remove eligible temporary WAV slices and later raw FLAC/ZIP objects when policy marks them ready.
