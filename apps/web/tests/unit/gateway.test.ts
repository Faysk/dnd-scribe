import { describe, expect, it } from 'vitest'

import { buildLegacyFallbackRewrites, parseLegacyGatewayOrigin } from '../../lib/gateway'

describe('legacy gateway', () => {
  it('aceita somente origem HTTPS estável e sem path', () => {
    expect(parseLegacyGatewayOrigin('https://dnd-scribe-amber.vercel.app')).toBe('https://dnd-scribe-amber.vercel.app')
    expect(parseLegacyGatewayOrigin('https://dnd-scribe-amber.vercel.app/')).toBe('https://dnd-scribe-amber.vercel.app')
    expect(parseLegacyGatewayOrigin('http://dnd-scribe-amber.vercel.app')).toBeNull()
    expect(parseLegacyGatewayOrigin('https://dnd-scribe-amber.vercel.app/api')).toBeNull()
    expect(parseLegacyGatewayOrigin('https://dnd.faysk.dev')).toBeNull()
    expect(parseLegacyGatewayOrigin(undefined)).toBeNull()
  })

  it('mantém o passthrough como fallback e preserva paths críticos', () => {
    const rewrites = buildLegacyFallbackRewrites('https://dnd-scribe-amber.vercel.app')

    expect(rewrites).toContainEqual({
      source: '/assets/sessions/:path*',
      destination: 'https://dnd-scribe-amber.vercel.app/assets/sessions/:path*',
    })
    expect(rewrites).toContainEqual({
      source: '/api/:path*',
      destination: 'https://dnd-scribe-amber.vercel.app/api/:path*',
    })
    expect(rewrites).toContainEqual({
      source: '/edit/:path*',
      destination: 'https://dnd-scribe-amber.vercel.app/edit/:path*',
    })
    expect(rewrites).toContainEqual({
      source: '/central-local/:path*',
      destination: 'https://dnd-scribe-amber.vercel.app/central-local/:path*',
    })
    expect(rewrites).toContainEqual({
      source: '/docs/api/:path*',
      destination: 'https://dnd-scribe-amber.vercel.app/docs/api/:path*',
    })
  })

  it('não cria proxy genérico para todo o namespace de assets', () => {
    const rewrites = buildLegacyFallbackRewrites('https://dnd-scribe-amber.vercel.app')
    expect(rewrites.some((rewrite) => rewrite.source === '/assets/:path*')).toBe(false)
  })

  it('desabilita gateway quando a origem não é segura', () => {
    expect(buildLegacyFallbackRewrites(undefined)).toEqual([])
    expect(buildLegacyFallbackRewrites('https://dnd.faysk.dev')).toEqual([])
  })
})
