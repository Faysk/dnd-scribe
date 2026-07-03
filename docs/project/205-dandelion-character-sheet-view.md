# 205 - Dandelion character sheet view

## Goal

Replace the previous screenshot-first sheet experience with a structured character
sheet panel inside the private Dandelion lore workspace.

The screenshots under the private lore folder remain source material for manual
transcription and verification. They are no longer listed in the protected lore
gallery by default.

## Production behavior

`GET /api/lore/dandelion` now includes a `sheet` object parsed from:

```text
lore/08_fichas/ficha_atual/ficha_atual.md
```

As with the rest of the private lore workspace, production reads local files only
when bundled/private and otherwise falls back to the private R2 lore prefix. The
GitHub repository is public, so the local `lore/` directory remains ignored and
private content must be synced to R2.

## Parsed areas

The sheet parser is Markdown-tolerant and organizes:

- quick character summary;
- ability scores and saving throws;
- strongest skills;
- passive senses;
- spellcasting overview and slots;
- spells by level;
- visible actions and bonus/reaction resources;
- proficiencies;
- features and traits;
- money, equipment, attunement, and possessions;
- lore relevance notes;
- update history and checklist.

## Frontend behavior

The Lore tab renders a dedicated `Ficha do personagem` section before sessions
and visual references. The document card for `Ficha atual` is hidden from the
generic document grid to avoid duplicate reading paths.

The gallery now shows only visual references such as character art, maps, scenes,
and music tooling. Sheet screenshots are not rendered as cards.

## Update workflow

1. Update the private Markdown sheet when the Roll20/DnD Beyond sheet changes.
2. Keep screenshots only as evidence or transcription source when useful.
3. Sync private lore to R2:

```bash
python3 tools/sync_lore_to_r2.py --write
```

4. Refresh the Lore tab in production.

## Future upgrade

The next step is to store character sheets as structured JSON in the database or
R2 alongside the Markdown source, with per-character ownership rules. This keeps
Dandelion, Astel, Screaky, and future characters on the same UI model while the
DM retains full visibility.
