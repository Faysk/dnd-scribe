# 093 - Roll20 ingest dry-run endpoint

Date: 2026-06-27

## Endpoint

```text
POST /api/roll20/ingest
```

The first production endpoint is intentionally dry-run only. It validates auth, parses Roll20 chat text, normalizes `!dnd` commands into events, and returns the event list without writing permanent records.

## Auth

The endpoint requires a valid Supabase bearer token from a user linked to the campaign with role:

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

`dryRun` defaults to `true`. Sending `dryRun:false` returns `409` until database persistence is explicitly enabled.

## Response

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

- The endpoint does not accept anonymous access.
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

After validating dry-run output from the browser session, add a UI panel for DM-only Roll20 import:

1. Paste Roll20 chat.
2. Preview parsed events.
3. Show warnings for invalid commands.
4. Let DM approve which events should be staged.
5. Persist staged events in a transaction.
