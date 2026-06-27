# Discord worker notifications

Date: 2026-06-27

## Goal

Use the Discord setup as operational infrastructure for the production pipeline:

- recording/status messages go to `rec`;
- failures and operator messages go to `dnd-scribe-logs`;
- notification delivery must be best effort and must never break a processing job.

## Implementation

Updated `lib/discord.js`:

- Keeps existing webhook delivery.
- Adds bot channel delivery through Discord REST API.
- Resolves logical targets:
  - `recordings` / `recording` / `rec` -> `DISCORD_RECORDINGS_CHANNEL_ID`
  - `ops` / `logs` / `admin` -> `DISCORD_OPS_CHANNEL_ID`
  - `dnd` / `table` / `mesa` -> `DISCORD_DND_CHANNEL_ID`
- Supports explicit `channelId`.
- Uses `allowed_mentions: { parse: [] }` to avoid accidental pings.
- Falls back to webhook when bot delivery fails, unless `fallbackWebhook: false`.

Updated workers:

- `api/jobs/run-cloud-ingest.js`
  - success -> `recordings`
  - failure -> `ops`
- `api/jobs/run-cloud-extract.js`
  - partial extraction -> `recordings`
  - final extraction -> `recordings`
  - failure -> `ops`

All notifications are wrapped so Discord failures are logged as warnings and do not change job success/failure semantics.

## Production environment

The following Vercel envs are required for bot channel delivery:

- `DISCORD_BOT_TOKEN`
- `DISCORD_RECORDINGS_CHANNEL_ID`
- `DISCORD_OPS_CHANNEL_ID`
- `DISCORD_DND_CHANNEL_ID`

`DISCORD_BOT_TOKEN` was synced to Vercel server-side envs without exposing the value.

## Validation

Local real Discord delivery:

- `recordings` target resolved to `1389718366880792761`.
- `ops` target resolved to `1520467378608144464`.
- Bot message to `rec`: OK.
- Bot message to `dnd-scribe-logs`: OK.

Best-effort behavior:

- Missing bot token with `fallbackWebhook: false` returns `missing_bot_token` instead of throwing.

Checks run:

```bash
npm run check:api
npm run check:workers
npm run check:web
npm run build
```

## Next steps

1. Redeploy through Git push so Vercel functions pick up `DISCORD_BOT_TOKEN`.
2. Smoke test production endpoints.
3. Run the next real cloud ingest/extract job and verify Discord messages arrive in the expected channels.
