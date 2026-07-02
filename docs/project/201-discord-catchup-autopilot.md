# 201 - Discord catch-up autopilot

Date: 2026-07-02
Status: implemented

## Goal

Make Discord timeline capture less dependent on a manual button during or after
the session.

The project already supports manual Discord sync through:

```text
POST /api/discord-sync-channel
```

This step adds a production supervisor endpoint and Vercel Cron entry:

```text
GET /api/cron/discord-catch-up
```

The endpoint is guarded by the existing cron secret path. It does not expose a
public write surface.

## Why polling

Vercel functions are not a good place for a permanent Discord Gateway process.
The safer production path is a short scheduled REST catch-up that:

- reads recent messages from the configured DnD channel;
- stores only missing/newer messages;
- keeps Discord messages idempotent by `source_id=discord-message:<id>`;
- does not call OpenAI;
- can be inspected through the monitoring page.

Discord REST message reads return messages newest-first and support paging with
`before`, `after` and `around`. Message content still depends on the bot having
the right channel permissions and Message Content Intent.

## Runtime behavior

Default policy:

- channel: `DND_DISCORD_CATCHUP_CHANNEL` or `dnd`;
- sessions: up to 3 recent non-archived sessions;
- lookback: 48 hours;
- page size: 50 messages;
- pages: up to 4 pages per session;
- mode: incremental `after` the newest stored Discord snowflake when possible;
- fallback: session window sync when there is no cursor yet.

Environment overrides:

```text
DND_DISCORD_CATCHUP_ENABLED=true
DND_DISCORD_CATCHUP_CHANNEL=dnd
DND_DISCORD_CATCHUP_LIMIT=50
DND_DISCORD_CATCHUP_MAX_PAGES=4
DND_DISCORD_CATCHUP_MAX_SESSIONS=3
DND_DISCORD_CATCHUP_LOOKBACK_HOURS=48
DND_DISCORD_CATCHUP_INCLUDE_BEFORE_START=false
DND_DISCORD_CATCHUP_INCLUDE_AFTER_END=false
```

## Monitoring

The Monitor page now exposes:

- env readiness for Discord catch-up;
- total Discord messages stored in `table_notes`;
- sessions with Discord timeline data;
- messages with timeline offset;
- attachments referenced from Discord;
- latest message time and latest sync time;
- readiness item `Discord catch-up`.

This lets the operator see if the Discord path is healthy without opening code
or logs.

## Failure policy

If the catch-up cannot read the channel:

- the endpoint returns `ok=false`;
- the Discord operations webhook receives a warning when configured;
- the Monitor readiness item moves to attention/critical depending on channel
  validation.

No destructive cleanup happens in this path.

## Cost

OpenAI cost: USD 0.

The catch-up only reads Discord REST data and writes normalized notes.
