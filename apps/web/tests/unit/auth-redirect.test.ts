import { describe, expect, it } from 'vitest'

import { safeRedirectPath } from '../../lib/auth/redirect'

describe('safeRedirectPath', () => {
  it('keeps same-origin relative destinations', () => {
    expect(safeRedirectPath('/sessoes?from=login')).toBe('/sessoes?from=login')
  })

  it('rejects absolute and protocol-relative redirects', () => {
    expect(safeRedirectPath('https://evil.example')).toBe('/')
    expect(safeRedirectPath('//evil.example')).toBe('/')
  })
})
