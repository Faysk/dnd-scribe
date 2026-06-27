# 091 - Roll20 chat parser

Date: 2026-06-27

## Purpose

`tools/parse_roll20_chat.py` extracts `!dnd` commands from Roll20 chat text and returns structured JSON for later ingestion.

This is the first production-safe Roll20 bridge because it can run on copied/exported chat text and does not require storing Roll20 cookies or running a browser automation job in production.

## Example

```bash
python3 tools/parse_roll20_chat.py tests/fixtures/roll20_chat_sample.txt
python3 tools/parse_roll20_chat.py tests/fixtures/roll20_chat_sample.txt --summary
```

Expected summary:

```json
{
  "total": 5,
  "valid": 5,
  "invalid": 0,
  "by_command": {
    "sessao": 1,
    "acao": 1,
    "canon": 1,
    "dm": 1,
    "audio": 1
  }
}
```

## Output shape

Each extracted event includes:

- `line_no`: original line number.
- `speaker`: best-effort Roll20 speaker name.
- `command`: first token after `!dnd`.
- `args`: parsed `key:value` arguments.
- `positional`: unkeyed arguments.
- `raw_command`: command text after `!dnd`.
- `raw_line`: original source line.
- `valid`: parser status.
- `error`: parse error when invalid.

## Ingestion rule

Parser output is not canon by itself. It should create candidate records:

- `canon` commands become pending canon review.
- `acao` commands become character action candidates.
- `dm` commands become DM-only backstage records.
- `audio` commands become processing hints.
- unknown commands become raw Roll20 notes for DM review.

The DM remains the final authority for canon approval.
