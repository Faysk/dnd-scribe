import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/class-names'

describe('cn', () => {
  it('joins only truthy class values in order', () => {
    expect(cn('base', false, undefined, 'active', null)).toBe('base active')
  })
})
