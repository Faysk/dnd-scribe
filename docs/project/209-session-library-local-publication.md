# 209 - Session Library and Local Publication

## Objective

Turn the production entrypoint into a focused campaign archive:

1. authenticate;
2. choose a session;
3. read its transcript.

Audio, transcription models, raw artifacts and processing remain on the
operator's computer. Production receives only the small text publication.

## Product boundary

### Included

- authenticated campaign library;
- chronological session cards;
- responsive dark editorial identity;
- transcript reader with timestamps and speakers;
- keyset pagination;
- indexed transcript search;
- speaker filter;
- local-to-production text publication;
- direct Data API lockdown.

### Deferred

- public anonymous access;
- remote audio playback;
- operational jobs and monitoring in the main navigation;
- Roll20 and Discord surfaces in the reader;
- AI-generated summaries, titles and canon extraction.

The existing operational code remains versioned but is no longer loaded by the
main production page.

## Data ownership

| Artifact | Source of truth | Production transfer |
| --- | --- | --- |
| Craig ZIP and FLAC tracks | Local disk | Never |
| Local raw transcript and word timing | Local disk | Never |
| Local review overlay | Local disk | Only applied text and speaker |
| Published transcript segments | Supabase Postgres | Yes |
| Session title, description, cover URL and summary | Supabase Postgres | Yes |
| Markdown transcript | Lore export/backup | Optional |

The application database is the runtime source for published reading. Markdown
is an export and archival format, not a query API.

## Access model

- Supabase JS is used by the browser only for Auth.
- Campaign data is read through authenticated Vercel API routes.
- `/api/library-sessions` returns lightweight session summaries.
- `/api/library-transcript` returns text-only paginated segments.
- `/api/library-summary` returns the complete summary only when requested.
- `/api/session-download` generates the complete Markdown transcript on demand.
- `/api/editor-sessions`, `/api/editor-session` and `/api/editor-segment`
  require `owner` or `master` and power the dark `/edit` workspace.
- `/api/library-import-local` requires the legacy campaign role `owner` or
  `master`.
- Raw tables and views have no Data API grants for `anon` or `authenticated`.
- All public tables have RLS enabled as defense in depth.
- Only the reviewed campaign access RPCs remain executable by
  `authenticated`.

The security migration is
`supabase/migrations/20260726211900_secure_public_data_api.sql`.

## Query and egress budget

### Home

- one request after authentication;
- one aggregate database query;
- no polling;
- no jobs, recording files, candidates or operational payloads.

### Reader

- 120 transcript segments per request by default;
- hard API range of 40 to 200 segments;
- keyset cursor based on time, source sequence and UUID;
- explicit `Carregar mais falas` action;
- no automatic background pagination;
- full-text search uses the existing Portuguese GIN index;
- private browser cache for short repeat-navigation reuse.
- the complete summary is not repeated in transcript pagination responses.

## Local publication contract

The hosted `Edit` workspace reads the complete local session from
`http://127.0.0.1:8765`, removes audio paths, words and model details, then
sends:

- local recording ID;
- title, date and arc;
- optional short recap;
- publication and transcript hashes;
- segment ID, start, end, speaker, text and local review status.

The API validates size and field bounds, upserts the session and its segments
inside one transaction, and marks the session `published` immediately. Review
is editorial follow-up and never blocks publication. Repeating the same
publication is idempotent and updates existing segment rows instead of
duplicating them.

For operator recovery without the browser, the same text-only boundary is
available through:

```powershell
node tools/publish_local_text.js `
  "E:\Project\craig-to-text\data\sessions\<recording-id>\session.json" `
  --title "Nome da sessão" `
  --summary-file "D:\Projects\dnd\lore\03_sessoes\<data>\resumo.md"
```

Run first with `--dry-run` to verify the recording ID, segment count, text
payload size and the explicit `audioTransferred: false` result.

## Verification gates

- `npm run check`
- `npm run build`
- `git diff --check`
- Supabase security advisors after the migration
- 40/40 public tables with RLS enabled
- zero table grants for `anon` and `authenticated`
- login, session library, reader, search, filter and pagination in production
- Central Local publication of a real session without transferring audio
- desktop and mobile visual inspection
