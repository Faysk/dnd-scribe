# 092 - Roll20 ingestion contract

Date: 2026-06-27

## Goal

Define how Roll20 chat commands become application events without giving Roll20 direct authority over campaign canon.

The Roll20 bridge has two layers:

1. `tools/parse_roll20_chat.py` for local/manual parsing during early tests.
2. `lib/roll20-commands.js` for production API use in Vercel.

Both read the same table command language based on the `!dnd` prefix.

## Command lifecycle

1. A player or DM writes a `!dnd` command in Roll20 chat.
2. The command is copied/exported or later captured by automation.
3. The parser extracts command, speaker, args, and raw source line.
4. The normalizer converts it into a domain event.
5. The database stores it as a candidate or backstage note.
6. The DM reviews and approves, edits, rejects, or promotes it.

Roll20 never bypasses DM review for canon.

## Event types

| Command | Event type | Visibility | Notes |
| --- | --- | --- | --- |
| `sessao` | `session_marker` | `table_review` | Start, pause, resume, end, and session labels. |
| `acao` | `character_action_candidate` | `table_review` | Character action candidates for chronicle/review. |
| `canon` | `canon_candidate` | `dm_review` | Lore/NPC/place/item facts awaiting DM approval. |
| `dm` | `dm_backstage_note` | `dm_only` | Private backstage notes. Hidden from players. |
| `audio` | `audio_processing_hint` | `dm_review` | Hints for transcription/extraction priority. |
| unknown | `raw_roll20_note` | `table_review` | Kept for review instead of discarded. |
| invalid | `invalid_roll20_command` | `dm_review` | Preserved for debugging and correction. |

## Production module

`lib/roll20-commands.js` exports:

- `parseRoll20ChatText(text, options)`
- `parseRoll20CommandLine(line, options)`
- `normalizeRoll20Event(parsed, options)`
- `normalizeRoll20Events(events, options)`
- `summarizeRoll20Events(events)`

CLI helper:

```bash
node tools/roll20_chat_to_events.js tests/fixtures/roll20_chat_sample.txt
node tools/roll20_chat_to_events.js tests/fixtures/roll20_chat_sample.txt --summary
```

Syntax checks:

```bash
npm run check:roll20
npm run check:api
```

## Permission model

- DM/owner/master can approve or alter anything.
- Players can create candidate notes, especially for their own character actions.
- `dm` events are stored as DM-only by default.
- Unknown commands are preserved as raw notes so play-session data is not lost.
- The app database remains the source of truth.

## Next implementation step

Add a protected API route for DM ingestion:

```text
POST /api/roll20/ingest
```

Initial body:

```json
{
  "campaignSlug": "yuhara-main",
  "source": "copy-paste",
  "text": "[21:04] Dandelion: !dnd acao personagem:\"Dandelion\" texto:\"...\""
}
```

The route should require `owner` or `master` and return parsed events before writing to permanent tables. The first version can be dry-run only, then we add persistence once the target table is confirmed.
