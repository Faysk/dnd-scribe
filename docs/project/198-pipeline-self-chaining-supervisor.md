# 198 - Pipeline self-chaining supervisor

Date: 2026-07-02

## Goal

The production Craig pipeline should not depend on an operator repeatedly clicking buttons after upload.

The supervisor still keeps cost and safety guardrails, but the pipeline now has a self-chaining path:

1. upload confirmation creates `cloud_ingest_craig`;
2. the API dispatches `pipeline-supervisor-worker.yml` after the database commit;
3. the supervisor runner calls `/api/pipeline-supervisor` in a bounded loop while zero-cost work is progressing;
4. when the supervisor dispatches a downstream worker, the runner stops;
5. the downstream worker calls the supervisor again after it succeeds;
6. cleanup can repeat until no `delete_ready` objects remain.

## New Workflow

```text
.github/workflows/pipeline-supervisor-worker.yml
```

It accepts:

```text
source_session_id
campaign
site_url
max_iterations
max_runs_per_call
approve_autopilot_paid
```

Defaults are conservative:

```text
max_iterations=12
max_runs_per_call=1
site_url=https://dnd.faysk.dev
approve_autopilot_paid=false
```

The runner stops when:

- no progress is available;
- a downstream workflow was dispatched;
- the iteration limit is reached;
- the supervisor endpoint returns an error.

## Worker Callbacks

These workflows now call the supervisor after successful real work:

```text
speech-slices-worker.yml      write=true
transcription-worker.yml      execute=true
review-generation-worker.yml  execute=true
storage-cleanup-worker.yml    execute=true
```

The callback uses:

```text
tools/trigger_pipeline_supervisor.py
```

The script prints a sanitized JSON summary and never echoes `CRON_SECRET`.

## Required GitHub Secrets

```text
CRON_SECRET
```

`DND_CRON_SECRET` is also accepted as a fallback.

The existing Vercel `GITHUB_WORKFLOW_TOKEN` dispatches the runner from the site after upload. The GitHub runner then uses `CRON_SECRET` to call the protected production endpoint.

## Safety

- Upload does not fail if the supervisor dispatch fails; the error is returned as `supervisorDispatch`.
- Worker callbacks are `continue-on-error`, so a callback outage does not mark completed transcription/review/cleanup as failed.
- The daily Vercel cron remains as a recovery layer.
- Paid autopilot still requires upload approval.
- Each supervisor call dispatches at most one workflow for a session.

## Verification

Local checks:

```text
npm run check
python3 -m py_compile tools/trigger_pipeline_supervisor.py
```

Production dry-run:

```text
python3 tools/trigger_pipeline_supervisor.py \
  --source-session-id <session> \
  --campaign yuhara-main \
  --dry-run
```

GitHub Actions validation:

```text
gh workflow run pipeline-supervisor-worker.yml \
  -f source_session_id=<session> \
  -f campaign=yuhara-main \
  -f site_url=https://dnd.faysk.dev \
  -f max_iterations=1 \
  -f max_runs_per_call=1 \
  -f approve_autopilot_paid=false
```
