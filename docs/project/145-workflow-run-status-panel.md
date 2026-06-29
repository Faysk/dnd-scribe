# 145 - Workflow run status panel

Date: 2026-06-29

## Goal

Make production worker dispatches visible from the site.

Speech slicing, transcription, review generation and storage cleanup run outside Vercel in GitHub Actions. The operator should not need the terminal to know whether a worker was dispatched, where the run is, or whether it is still running.

## Backend

`buildPipelineControlPayload` now adds:

```json
{
  "workflowRuns": {
    "configured": true,
    "repository": "Faysk/dnd-scribe",
    "ref": "main",
    "refreshedAt": "iso-date",
    "runs": []
  }
}
```

The payload is built from `processing_jobs.output` records that contain one of:

- `dispatch`
- `githubWorkflow`
- `workflowDispatch`

Supported dispatch job types include:

- `cloud_detect_speech_slices` with `output.githubWorkflow`
- `transcription_workflow_dispatch`
- `review_generation_workflow_dispatch`
- `storage_cleanup_workflow_dispatch`

When `GITHUB_WORKFLOW_TOKEN` is configured, the API refreshes each stored run through:

```text
GET /repos/{owner}/{repo}/actions/runs/{run_id}
```

If the GitHub token is missing or a refresh fails, the panel still returns the cached run metadata saved at dispatch time.

## UI

The production pipeline panel now shows a `GitHub Actions` block with recent runs for the selected session.

For each run it shows:

- workflow name
- job type that created the dispatch
- GitHub run id
- status
- conclusion when available
- whether the row is live from GitHub or cached from the database
- link to the GitHub Actions run

The existing `Atualizar` action is enough to poll the latest state manually. No automatic interval was added in this pass to avoid noisy GitHub API usage while real sessions are still being tested.

## Safety

- This panel is read-only.
- It does not dispatch, retry or cancel workflows.
- It never returns GitHub token values.
- A failed GitHub API refresh does not break the whole pipeline panel.

## Verification

Static checks:

```text
node --check api/[...path].js
node --check web/jobs.js
npm run check:api
npm run check:web
npm run build
```

Production smoke after deploy should include:

```text
GET /api/pipeline-control?sourceSessionId=... -> authenticated operator only
GET /jobs.js -> 200
GET /api/health -> 200
```

## Next steps

1. Add a lightweight auto-refresh toggle for workflow runs while a worker is in progress.
2. Add Discord ops notifications when a workflow starts, succeeds or fails.
3. Add session-level incident timeline that merges upload, job controls and workflow run events.
4. Persist live workflow status back into `processing_jobs.output` if repeated operator refreshes prove useful.
