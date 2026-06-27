# 089 - Roll20 access validation

Date: 2026-06-27

## Result

The Roll20 operator account can access the production campaign page:

- Campaign URL: `https://app.roll20.net/campaigns/details/19797248/dnd`
- Game ID: `19797248`
- Page title observed: `DnD | Roll20: Online virtual tabletop`
- Campaign controls visible: `Iniciar Jogo`, `Iniciar Como Jogador`, `Configuracoes`
- Operator visibility: campaign participant list includes GM-level access.

## Env contract

The local secret file keeps the Roll20 operator credentials and campaign metadata:

- `ROLL20_OPERATOR_FIRST_NAME`
- `ROLL20_OPERATOR_LAST_NAME`
- `ROLL20_OPERATOR_EMAIL`
- `ROLL20_OPERATOR_PASSWORD`
- `ROLL20_CAMPAIGN_URL`
- `ROLL20_GAME_ID`
- `ROLL20_JOIN_URL`
- `ROLL20_INVITE_CODE`
- `ROLL20_COMMAND_PREFIX`

Do not print Roll20 credentials in logs, documentation, deploy output, or automated test output. Validation scripts should only report boolean presence or redacted values.

## Current integration decision

Roll20 should be treated as an operator-assisted integration first, not as the main source of truth. The core source of truth remains the app database and Discord identity layer.

Recommended first Roll20 scope:

1. Keep `!dnd` as the command prefix for Roll20 chat/macros.
2. Add a documented macro pack that players can paste into Roll20.
3. Add a lightweight parser for exported Roll20 chat snippets before attempting full browser automation.
4. Use the operator account for validation and campaign configuration checks only.

This avoids depending on fragile browser automation for production jobs while still letting the project benefit from Roll20 chat, campaign state, and table workflows.

## Next steps

1. Inspect Roll20 campaign settings and available API/mod options from the GM account.
2. Decide whether Roll20 Pro API scripts are available for this campaign.
3. Create a first `!dnd` macro pack for notes, NPC mentions, location tags, and session markers.
4. Add a local parser fixture using copied Roll20 chat text.
5. Document the manual workflow for the DM while automation is still intentionally limited.
