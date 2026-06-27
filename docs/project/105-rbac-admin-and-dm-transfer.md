# 105 - RBAC admin and DM transfer

Date: 2026-06-27

## Goal

Make role administration usable in production without giving the technical
owner narrative authority by accident.

The Access page now has a `Funcoes e mandato do DM` area for accounts with:

- `project.rbac.manage` at project scope `dnd-scribe`; or
- `campaign.access.manage` at campaign scope `yuhara-main`.

## API routes

```text
GET  /api/rbac
POST /api/rbac/assign
POST /api/rbac/revoke
POST /api/rbac/transfer-dm
```

All routes require a valid Supabase Auth session. The browser attaches the
session token through `web/auth-fetch.js`; the backend validates the token with
Supabase Auth and then uses the server database connection.

The RBAC tables remain closed to `anon` and `authenticated`. The frontend never
receives service keys and does not query `role_assignments` directly.

## Assignment rules

Technical roles are project-scoped only:

```text
platform_owner
platform_operator
security_admin
billing_observer
```

Campaign/narrative roles are campaign-scoped only:

```text
campaign_owner
campaign_reviewer
player
viewer
former_dm_archive_reader
```

`campaign_dm` is blocked from the generic assignment route. DM authority must
move through `POST /api/rbac/transfer-dm` so the mandate history stays coherent.

## DM transfer

The transfer flow:

1. Ends the current active primary `dm_tenures` row.
2. Ends active `campaign_dm` role assignments for previous DMs in the campaign.
3. Creates or refreshes the new DM's `campaign_dm` assignment.
4. Creates a new active primary `dm_tenures` row.
5. Updates legacy `campaign_members` compatibility:
   - old `master` members become `player`;
   - the new DM becomes `master`.

This keeps older API routes working while new code migrates to permission-based
checks.

## Production behavior

The UI refreshes after every change:

- `/api/rbac` for the role panel;
- `access_directory` for the legacy player directory;
- `/api/auth/me` for current-user capabilities.

That means if a user changes their own permissions, the visible state follows
the latest server state after the action completes.

## Remaining hardening

1. Add an explicit audit table for role changes instead of relying only on
   `role_assignments.metadata`.
2. Add temporary/eligible activation for roles that should expire.
3. Migrate Roll20 ingest to `narrative.roll20.ingest`.
4. Migrate canon/review actions to `narrative.review.manage` and
   `narrative.canon.approve`.
5. Migrate worker triggers to `project.jobs.run`.
