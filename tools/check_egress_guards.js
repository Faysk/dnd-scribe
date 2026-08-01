const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'web', 'app.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api', '[...path].js'), 'utf8');

function assertGuard(condition, message) {
  if (!condition) throw new Error(`Egress guard failed: ${message}`);
}

const interval = Number(app.match(/const JOB_POLL_INTERVAL_MS = ([\d_]+);/)?.[1].replaceAll('_', ''));
const cycles = Number(app.match(/const JOB_POLL_MAX_CYCLES = ([\d_]+);/)?.[1].replaceAll('_', ''));

assertGuard(interval >= 30_000, 'job polling must not run more often than every 30 seconds');
assertGuard(cycles > 0 && cycles <= 20, 'automatic polling must have a finite budget of at most 20 cycles');
assertGuard(
  app.includes("if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;"),
  'initial-session and token-refresh events must not reload campaign data'
);
assertGuard(
  app.includes('await loadJobs(true, false, true);'),
  'automatic job polls must skip the duplicate pipeline-control refresh'
);
assertGuard(
  app.includes("if (state.selectedSourceSessionId) query.set('sourceSessionId', state.selectedSourceSessionId);"),
  'job lists must be scoped to the selected session'
);
assertGuard(
  api.includes("const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(50, requestedLimit)) : 20;"),
  'the jobs API must default to 20 rows and cap requests at 50'
);
assertGuard(
  api.includes("{ limit: query.get('limit') }"),
  'the jobs route must pass its requested limit to the database query'
);

console.log(`Egress guards OK: ${interval / 1000}s interval, ${cycles} automatic cycles, 20-row API default.`);
