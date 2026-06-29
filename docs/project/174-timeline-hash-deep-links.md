# Timeline hash deep links

Date: 2026-06-29
Status: implemented

## Goal

Let copied timeline markers point back to the exact session and selected item without adding a new route or backend dependency.

## Hash format

The app now understands:

```text
#timeline?sourceSessionId=<session>&itemId=<item>
```

## What changed

- Copied timeline markers now include a direct link.
- On campaign load, the app checks the hash before choosing the default session.
- If the hash session exists, the app opens the Timeline tab and loads that session.
- When timeline data loads, the requested item id is selected if it exists.
- `hashchange` is handled, so changing/pasting a timeline hash while the app is open can move to that session/item.

## Why this is safe

- Uses URL hash only.
- No Vercel routing change.
- No API contract change.
- No database change.
- No auth bypass: the user still has to log in and pass existing permissions.

## Future improvement

Add a copied marker preview or a dedicated share button once timeline item routing is tested with real sessions and user roles.
