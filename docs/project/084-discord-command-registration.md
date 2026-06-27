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

Command registration is currently blocked by Discord API access:

```text
Discord command registration failed (403): {"message":"Missing Access","code":50001}
```

Additional diagnostic:

```text
guild_access_status 404 Unknown Guild
commands_access_status 403 Missing Access
```

This means the bot cannot see the configured guild. The likely causes are:

1. The bot was not added to the target Discord server yet.
2. `DISCORD_GUILD_ID` points to a different server than the one where the bot was installed.

## Required user action

Open the OAuth2 install URL, choose the DnD server, and authorize the application with:

- `bot`
- `applications.commands`

Then confirm that `DISCORD_GUILD_ID` is the copied server ID from that same Discord server.

## Next check

After the bot can see the guild, run:

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
