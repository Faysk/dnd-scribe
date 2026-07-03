# 204 - Dandelion private lore page

Date: 2026-07-03
Status: implemented

## Goal

Create the first character-specific lore workspace in the production app.

This page is focused on Dandelion and is visible only to:

- the current DM/campaign master;
- the Dandelion player account.

It is the template for future character pages where each player sees only their
own character material, while the DM can see all character spaces.

## Data source

The page reads lore from two places, in this order:

1. local `lore/` directory when available, useful for local authoring;
2. private Cloudflare R2 objects under `DND_LORE_R2_PREFIX` or `lore/`, used in production.

The local lore directory should not be committed while the GitHub repository is public. It is intentionally listed in `.gitignore`; R2 is the production source for private lore content.
The production-safe path is to sync it to private R2 with:

```text
python3 tools/sync_lore_to_r2.py --write
```

The Vercel function can still include `lore/**` for private-repo deployments, but
R2 fallback is the safer default for this project while the repository remains public.

## API

New protected routes:

```text
GET /api/lore/dandelion
GET /api/lore/asset?file=<relative-image-path>
```

Both routes require a valid Supabase Auth session. Access is checked on the
server, not only in the browser.

The Dandelion reader check currently allows:

- `owner` or `master` campaign role;
- campaign member whose profile/auth identity maps to `Dandelion` or `faysk`.

## Frontend

New app tab:

```text
Lore
```

The tab is hidden unless the authenticated viewer can read Dandelion lore. The
page shows:

- hero/identity panel;
- document/session/image stats;
- searchable filters by lore group;
- session/review documents imported from DnD Scribe;
- protected gallery loaded through authenticated `fetch` and browser object URLs;
- document cards with summary, headings and preview.

Images are not exposed as public `/public` assets. They are loaded through the
protected API so a raw URL does not bypass character permissions.

## Current limitation

This first version is read-only and uses a code-level character mapping. The
next better version should move character ownership to the database, for example:

```text
character_profiles
character_lore_permissions
```

That will let the DM assign or transfer character-page access without code
changes.

## Sync command

Dry run:

```text
python3 tools/sync_lore_to_r2.py
```

Upload to R2:

```text
python3 tools/sync_lore_to_r2.py --write
```

Optional prefix override:

```text
python3 tools/sync_lore_to_r2.py --prefix lore/dandelion --write
```
