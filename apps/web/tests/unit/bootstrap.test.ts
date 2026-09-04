import { describe, expect, it } from 'vitest'

import { bootstrapContent } from '../../lib/bootstrap'

describe('bootstrapContent', () => {
  it('keeps the bootstrap clearly marked as a technical preview', () => {
    expect(bootstrapContent.title).toContain('Preview técnico')
    expect(bootstrapContent.status).toContain('Fase 3')
  })
})
