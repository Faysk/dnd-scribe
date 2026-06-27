# 104 - RBAC foundation

Date: 2026-06-27

## Goal

Separate technical administration from narrative authority.

The project now needs a model where a user can administer infrastructure,
tokens, logs, costs and workers without becoming DM or gaining access to
DM-only story material.

The design follows an Azure-style RBAC shape:

```text
principal/profile + role definition + scope + assignment window
```

## New tables

```text
permission_catalog
role_definitions
role_permissions
role_assignments
dm_tenures
```

`campaign_members` remains active for compatibility while API routes migrate to
permission checks one by one.

## Planes

Technical plane:

- production monitor
- redacted logs
- token status
- cost and storage usage
- workers/jobs
- deploy status
- technical RBAC

Narrative plane:

- campaign content
- DM-only notes
- canon approval
- private review material
- Roll20/note review

Mixed plane:

- account linking
- campaign access administration
- uploads and capture operations

## Bootstrap

The migration bootstraps:

- `faysk` as `platform_owner` at project scope `dnd-scribe`;
- current `campaign_members` into equivalent scoped role assignments;
- current `master` membership into an active `dm_tenures` row.

`platform_owner` is technical authority only. It does not grant:

- `narrative.canon.approve`
- `narrative.dm_notes.read`
- campaign DM status

## First route migrated

`GET /api/monitoring` now requires:

```text
project.monitor.read
```

The code keeps legacy `owner/master` fallback only when RBAC tables do not exist.
Once the migration is present, the permission check is authoritative.

## DM transfer model

DM is not a permanent property of a person. It is an assignment with scope and
time.

When DM changes:

1. End the old `campaign_dm` role assignment.
2. End the old active `dm_tenures` row.
3. Create a new `campaign_dm` role assignment.
4. Create a new `dm_tenures` row.
5. Keep previous canon decisions linked to the profile and role at the time.

Former DMs do not keep automatic access to new DM-only material. If the table
wants that, assign `former_dm_archive_reader` explicitly with an expiration.

## Next steps

1. Add an admin UI to view active role assignments.
2. Add DM transfer workflow with reason and effective date.
3. Move access-directory management to `campaign.access.manage`.
4. Move Roll20 ingest to `narrative.roll20.ingest`.
5. Move review/canon actions to `narrative.review.manage` and `narrative.canon.approve`.
6. Move cloud workers to `project.jobs.run`.
7. Add redaction rules for technical logs.
8. Add audit rows for assignment create/end/revoke.
9. Add eligible/temporary role activation.
10. Phase out direct use of `campaign_members.role` in API authorization.
