# Discord cost command

Date: 2026-06-27

## Goal

Expose the AI/audio cost guardrails directly in Discord, so the DM can check cost readiness before any paid transcription run.

## Implemented command

Added `/dnd custos`.

The command returns an ephemeral response with:

- transcription model and prompt version;
- billable minutes;
- speech-slice minutes;
- fallback chunk minutes;
- total work units;
- transcription candidates;
- cache hits;
- missing hashes;
- usage ledger estimated/actual cost;
- warnings for blockers or cost risks.

No new OpenAI request is made by this command. It only reads Supabase state.

## Files changed

- `scripts/register-discord-commands.js`
  - Adds the `custos` subcommand under `/dnd`.
- `lib/discord-interactions.js`
  - Adds the cost summary query and response.
- `api/ai-cost.js`
  - Updates the Discord interactions health command list.

## Validation

Local handler result:

```text
Custos - Sessao Craig AdabEqbzngmT
Minutos cobraveis: 54.752
Work units: 603
Cache hits: 0
Hashes faltando: 0
Ledger: 0 lancamentos
```

Discord command registration:

```json
{
  "status": 200,
  "dndOptions": ["status", "custos", "nota", "vincular"]
}
```

Checks run:

```bash
npm run check:api
npm run check:workers
npm run check:web
npm run build
```

## Next step

After deploy, smoke test `GET /api/discord/interactions` and ask the DM to run `/dnd custos` visually in Discord once.

## Production deploy validation

Commit deployed to production:

- `8c674ab` - `feat(discord): add cost summary command`
- Vercel deployment state: `READY`

Production smoke checks:

- `GET /api/discord/interactions`: 200, command list includes `/dnd custos`.
- `GET /api/ai-cost?sourceSessionId=craig-AdabEqbzngmT-stage1-full`: 200.
- Runtime logs: no `error` or `fatal` logs found after deploy.

Current production cost snapshot:

- Billable audio minutes: `54.752`
- Work units: `603`
- Cache hits: `0`
- Missing hashes: `0`
- Ledger entries: `0`
