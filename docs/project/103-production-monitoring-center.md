# 103 - Production monitoring center

Date: 2026-06-27

## Goal

Add a DM-only monitoring center for the production app.

The page must answer:

- Is the app/API online?
- Is Supabase reachable?
- Are required env keys present without exposing token values?
- Are tokens expired when expiry can be detected from JWT metadata?
- Are Discord, webhook, R2, Vercel and OpenAI ready or missing?
- How much campaign data, audio and AI ledger usage exists?
- Which jobs failed, are queued or need attention?

## Implementation

New backend module:

```text
lib/monitoring.js
```

New protected endpoint inside the existing catch-all function:

```text
GET /api/monitoring
GET /api/monitoring?deep=1
```

The endpoint requires campaign role:

- `owner`
- `master`

This is intentional because the response contains operational metadata about tokens and services. Secret values are never returned; the payload only includes presence, missing key names, derived JWT expiry when available and status labels.

New frontend files:

```text
web/monitoring.js
web/monitoring.css
```

`web/index.html` now loads the monitoring assets and the app injects a `Monitor` tab.

## Modes

Fast mode:

- checks local runtime
- pings Postgres
- validates required env presence
- checks R2 signing prerequisites
- reads Supabase campaign metrics
- does not call third-party APIs

Deep mode:

- validates Discord bot token with `GET /users/@me`
- validates Discord webhook with a read-only webhook fetch
- queries recent Vercel deployments when `VERCEL_TOKEN` and project ids are configured

Deep mode is explicit to avoid adding external calls to every dashboard load.

## Data shown

The first version shows:

- overall status and snapshot id
- APIs and service checks
- env/token readiness
- sessions by status
- synced content counts
- storage/file totals
- audio pipeline totals
- AI usage ledger totals
- recent jobs and failure details

Every detailed item is clickable via native `details/summary`.

## Security notes

- The endpoint is DM-only.
- No token values are exposed.
- JWT expiry is decoded locally only when the key format supports it.
- Optional services such as OpenAI and Roll20 operator credentials are shown as standby when absent.
- The page does not run paid OpenAI work.

## Next steps

1. Add structured API logs around every route start/done/error.
2. Persist internal API events into a small audit/ops table.
3. Add a Discord webhook notifier for critical production failures.
4. Add Vercel runtime log fetch once deployment id/log windows are finalized.
5. Add uptime checks for public pages and protected API endpoints.
6. Add thresholds for stale queued jobs.
7. Add storage growth trends by day/week.
8. Add per-session audio/AI cost drill-down links.
9. Add a DM acknowledgement field for critical alerts.
10. Add a read-only incident timeline that combines jobs, uploads, Roll20 imports and Discord events.
