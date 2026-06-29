# Monitoring route compatibility check

Status: implemented in deep monitoring.

## Goal

Vercel rewrites can fail as platform 404s before the application handler runs. The Roll20 bridge config route exposed this risk: the endpoint logic existed, but the nested route was not routed to the catch-all function.

## Change

`/api/monitoring?deep=1` now includes a `route-compatibility` check. It calls critical production routes without an authenticated session and validates the expected status code:

- `/api/auth-config` -> `200`
- `/api/health` -> `200`
- `/api/monitoring` -> `401`
- `/api/roll20-bridge/config` -> `401`
- `/api/pipeline-control?sourceSessionId=route-smoke` -> `401`

`401` is considered healthy for protected routes because it proves Vercel reached the application handler and auth guard. `404` is critical because it usually means a missing rewrite or deployment routing issue.

## Validation

A local deep monitoring smoke against `https://dnd.faysk.dev` returned `ok` for all route checks after the Roll20 config rewrite fix.
