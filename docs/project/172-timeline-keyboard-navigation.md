# Timeline keyboard navigation

Date: 2026-06-29
Status: implemented

## Goal

Make long-session review less mouse-heavy. The timeline now has previous/next buttons, but keyboard navigation makes detailed review faster once the user is focused on the timeline workspace.

## What changed

- Added a global keydown handler scoped to the `timeline` tab.
- Arrow left selects the previous visible timeline item.
- Arrow right selects the next visible timeline item.
- Home selects the first visible timeline item.
- End selects the last visible timeline item.
- The handler ignores editable targets:
  - input
  - textarea
  - select
  - button
  - contenteditable elements

## Safety

- No visible shortcut help was added to the app UI.
- No backend change.
- No storage or OpenAI cost.
- Navigation still respects the current filter/search state.

## Future improvement

If needed, add a focused review mode later with explicit keyboard help, but only after the core timeline UX is stable from real session testing.
