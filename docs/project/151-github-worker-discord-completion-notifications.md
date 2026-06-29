# 151 - GitHub worker Discord completion notifications

Date: 2026-06-29

## Goal

Notify the Discord ops channel when long-running GitHub Actions workers finish, fail, or are cancelled.

The site already notifies Discord when a worker is dispatched from production. This step adds completion/failure visibility from the workflow itself.

## Implementation

New script:

```text
tools/notify_discord_webhook.py
```

It is dependency-free, best-effort, and exits successfully when no webhook secret is configured.

Updated workflows:

- `speech-slices-worker.yml`
- `transcription-worker.yml`
- `review-generation-worker.yml`
- `storage-cleanup-worker.yml`

Each workflow now has a final step:

```text
Notify Discord
if: always()
```

The notification includes:

- workflow name
- job status
- session id
- campaign slug
- GitHub Actions run URL
- key inputs such as execute/write/limit/batch size

## Secret

The workflows read:

```text
secrets.DND_DISCORD_WEBHOOK_URL
```

This secret was not copied automatically from local env because that is a secret transfer to another service and requires explicit operator approval.

To enable the notifications, set the GitHub secret manually:

```text
gh secret set DND_DISCORD_WEBHOOK_URL
```

Then paste the Discord webhook URL when prompted.

## Safety

- Notification failure never fails the worker.
- Missing webhook secret is logged as skipped.
- No Discord mentions are allowed.
- No project secrets are printed.
