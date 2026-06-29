# 146 - Discord ops pipeline notifications

Date: 2026-06-29

## Goal

Send important production pipeline actions to the Discord ops/log channel without requiring terminal monitoring.

The site remains the source of truth, but Discord becomes the ambient alert surface for the table operator.

## Events

The API now sends best-effort Discord notifications for real operator actions:

- job paused
- job resumed
- job discarded
- GitHub Actions speech worker dispatched
- GitHub Actions transcription worker dispatched
- GitHub Actions review-generation worker dispatched
- GitHub Actions storage-cleanup worker dispatched

Dry runs and simulations do not notify Discord.

## Delivery

Notifications reuse `lib/discord.js`:

- preferred route: bot message to `DISCORD_OPS_CHANNEL_ID`
- fallback route: `DND_DISCORD_WEBHOOK_URL` or `DISCORD_WEBHOOK_URL`

The API never returns or logs token values. Discord failures are best-effort and do not rollback the database operation or worker dispatch.

## Payload

Job control notifications include:

- session id
- job id
- action
- operator state
- actor
- reason

Workflow dispatch notifications include:

- session id
- action
- workflow file
- GitHub run id/status/url when GitHub returns it
- actor
- OpenAI cost estimate when dispatching transcription

## Safety

- No notification is sent for dry-run actions.
- No destructive storage deletion is performed by notification code.
- Job state changes still commit before the notification is attempted.
- A Discord API failure is logged server-side as `pipeline_ops_notification_failed` and the main request continues.

## Verification

Static checks:

```text
node --check api/[...path].js
npm run check:api
npm run build
```

Production behavior should be tested with one safe action first, preferably pausing/resuming a queued non-running job.

## Next steps

1. Add worker-completion notifications from GitHub Actions scripts after success/failure.
2. Add Discord notifications for monitoring status changes after a deep health check.
3. Add a site-side notification log so Discord delivery attempts can be reviewed later.
