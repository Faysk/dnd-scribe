import { describe, expect, it } from 'vitest'

import { canRenderUnconfiguredPreview, parseLegacyOrigin, readPublicSupabaseConfig } from '../../lib/config'

describe('auth configuration', () => {
  it('rejects the movable public domain as BFF upstream', () => {
    expect(() => parseLegacyOrigin('https://dnd.faysk.dev')).toThrow('domínio público')
  })

  it('accepts a dedicated HTTPS legacy origin', () => {
    expect(parseLegacyOrigin('https://legacy.example.com')).toBe('https://legacy.example.com')
  })

  it('returns null when public Supabase settings are incomplete', () => {
    expect(readPublicSupabaseConfig('', '')).toBeNull()
  })

  it('allows unconfigured technical preview only outside production', () => {
    expect(canRenderUnconfiguredPreview('development')).toBe(true)
    expect(canRenderUnconfiguredPreview('test')).toBe(true)
    expect(canRenderUnconfiguredPreview('production')).toBe(false)
  })
})
