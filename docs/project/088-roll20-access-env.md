# Roll20 access env

Date: 2026-06-27

## Goal

Prepare a safe local Roll20 operator configuration so the project can use a dedicated Roll20 account instead of the user's main account.

## Local env organization

The credentials were converted from loose pasted text in `.env.local` into structured variables:

```env
ROLL20_OPERATOR_FIRST_NAME=""
ROLL20_OPERATOR_LAST_NAME=""
ROLL20_OPERATOR_EMAIL=""
ROLL20_OPERATOR_PASSWORD=""
ROLL20_JOIN_URL=""
ROLL20_GAME_ID=""
ROLL20_INVITE_CODE=""
ROLL20_COMMAND_PREFIX="!dnd"
```

Real values are intentionally stored only in `.env.local`, which is ignored by Git.

## Current game

- Join URL is stored in `ROLL20_JOIN_URL`.
- Game ID is stored in `ROLL20_GAME_ID`.
- Invite code is stored in `ROLL20_INVITE_CODE`.
- Preferred Roll20 command prefix is `!dnd`.

## Access model

Use the dedicated Roll20 operator account for automation and setup work.

Do not use or store the user's personal Roll20 account password in project files.

## Next steps

1. Confirm whether the game owner has Roll20 Pro.
2. If Pro is available, prepare the Roll20 Mods/API script for `!dnd`.
3. If Pro is not available, implement the fallback import path through Chat Archive export/copy.
