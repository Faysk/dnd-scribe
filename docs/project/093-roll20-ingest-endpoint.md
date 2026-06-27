# 093 - Roll20 ingest endpoint plan

Date: 2026-06-27

## Status

The Roll20 ingest endpoint contract is defined, but the first attempt as a separate file was reverted because the Vercel Hobby plan allows no more than 12 Serverless Functions per deployment.

Decision: do not add new files under `api/` for Roll20 while the project stays on the current plan. The endpoint must be implemented inside the existing catch-all function:

```text
api/[...path].js
```

This keeps production inside the current free/low-cost deployment envelope.

## Planned endpoint

```text
POST /api/roll20/ingest
```

The first production version should be dry-run only. It validates auth, parses Roll20 chat text, normalizes `!dnd` commands into events, and returns the event list without writing permanent records.

## Auth

The endpoint must require a valid Supabase bearer token from a user linked to the campaign with role:

- `owner`
- `master`

Any other role receives `403`.

This matches the project rule that the DM has final authority over canon and ingestion.

## Body

```json
{
  "campaignSlug": "yuhara-main",
  "sourceSessionId": "optional-session-id",
  "source": "copy-paste",
  "prefix": "!dnd",
  "text": "[21:04] Dandelion: !dnd acao personagem:\"Dandelion\" texto:\"Investigou o altar\""
}
```

Accepted text fields:

- `text`
- `chatText`
- `chat_text`

`dryRun` should default to `true`. Sending `dryRun:false` should return `409` until database persistence is explicitly enabled.

## Response contract

```json
{
  "ok": true,
  "mode": "dry_run_only",
  "dryRun": true,
  "campaignSlug": "yuhara-main",
  "sourceSessionId": null,
  "source": "copy-paste",
  "prefix": "!dnd",
  "actor": {
    "profileId": "...",
    "displayName": "...",
    "role": "master"
  },
  "summary": {
    "total": 1,
    "valid": 1,
    "invalid": 0,
    "byCommand": {
      "acao": 1
    }
  },
  "events": []
}
```

## Safety rules

- The endpoint must not accept anonymous access.
- Players cannot ingest Roll20 chat into the system.
- Roll20 commands do not become canon automatically.
- `dm` commands normalize to `dm_only` visibility.
- Unknown commands are preserved as `raw_roll20_note` during dry-run.
- The first persistent implementation should write to `roll20_events` or a staging table and keep DM review mandatory.

## Local checks

```bash
npm run check:roll20
npm run check:api
```

## Next step

Patch `api/[...path].js` instead of adding a new `api/roll20/ingest.js` file:

1. Require `lib/roll20-commands.js` near the top.
2. Add `roll20DryRunPayload(body, campaign)` helper.
3. Add `POST /api/roll20/ingest` inside `handlePost`.
4. Require `owner` or `master`.
5. Return parsed events without writing to the database.
6. Only after that, add a UI panel for DM-only Roll20 import.
