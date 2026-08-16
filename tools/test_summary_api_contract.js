'use strict';

const assert = require('node:assert/strict');
const summaryApi = require('../lib/summary-api');

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), String(value));
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
    end(body = '') {
      this.body = body == null ? '' : String(body);
      this.ended = true;
      return this;
    },
    headers,
    ended: false,
  };
}

function request({ token = '', accept = 'application/json', etag = '' } = {}) {
  const headers = { accept };
  if (token) headers.authorization = `Bearer ${token}`;
  if (etag) headers['if-none-match'] = etag;
  return { headers };
}

function fakeDb(expectedHash) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes('from external_api_keys k')) {
        assert.equal(params[0], expectedHash);
        return {
          rows: [{
            api_key_id: '11111111-1111-4111-8111-111111111111',
            key_prefix: 'dnd_live_test',
            scopes: ['summaries:read'],
            client_id: '22222222-2222-4222-8222-222222222222',
            client_name: 'Contract test',
            campaign_id: '33333333-3333-4333-8333-333333333333',
            campaign_slug: 'yuhara-main',
          }],
        };
      }
      if (sql.includes('update external_api_keys') && sql.includes('rate_window_count')) {
        return {
          rows: [{
            request_count: 1,
            window_start: new Date('2026-08-16T20:00:00.000Z'),
            reset_at: new Date('2026-08-16T20:01:00.000Z'),
          }],
        };
      }
      if (sql.includes('s.source_session_id = $2')) {
        assert.equal(params[1], 'session-test-1');
        return {
          rows: [{
            source_session_id: 'session-test-1',
            title: 'Sessão de teste',
            session_date: '2026-08-15',
            arc: 'Integração',
            summary_short: 'Descrição curta.',
            summary_full: '# Sessão de teste\n\nConteúdo publicado.',
            metadata: {
              coverImageUrl: 'https://example.invalid/cover.webp',
              heroImageUrl: 'https://example.invalid/hero.webp',
            },
            updated_at: new Date('2026-08-16T19:30:00.000Z'),
          }],
        };
      }
      if (sql.includes('from sessions s')) {
        return {
          rows: [{
            source_session_id: 'session-test-1',
            title: 'Sessão de teste',
            session_date: '2026-08-15',
            arc: 'Integração',
            summary_short: 'Descrição curta.',
            updated_at: new Date('2026-08-16T19:30:00.000Z'),
          }],
        };
      }
      throw new Error(`Unexpected SQL in contract test: ${sql.slice(0, 120)}`);
    },
  };
}

async function callExternal(path, options = {}) {
  const generated = options.generated || summaryApi.generateApiKey();
  const db = options.db || fakeDb(generated.hash);
  const res = responseRecorder();
  const handled = await summaryApi.handleSummaryApiGet(
    options.req || request({ token: generated.secret, accept: options.accept, etag: options.etag }),
    res,
    path,
    options.query || new URLSearchParams(),
    {
      getPool: () => db,
      requirePermission: async () => { throw new Error('management auth should not run'); },
      sendJson: () => { throw new Error('internal JSON writer should not run'); },
      defaultCampaign: 'yuhara-main',
    }
  );
  return { generated, db, res, handled };
}

async function main() {
  {
    const res = responseRecorder();
    const handled = await summaryApi.handleSummaryApiGet(
      request(),
      res,
      '/api/v1/health',
      new URLSearchParams(),
      {
        getPool: () => { throw new Error('health must not touch DB'); },
        requirePermission: async () => {},
        sendJson: () => {},
        defaultCampaign: 'yuhara-main',
      }
    );
    assert.equal(handled, true);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'ok');
    assert.equal(body.apiVersion, 'v1');
  }

  {
    const generated = summaryApi.generateApiKey();
    const db = fakeDb(generated.hash);
    const res = responseRecorder();
    await summaryApi.handleSummaryApiGet(
      request(),
      res,
      '/api/v1/summaries',
      new URLSearchParams(),
      { getPool: () => db, requirePermission: async () => {}, sendJson: () => {}, defaultCampaign: 'yuhara-main' }
    );
    assert.equal(res.statusCode, 401);
    assert.equal(JSON.parse(res.body).error.code, 'invalid_api_key');
    assert.equal(db.calls.length, 0);
  }

  {
    const { res } = await callExternal('/api/v1/summaries', {
      query: new URLSearchParams({ limit: '25', updatedAfter: '2026-08-01T00:00:00Z' }),
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.getHeader('content-type'), 'application/json; charset=utf-8');
    assert.equal(res.getHeader('x-ratelimit-limit'), '300');
    assert.ok(res.getHeader('etag'));
    const body = JSON.parse(res.body);
    assert.equal(body.object, 'list');
    assert.equal(body.apiVersion, 'v1');
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, 'session-test-1');
    assert.equal(body.data[0].summary, 'Descrição curta.');
    assert.equal(Object.hasOwn(body.data[0], 'summaryMarkdown'), false);
    assert.equal(body.pagination.limit, 25);
  }

  {
    const first = await callExternal('/api/v1/summaries/session-test-1');
    assert.equal(first.res.statusCode, 200);
    const body = JSON.parse(first.res.body);
    assert.equal(body.object, 'session_summary');
    assert.match(body.data.summaryMarkdown, /^# Sessão de teste/);
    assert.equal(body.data.coverImageUrl, 'https://example.invalid/cover.webp');
    assert.ok(first.res.getHeader('last-modified'));

    const second = await callExternal('/api/v1/summaries/session-test-1', {
      generated: first.generated,
      db: fakeDb(first.generated.hash),
      etag: first.res.getHeader('etag'),
    });
    assert.equal(second.res.statusCode, 304);
    assert.equal(second.res.body, '');
  }

  {
    const { res } = await callExternal('/api/v1/summaries/session-test-1', { accept: 'text/markdown' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.getHeader('content-type'), 'text/markdown; charset=utf-8');
    assert.equal(res.body, '# Sessão de teste\n\nConteúdo publicado.');
  }

  {
    const { res } = await callExternal('/api/v1/does-not-exist');
    assert.equal(res.statusCode, 404);
    assert.equal(JSON.parse(res.body).error.code, 'not_found');
  }

  console.log('Summary API HTTP contract tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
