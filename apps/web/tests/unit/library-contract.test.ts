import { describe, expect, it } from 'vitest'

import { parseLibrarySessionsPayload } from '../../lib/api/contracts/library'

describe('parseLibrarySessionsPayload', () => {
  it('normaliza o contrato real usado pelo catálogo', () => {
    const payload = parseLibrarySessionsPayload({
      ok: true,
      campaignSlug: 'yuhara-main',
      sessions: [{
        sourceSessionId: 'sessao-1',
        title: 'A ponte',
        sessionDate: '2026-09-01',
        arc: 'Euclix',
        status: 'published',
        durationMs: 7_200_000,
        summary: 'Uma memória curta.',
        hasSummary: true,
        coverImageUrl: 'https://dnd.faysk.dev/cover.webp',
        heroImageUrl: 'http://unsafe.example/hero.webp',
        segments: '120',
        participants: 4,
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-02T10:00:00Z',
      }],
    })

    expect(payload.sessions).toHaveLength(1)
    expect(payload.sessions[0]).toMatchObject({
      sourceSessionId: 'sessao-1',
      segments: 120,
      participants: 4,
      coverImageUrl: 'https://dnd.faysk.dev/cover.webp',
      heroImageUrl: '',
    })
  })

  it('rejeita sessões sem identificador estável', () => {
    expect(() => parseLibrarySessionsPayload({
      ok: true,
      campaignSlug: 'yuhara-main',
      sessions: [{ title: 'Sem id' }],
    })).toThrow(/identificador/i)
  })

  it('rejeita envelopes sem sucesso ou campanha', () => {
    expect(() => parseLibrarySessionsPayload({ ok: false, campaignSlug: 'yuhara-main', sessions: [] })).toThrow(/inválida/i)
    expect(() => parseLibrarySessionsPayload({ ok: true, sessions: [] })).toThrow(/campanha/i)
  })
})
