import { describe, expect, it } from 'vitest'

import { parseSessionSummaryPayload } from '../../lib/api/contracts/summary'

describe('session summary contract', () => {
  it('preserva o Markdown publicado e normaliza imagens HTTPS', () => {
    const payload = parseSessionSummaryPayload({
      ok: true,
      session: {
        sourceSessionId: 'sessao-42',
        title: 'A memória',
        sessionDate: '2026-09-04',
        arc: 'Euclix',
        summary: 'Resumo curto',
        summaryFull: '# Capítulo\n\n**Memória**',
        hasSummary: true,
        coverImageUrl: 'https://dnd.faysk.dev/cover.webp',
        heroImageUrl: 'http://example.com/hero.webp',
        updatedAt: '2026-09-04T18:00:00Z',
      },
    })

    expect(payload.session.summaryFull).toContain('**Memória**')
    expect(payload.session.coverImageUrl).toBe('https://dnd.faysk.dev/cover.webp')
    expect(payload.session.heroImageUrl).toBe('')
  })

  it('rejeita payload sem sessão ou envelope de sucesso', () => {
    expect(() => parseSessionSummaryPayload({ ok: true })).toThrow(/resumo/i)
    expect(() => parseSessionSummaryPayload({ ok: false, session: {} })).toThrow(/inválida/i)
  })

  it('rejeita resumo completo além do limite legado publicado', () => {
    expect(() => parseSessionSummaryPayload({
      ok: true,
      session: {
        sourceSessionId: 'sessao-42',
        title: 'A memória',
        summaryFull: 'x'.repeat(125_001),
      },
    })).toThrow(/summaryFull/i)
  })
})
