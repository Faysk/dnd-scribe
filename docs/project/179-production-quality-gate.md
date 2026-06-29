# Production quality gate

Date: 2026-06-29
Status: implemented

## Goal

Reduce production risk by making the local and CI validation path a single explicit command.

Before this pass, CI ran several syntax checks separately and did not call the Roll20 check script as part of the main app checks. This made it easier for a local or CI path to drift.

## What changed

- Added `npm run check`.
- Added `npm run check:monitoring`.
- CI now runs `npm run check` as the quality gate before build.

## Current quality gate

`npm run check` runs:

- `check:web`
- `check:api`
- `check:workers`
- `check:roll20`
- `check:monitoring`

## Why this matters

The project now has multiple production-critical surfaces:

- frontend app
- upload/pipeline UI
- Roll20 bridge/review tools
- Discord integration
- monitoring/storage inventory
- serverless API routes
- worker entrypoints

A single quality gate makes it harder to accidentally validate only one part.

## Future improvement

Add a production-like authenticated browser smoke once test credentials and a stable non-destructive session fixture are available.
