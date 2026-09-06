import { describe, expect, it } from 'vitest'

import { buildHealthPayload } from '../../lib/server/health'

describe('health domain payload', () => {
  it('reports deployment metadata and keeps the legacy contract fields', () => {
    const payload = buildHealthPayload({
      DND_LEGACY_ORIGIN: 'https://legacy.example.com',
      VERCEL_GIT_COMMIT_SHA: 'abc123',
      VERCEL_GIT_COMMIT_REF: 'main',
      VERCEL_ENV: 'preview',
      NODE_ENV: 'production',
    })

    expect(payload).toMatchObject({
      ok: true,
      ready: true,
      surface: 'tda-web',
      app: 'dnd-scribe-vercel',
      campaignSlug: 'yuhara-main',
      deployment: {
        commitSha: 'abc123',
        commitRef: 'main',
        environment: 'preview',
      },
      runtime: {
        supabaseConfigured: true,
        legacyOriginConfigured: true,
      },
    })
  })

  it('marks the runtime not ready when the legacy origin is invalid', () => {
    const payload = buildHealthPayload({
      DND_LEGACY_ORIGIN: 'http://example.com',
      VERCEL_GIT_COMMIT_SHA: undefined,
      VERCEL_GIT_COMMIT_REF: undefined,
      VERCEL_ENV: undefined,
      NODE_ENV: 'test',
    })

    expect(payload.ready).toBe(false)
    expect(payload.runtime.legacyOriginConfigured).toBe(false)
    expect(payload.deployment).toEqual({
      commitSha: null,
      commitRef: null,
      environment: 'test',
    })
  })
})
