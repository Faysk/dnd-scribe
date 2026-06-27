# 094 - Roll20 static preview tool

Date: 2026-06-27

## Result

A zero-cost Roll20 import preview was added as a static browser page:

```text
/roll20.html
```

Files:

- `web/roll20.html`
- `web/roll20.js`
- `web/roll20.css`

The main app links to it from the top action bar.

## Why this path

A first attempt to add `api/roll20/ingest.js` failed on Vercel because the Hobby plan limits deployments to 12 Serverless Functions. The project already uses 12 functions, so adding another API file breaks production.

Static Roll20 preview avoids that cost and limit:

- no new Serverless Function
- no database write
- no Roll20 password or browser cookie on the server
- no OpenAI cost
- no Supabase write cost

## What it does

The DM can:

1. Open `/roll20.html`.
2. Paste copied Roll20 chat text.
3. Parse `!dnd` commands locally in the browser.
4. Review normalized events and visibility.
5. Copy or download JSON for the next ingestion stage.

## Safety

The preview runs entirely in the browser. It does not send the pasted chat to the backend.

Visibility rules remain enforced in the output:

- `dm` -> `dm_only`
- `canon` -> `dm_review`
- `audio` -> `dm_review`
- `acao` and `sessao` -> `table_review`
- invalid commands -> `dm_review`

## Checks

```bash
npm run check:roll20
npm run check:web
```

## Next step

Implement `/api/roll20/ingest` inside `api/[...path].js`, not as a separate API file, so production stays within the current Vercel function limit.
