import { describe, expect, it } from 'vitest'

import { boundedText, isSameOriginMutation } from '../../lib/security'

describe('security helpers', () => {
  it('rejects oversized input instead of truncating silently', () => {
    expect(boundedText('  abc  ', 3)).toBe('abc')
    expect(boundedText('abcd', 3)).toBeNull()
    expect(boundedText(null, 3)).toBe('')
  })

  it('accepts only same-origin mutation requests', () => {
    const sameOrigin = new Request('https://scribe.example/auth/logout', {
      method: 'POST',
      headers: { origin: 'https://scribe.example' },
    })
    const crossOrigin = new Request('https://scribe.example/auth/logout', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    })
    const missingOrigin = new Request('https://scribe.example/auth/logout', { method: 'POST' })

    expect(isSameOriginMutation(sameOrigin)).toBe(true)
    expect(isSameOriginMutation(crossOrigin)).toBe(false)
    expect(isSameOriginMutation(missingOrigin)).toBe(false)
  })

  it('does not trust spoofed forwarding headers as an allowed origin', () => {
    const spoofed = new Request('https://scribe.example/auth/logout', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
        'x-forwarded-host': 'evil.example',
        'x-forwarded-proto': 'https',
      },
    })

    expect(isSameOriginMutation(spoofed)).toBe(false)
  })
})
