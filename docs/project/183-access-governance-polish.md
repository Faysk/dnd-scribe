# Access governance polish

Date: 2026-06-29
Status: implemented

## Goal

Make the Access/RBAC page start with a clear governance summary, especially because the campaign DM can change and technical administration must remain separate from narrative authority.

## What changed

- Added `Governanca da mesa` to the Access page.
- The panel summarizes:
  - safe next action
  - current DM
  - linked profiles
  - pending claims
  - active role assignments
  - technical role assignments
  - viewer campaign role
- The panel changes tone for:
  - unlinked login
  - pending claims
  - missing active DM
  - healthy governance state
- Added direct refresh buttons for access directory and RBAC admin data.

## Safety

- No API change.
- No database change.
- No permission change.
- No new dependency.
- No automatic role mutation.

## Why this matters

The role model is intentionally scoped: project roles operate infrastructure and campaign roles operate the table. A visible governance summary helps avoid confusing technical owner with current DM, and makes future DM handoff safer.

## Next recommendation

Add audit/drill-down links from the governance panel to exact pending claims, active DM tenure and role assignment rows.
