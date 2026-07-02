# 199 - Review run id alignment

Date: 2026-07-02

## Context

The real production E2E upload reached `ready_for_review`, but the supervisor dry-run still reported:

```text
stage=review_generation_ready
action=dispatch_review_generation
```

The database showed the session had already been reviewed under:

```text
source_run_id=classify_candidates_v2_gpt-5.4-mini
model=gpt-5.4-mini
```

But the web/API defaults still inspected:

```text
source_run_id=classify_candidates_v2_gpt-4o
```

That made the pipeline appear unfinished even after the real review worker completed.

## Fix

Aligned executable defaults to the production review worker:

```text
classify_candidates_v2_gpt-5.4-mini
```

Touched:

- `api/[...path].js`
- `web/app.js`
- `tools/serve_frontend.py`
- `tools/run_review_publication_cycle.py`
- `tools/export_review_decision_template.py`
- `tools/export_review_board_data.py`

The API review generation default model fallback is also aligned to:

```text
gpt-5.4-mini
```

## Verification

Checks:

```text
npm run check
npm run build
```

Supervisor dry-run against the real session:

```text
sourceSessionId=manual-2026-07-01-20260701-sessao-235100
stage=complete
pendingTranscription=0
pendingReview=0
cleanupBytes=0
```

## Result

The real E2E upload is no longer falsely reported as pending review.
