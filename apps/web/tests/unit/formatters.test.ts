import { describe, expect, it } from 'vitest'

import { displaySessionTitle, formatDuration, formatSessionDate } from '../../lib/formatters'

describe('formatters de sessão', () => {
  it('mantém data estável em pt-BR', () => {
    expect(formatSessionDate('2026-09-04')).toBe('4 de setembro de 2026')
  })

  it('formata durações no padrão editorial atual', () => {
    expect(formatDuration(42 * 60_000)).toBe('42 min')
    expect(formatDuration((2 * 60 + 40) * 60_000)).toBe('2h40')
  })

  it('normaliza título técnico antigo quando existe data', () => {
    expect(displaySessionTitle('Sessão Craig 123', '2026-09-04')).toBe('Sessão de 4 de setembro de 2026')
  })
})
