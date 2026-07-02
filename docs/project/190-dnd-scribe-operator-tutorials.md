# DnD Scribe operator tutorials

Date: 2026-07-01
Status: implemented

## Goal

Turn the DnD Scribe production workflow into clear tutorials for the DM,
operator/admin and table helpers. The system already has many technical docs,
but real table use needs direct operational guidance:

- what to do before the session;
- what to do during the session;
- what to do after the session;
- how to recover when something breaks;
- what success looks like at every step.

The site now includes a `Tutoriais` tab with quick actions and step cards.

## Roles

### DM

- Final authority for canon.
- Can read full lore context according to project permissions.
- Uses review, candidates, notes and publications.
- Can operate Roll20 bridge when needed.

### Operator/admin

- Maintains production health.
- Monitors Vercel, Supabase, R2, Discord, Roll20 bridge, jobs and cost.
- Can see technical state without needing narrative control.

### Player

- Logs in with Discord or Google.
- Reads only what their role permits.
- Does not need bridge tokens or technical secrets.

## Tutorial 1 - Prepare the session

Use before the table starts.

1. Open DnD Scribe.
2. Confirm login and role.
3. Create or select the correct session.
4. Confirm title, date and status.
5. Decide who will:
   - run Craig;
   - open Roll20 as GM;
   - operate the Roll20 bridge;
   - watch the production dashboard if needed.

Success signs:

- session exists in the site;
- DM/Owner can access `Ponte Roll20`;
- upload page can see the target session;
- everyone knows who starts/stops Craig.

## Tutorial 2 - Record with Craig

Use during the game.

1. Add Craig to the correct Discord voice channel.
2. Use `/join`.
3. Confirm Craig joined the voice channel.
4. Use `/note` for important table markers when useful.
5. At the end, use `/stop`.
6. Keep the generated ZIP.

Success signs:

- Craig produced one ZIP;
- ZIP contains separated tracks;
- session date is inferred from the recording start, even if the game crosses
  midnight.

Failure handling:

- if Craig did not join, do not assume the session is being recorded;
- if Craig stopped early, create a note in the session explaining the gap;
- if the ZIP is huge, upload page must show storage/cost risk before processing.

## Tutorial 3 - Capture Roll20 live events

Use when the GM wants Roll20 chat, dice and commands in the timeline.

The bridge has two production parts and one legacy fallback:

1. Browser extension running in the GM tab.
2. DnD Scribe API receiving authenticated batches.
3. Roll20 Mod/API script, kept quiet by default for legacy/debug.

Safe order:

1. Install/update the Mod/API script:
   `integrations/roll20/dnd-scribe-mod.js`
2. Remove duplicate old DnD Scribe Mod scripts if they exist.
3. Keep the legacy chat transport quiet:

```text
!dndscribe transport off
!dndscribe off
```

4. Load the Chrome extension from:
   `D:\Projects\dnd\integrations\roll20\chrome-extension`
5. Open `https://dnd.faysk.dev/roll20-bridge.html`.
6. Select the target session.
7. Copy token and `sourceSessionId`.
8. Open the Roll20 editor tab.
9. Click `Config` in the DnD Scribe extension panel.
10. Fill:
   - API URL: `https://dnd.faysk.dev`
   - campaign slug: `yuhara-main`
   - sourceSessionId: copied from the bridge page
   - token: copied from the bridge page
11. Confirm the panel shows `Captura: DOM direto`.
12. Optionally run `!dndscribe status` only to diagnose the Mod state.
13. Send a small test command:
    `!dnd acao teste da ponte roll20`

Success signs:

- extension panel is visible in the Roll20 editor;
- panel shows `Captura: DOM direto`;
- queue returns to zero after send;
- panel shows `ok: N novos, M atualizados`;
- DnD Scribe session receives Roll20 events.

Emergency:

