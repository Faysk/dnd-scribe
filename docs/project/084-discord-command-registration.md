# Discord command registration

Date: 2026-06-27

## Goal

Register the Discord guild commands for the DnD Scribe application:

- `/dnd status`
- `/dnd nota`
- `/dnd vincular`
- message context command `Salvar no DnD Scribe`

## Current status

The local `.env.local` has the required Discord values present:

- `DISCORD_APPLICATION_ID`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`

The bot token is valid. A Discord API diagnostic returned bot identity `DND-SCRIBE`.

Command registration was initially blocked because the app had not been added to the target guild yet:

```text
Discord command registration failed (403): {"message":"Missing Access","code":50001}
guild_access_status 404 Unknown Guild
commands_access_status 403 Missing Access
```

After installing the app in the guild, registration succeeded:

```json
{
  "ok": true,
  "registered": 2,
  "commands": ["dnd", "Salvar no DnD Scribe"]
}
```

Registered command IDs:

- `dnd`: `1520465687531884605`
- `Salvar no DnD Scribe`: `1520465687531884606`

## Channel diagnostics

Guild:

- `1347175398647267358` (`Gaming Den`)

Known channels:

- `DISCORD_DND_CHANNEL_ID=1387538428903690290`
  - Name: `DnD Private Channel`
  - Type: voice channel
  - Bot access: OK
- `DISCORD_RECORDINGS_CHANNEL_ID=1389718366880792761`
  - Name: `rec`
  - Type: text channel
  - Bot access: still blocked with 403 `Missing Access`
  - Permission detail: `@everyone` has `View Channel` denied on the channel, and the managed role `DND-SCRIBE` does not have an explicit channel allow yet.
  - Required fix: allow `DND-SCRIBE` on this channel or its category with `View Channel`, `Send Messages`, `Embed Links`, `Attach Files`, and `Read Message History`.

## Recommended channel layout

Use three Discord surfaces:

- DnD voice/channel: live table voice and player-facing commands.
- Recordings channel: Craig recording links, session upload links, and audio-processing status.
- Ops/logs channel: private bot logs, job failures, cost warnings, and admin-only operational notes.

Recommended env names:

```env
DISCORD_DND_CHANNEL_ID=""
DISCORD_RECORDINGS_CHANNEL_ID=""
DISCORD_OPS_CHANNEL_ID=""
```

`DISCORD_OPS_CHANNEL_ID` was detected locally as `1520467378608144464` (`dnd-scribe-logs`). A bot message test returned HTTP 200.

## Verification command

To re-register or update commands:

```bash
npm run discord:register
```

Expected result:

```json
{
  "ok": true,
  "registered": 2,
  "commands": ["dnd", "Salvar no DnD Scribe"]
}
```

## Validation on 2026-06-27

Validated with Discord API:

- Bot identity: `DND-SCRIBE`
- Guild access: OK
- Guild commands: OK
- DnD voice channel: visible to bot
- Ops/logs channel: visible and writable
- Recordings channel `rec`: visible in guild channel list, but direct channel access and message send are blocked by channel overwrite.

## Vercel environment sync

Vercel env sync: OK for all environments.

Synced variables:

- `DISCORD_DND_CHANNEL_ID`
- `DISCORD_RECORDINGS_CHANNEL_ID`
- `DISCORD_OPS_CHANNEL_ID`
