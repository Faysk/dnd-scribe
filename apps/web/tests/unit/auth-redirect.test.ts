import { describe, expect, it } from 'vitest'

import { safeRedirectPath } from '../../lib/auth/redirect'

describe('safeRedirectPath', () => {
  it('keeps same-origin application paths', () => {
    expect(safeRedirectPath('/sessoes/abc?tab=resumo#fim')).toBe('/sessoes/abc?tab=resumo#fim')
  })

  it('rejects external, protocol-relative and oversized redirects', () => {
    expect(safeRedirectPath('https://evil.example/path')).toBe('/')
    expect(safeRedirectPath('//evil.example/path')).toBe('/')
    expect(safeRedirectPath('/\\evil.example/path')).toBe('/')
    expect(safeRedirectPath(`/${'x'.repeat(2_100)}`)).toBe('/')
  })
})