If the GM sees a giant `DND_SCRIBE_EVENT:%7B...` message, the legacy chat
transport is active or an old duplicate Mod script is still running.

Immediate action:

```text
!dndscribe transport off
!dndscribe off
```

Then update the Mod to version `1.1.0` or newer, remove duplicate old scripts,
reload the extension, reload Roll20 editor, and configure again. Do not use
`!dndscribe transport on` during a normal session.

## Tutorial 4 - Upload Craig ZIP

Use after the session.

1. Open the `Upload` tab.
2. Prefer `Criar nova sessao pelo ZIP` for a new recording.
3. Select the Craig ZIP.
4. Check the storage warning and target session.
5. Upload to production.
6. Watch each pipeline step:
   - R2 upload;
   - database confirmation;
   - manifest;
   - track extraction;
   - chunks;
   - speech slicing;
   - transcription when explicitly allowed.
7. If a step fails, use the visible operator actions instead of terminal work:
   - retry;
   - continue;
   - pause;
   - archive/discard from active view when safe.

Success signs:

- ZIP object exists in R2;
- session has recording files;
- jobs move from queued/running to succeeded;
- storage dashboard shows expected usage.

Cost rule:

OpenAI cost should remain zero until paid transcription/classification is
explicitly allowed.

## Tutorial 5 - Use the timeline

Use for evidence review.

1. Open `Timeline`.
2. Use filters:
   - all;
   - speech;
   - Roll20;
   - Discord.
3. Click blocks to inspect the event.
4. Load audio only when needed.
5. Copy timeline markers for discussion.
6. Sync Discord messages when the session window is correct.

Success signs:

- speech, Roll20 and Discord share the same session context;
- timing confidence is visible;
- overlapped speakers are visible as separate stacked items;
- audio can be loaded for evidence segments.

## Tutorial 6 - Review and canon

Use after transcription and timeline review.

1. Open `Review`.
2. Check segments needing review.
3. Open `Candidatos`.
4. Review canon, quotes, outtakes and session notes.
5. Convert Roll20 events to notes when they matter.
6. Apply decisions only when confident.
7. Keep DM as final canon authority.

Success signs:

- decisions are saved;
- candidates have status;
- notes can trace back to source evidence;
- owner_only or restricted items stay restricted by role.

## Tutorial 7 - Publications

Use when generating readable outputs.

1. Open `Publicacoes`.
2. Check the source audit panel.
3. Prefer publications with direct source references.
4. Rebuild only when the review state is ready.
5. Treat source gaps as manual audit tasks.

Success signs:

- publications show source links when possible;
- review-only material is not confused with public-facing output;
- canon remains DM-approved.

## Tutorial 8 - Production monitoring

Use whenever something feels slow, stuck or expensive.

1. Open `Operacao`.
2. Check critical cards first:
   - auth;
   - database;
   - R2;
   - Discord;
   - Roll20 bridge;
   - Vercel;
   - cron/supervisor;
   - jobs;
   - OpenAI cost.
3. Open drilldowns for failed services.
4. Use retry/continue only when the UI says the action is safe.

Success signs:

- no critical checks red;
- jobs have clear next action;
- R2 is within storage budget;
- paid AI steps require explicit confirmation.

## Site changes

- Added top action `Tutoriais`.
- Added tab `Tutoriais`.
- Added tutorial cards for:
  - preparing the session;
  - Craig;
  - Roll20 bridge;
  - ZIP upload;
  - timeline;
  - review/canon/publication;
  - production monitoring;
  - Roll20 packet emergency.
- Improved `/roll20-bridge.html` with safer setup order.
- Improved bridge config copy panel wording.

## Next polish

1. Add a dedicated `/tutorials.html` public/private page if the tab becomes too
   dense.
2. Add per-role tutorial filtering: DM, operator, player.
3. Add visual completion states using real production checks.
4. Add short video/GIF references after the first real test.
5. Add one-click extension config import when browser extension UI supports it.
