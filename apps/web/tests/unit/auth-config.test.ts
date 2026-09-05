import { describe, expect, it } from 'vitest'

import {
  canRenderUnconfiguredPreview,
  hasConfiguredLegacyOrigin,
  parseLegacyOrigin,
  readPublicSupabaseConfig,
} from '../../lib/config'

describe('auth configuration', () => {
  it('rejects the movable public domain as BFF upstream', () => {
    expect(() => parseLegacyOrigin('https://dnd.faysk.dev')).toThrow('domínio público')
  })

  it('accepts a dedicated HTTPS legacy origin', () => {
    expect(parseLegacyOrigin('https://legacy.example.com')).toBe('https://legacy.example.com')
    expect(hasConfiguredLegacyOrigin('https://legacy.example.com')).toBe(true)
  })

  it('fails closed when the public-data upstream is absent or movable', () => {
    expect(hasConfiguredLegacyOrigin(undefined)).toBe(false)
    expect(hasConfiguredLegacyOrigin('https://dnd.faysk.dev')).toBe(false)
    expect(hasConfiguredLegacyOrigin('http://legacy.example.com')).toBe(false)
  })

  it('returns null when public Supabase settings are incomplete or malformed', () => {
    expect(readPublicSupabaseConfig('', '')).toBeNull()
    expect(readPublicSupabaseConfig('ftp://localhost:54321', 'key')).toBeNull()
    expect(readPublicSupabaseConfig('https://project.supabase.co/path', 'key')).toBeNull()
    expect(readPublicSupabaseConfig('https://project.supabase.co/?debug=1', 'key')).toBeNull()
    expect(readPublicSupabaseConfig('https://user:pass@project.supabase.co', 'key')).toBeNull()
    expect(readPublicSupabaseConfig('https://project.supabase.co', '   ')).toBeNull()
  })

  it('accepts HTTPS and local HTTP Supabase origins only', () => {
    expect(readPublicSupabaseConfig('https://project.supabase.co/', ' publishable-key ')).toEqual({
      url: 'https://project.supabase.co',
      publishableKey: 'publishable-key',
    })
    expect(readPublicSupabaseConfig('http://localhost:54321', 'key')).toEqual({
      url: 'http://localhost:54321',
      publishableKey: 'key',
    })
    expect(readPublicSupabaseConfig('http://[::1]:54321', 'key')).toEqual({
      url: 'http://[::1]:54321',
      publishableKey: 'key',
    })
  })

  it('allows unconfigured technical preview only outside production', () => {
    expect(canRenderUnconfiguredPreview('development')).toBe(true)
    expect(canRenderUnconfiguredPreview('test')).toBe(true)
    expect(canRenderUnconfiguredPreview('production')).toBe(false)
  })
})
