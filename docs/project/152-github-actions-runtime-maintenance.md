# 152 - GitHub Actions runtime maintenance

Date: 2026-06-29

## Goal

Remove GitHub Actions runtime deprecation warnings before they become production noise.

A safe storage-cleanup dry-run showed warnings about official actions still targeting deprecated Node.js runtimes. The workflows now use current official major versions checked from the upstream GitHub repositories.

## Updated actions

- `actions/checkout`: `v4` -> `v7`
- `actions/setup-node`: `v4` -> `v6`
- `actions/setup-python`: `v5` -> `v6`
- `actions/upload-artifact`: `v4` -> `v7`

## Scope

Updated workflows:

- `ci.yml`
- `speech-slices-worker.yml`
- `transcription-worker.yml`
- `review-generation-worker.yml`
- `storage-cleanup-worker.yml`

## Verification

Local validation:

```text
python yaml.safe_load for every .github/workflows/*.yml
```

After push, CI should validate whether the new action versions work in this repository.
