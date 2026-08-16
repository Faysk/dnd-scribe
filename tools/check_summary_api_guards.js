'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const summaryApi = require('../lib/summary-api');

const root = path.resolve(__dirname, '..');

function expectThrow(fn, label) {
  let threw = false;
  try {
    fn();
  } catch (_error) {
    threw = true;
  }
  assert.equal(threw, true, label);
}

const generated = summaryApi.generateApiKey();
assert.match(generated.secret, /^dnd_live_[A-Za-z0-9_-]{40,}$/);
assert.equal(generated.hash, summaryApi.hashApiKey(generated.secret));
assert.equal(generated.hash.length, 64);
assert.equal(generated.prefix.startsWith('dnd_live_'), true);
assert.equal(generated.prefix.includes(generated.secret.slice(0, 12)), true);

const cursorPayload = { updatedAt: '2026-08-16T19:30:00.000Z', id: 'Svz6mvN0cBUk' };
const cursor = summaryApi.encodeCursor(cursorPayload);
assert.deepEqual(summaryApi.decodeCursor(cursor), cursorPayload);
expectThrow(() => summaryApi.decodeCursor('%%%nao-e-cursor%%%'), 'invalid cursor must fail');

assert.equal(summaryApi.parseLimit(null), 50);
assert.equal(summaryApi.parseLimit('100'), 100);
assert.equal(summaryApi.parseLimit('999'), 100);
expectThrow(() => summaryApi.parseLimit('0'), 'zero limit must fail');
expectThrow(() => summaryApi.parseLimit('abc'), 'non-numeric limit must fail');

assert.equal(summaryApi.wantsMarkdown({ headers: { accept: 'text/markdown' } }), true);
assert.equal(summaryApi.wantsMarkdown({ headers: { accept: 'application/json, text/plain' } }), false);
assert.equal(summaryApi.SUMMARY_SCOPE, 'summaries:read');
assert.equal(summaryApi.RATE_LIMIT_PER_MINUTE, 300);

const catchall = fs.readFileSync(path.join(root, 'api', '[...path].js'), 'utf8');
assert.match(catchall, /handleSummaryApiGet/);
assert.match(catchall, /handleSummaryApiPost/);
assert.match(catchall, /require\('\.\.\/lib\/summary-api'\)/);

const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20260816195300_summary_api_v1.sql'),
  'utf8'
);
for (const table of ['external_api_clients', 'external_api_keys']) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(migration, new RegExp(`revoke all privileges on public\\.${table}`));
}
assert.match(migration, /key_hash char\(64\) not null unique/);
assert.match(migration, /rate_window_start timestamptz/);
assert.match(migration, /rate_window_count integer not null default 0/);
assert.doesNotMatch(migration, /external_api_usage_windows/);
assert.doesNotMatch(migration, /key_secret|secret_key|plaintext/i);

const docs = fs.readFileSync(path.join(root, 'docs', 'API_RESUMOS_V1.md'), 'utf8');
assert.match(docs, /GET \/api\/v1\/summaries/);
assert.match(docs, /Accept: text\/markdown/);
assert.match(docs, /updatedAfter/);
assert.match(docs, /If-None-Match/);
assert.match(docs, /300 requests \/ minuto/);

const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const rewriteMap = new Map((vercel.rewrites || []).map(item => [item.source, item.destination]));
assert.equal(rewriteMap.get('/api/v1/health'), '/api/summary-api-v1?summaryApiRoute=health');
assert.equal(rewriteMap.get('/api/v1/summaries'), '/api/summary-api-v1?summaryApiRoute=summaries');
assert.equal(rewriteMap.get('/api/v1/summaries/:id'), '/api/summary-api-v1?summaryApiRoute=detail&summaryId=:id');
assert.equal(rewriteMap.get('/api/integrations/api-keys'), '/api/integration-api-keys');

const openapi = fs.readFileSync(path.join(root, 'web', 'openapi-summary-v1.yaml'), 'utf8');
assert.match(openapi, /openapi: 3\.1\.0/);
assert.match(openapi, /\/api\/v1\/summaries:/);
assert.match(openapi, /\/api\/v1\/summaries\/\{id\}:/);
assert.match(openapi, /bearerApiKey/);

console.log('Summary API guard checks passed.');
