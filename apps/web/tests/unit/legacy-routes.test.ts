import { describe, expect, it } from 'vitest'

import { legacyHashDestination } from '../../lib/legacy-routes'

describe('legacyHashDestination', () => {
  it('leva o link antigo de resumo para a nova rota principal', () => {
    expect(legacyHashDestination('#/sessao/sessao-42/resumo')).toBe('/sessoes/sessao-42')
  })

  it('leva o link antigo padrão para a transcrição secundária', () => {
    expect(legacyHashDestination('#/sessao/sessao-42')).toBe('/sessoes/sessao-42/transcricao')
  })

  it('ignora hashes que não pertencem ao reader legado', () => {
    expect(legacyHashDestination('#/qualquer-coisa')).toBeNull()
  })
})
