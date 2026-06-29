#!/usr/bin/env node

const DEFAULT_BASE_URL = 'https://dnd.faysk.dev';

const routes = [
  { path: '/api/auth-config', expected: [200], label: 'auth config' },
  { path: '/api/health', expected: [200], label: 'health' },
  { path: '/api/monitoring', expected: [401], label: 'monitor protegido' },
  { path: '/api/roll20-bridge/config', expected: [401], label: 'roll20 config protegida' },
  { path: '/api/pipeline-control?sourceSessionId=route-smoke', expected: [401], label: 'pipeline protegido' }
];

function normalizeBaseUrl(value) {
  const raw = String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

async function probe(baseUrl, route) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${route.path}`, {
    method: 'GET',
    headers: { 'user-agent': 'dnd-scribe-route-smoke/1.0' }
  });
  return {
    ...route,
    status: response.status,
    ok: route.expected.includes(response.status),
    ms: Date.now() - startedAt
  };
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.argv[2] || process.env.DND_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL);
  const checks = [];
  for (const route of routes) {
    try {
      checks.push(await probe(baseUrl, route));
    } catch (error) {
      checks.push({ ...route, status: null, ok: false, ms: null, error: error.message || String(error) });
    }
  }
  const failed = checks.filter(item => !item.ok);
  for (const check of checks) {
    const expected = check.expected.join('/');
    const status = check.status === null ? 'ERROR' : check.status;
    const suffix = check.error ? ` ${check.error}` : '';
    console.log(`${check.ok ? 'ok' : 'fail'} ${status} expected=${expected} ${check.path} ${check.ms ?? '-'}ms${suffix}`);
  }
  if (failed.length) {
    console.error(`route smoke failed: ${failed.length}/${checks.length}`);
    process.exit(1);
  }
  console.log(`route smoke ok: ${checks.length}/${checks.length} ${baseUrl}`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
