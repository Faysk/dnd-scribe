# Roll20 bridge session setup

Status: implemented for the authenticated bridge helper page.

## Problem

The Roll20 Chrome extension needs four values during real table use:

- production URL;
- campaign slug;
- `sourceSessionId` for the active session;
- dedicated Roll20 bridge token.

The token helper page already exposed the protected token to DM/Owner, but the operator still had to find and copy the session id manually. That made real testing easy to misconfigure.

## Change

The protected `/api/roll20-bridge/config` response now includes:

- `suggestedSourceSessionId`;
- up to 8 recent sessions with date, title, status, recording file count and Roll20 event count.

The `/roll20-bridge.html` helper page now shows a session selector and copy buttons for:

- bridge token;
- selected `sourceSessionId`;
- non-secret config JSON containing `apiBase`, `campaignSlug` and `sourceSessionId`.

The token remains separate from the config copy to avoid accidentally pasting or sharing the secret together with general setup data.

## Test scope

This step does not validate the live Roll20 tab. It only improves authenticated setup and reduces chance of using the wrong session when the next real test happens.
