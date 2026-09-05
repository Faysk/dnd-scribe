import { describe, expect, it } from 'vitest'

import {
  parsePublicSessionPayload,
  parsePublicSessionsPayload,
} from '../../lib/api/contracts/public-library'

describe('contrato da memória pública', () => {
  it('aceita somente os campos editoriais previstos no catálogo', () => {
    const payload = parsePublicSessionsPayload({
      ok: true,
      campaignSlug: 'yuhara-main',
      sessions: [{
        sourceSessionId: 'sessao-1',
        title: 'A ponte',
        sessionDate: '2026-09-01',
        arc: 'Euclix',
        summary: 'Uma memória curta.',
        hasSummary: true,
        coverImageUrl: 'https://dnd.faysk.dev/assets/sessions/cover.webp',
        heroImageUrl: 'https://dnd.faysk.dev/assets/sessions/hero.webp',
        updatedAt: '2026-09-02T10:00:00Z',
        segments: 999,
        participants: 5,
        durationMs: 7_200_000,
      }],
    })

    expect(payload.sessions[0]).toEqual({
      sourceSessionId: 'sessao-1',
      title: 'A ponte',
      sessionDate: '2026-09-01',
      arc: 'Euclix',
      summary: 'Uma memória curta.',
      hasSummary: true,
      coverImageUrl: 'https://dnd.faysk.dev/assets/sessions/cover.webp',
      heroImageUrl: 'https://dnd.faysk.dev/assets/sessions/hero.webp',
    })
    expect(payload.sessions[0]).not.toHaveProperty('updatedAt')
    expect(payload.sessions[0]).not.toHaveProperty('segments')
    expect(payload.sessions[0]).not.toHaveProperty('participants')
    expect(payload.sessions[0]).not.toHaveProperty('durationMs')
  })

  it('aceita o resumo completo somente no detalhe público', () => {
    const payload = parsePublicSessionPayload({
      ok: true,
      campaignSlug: 'yuhara-main',
      session: {
        sourceSessionId: 'sessao-1',
        title: 'A ponte',
        sessionDate: '2026-09-01',
        arc: 'Euclix',
        summary: 'Curto.',
        summaryFull: '# Memória\n\nCompleta.',
        hasSummary: true,
        coverImageUrl: '',
        heroImageUrl: '',
        updatedAt: '2026-09-02T10:00:00Z',
      },
    })

    expect(payload.session.summaryFull).toContain('Memória')
    expect(payload.session).not.toHaveProperty('updatedAt')
  })

  it('rejeita envelopes, ids e resumos fora do contrato', () => {
    expect(() => parsePublicSessionsPayload({ ok: false, campaignSlug: 'yuhara-main', sessions: [] })).toThrow(/inválida/i)
    expect(() => parsePublicSessionsPayload({ ok: true, campaignSlug: 'yuhara-main', sessions: [{ title: 'Sem id' }] })).toThrow(/identificador/i)
    expect(() => parsePublicSessionPayload({
      ok: true,
      campaignSlug: 'yuhara-main',
      session: {
        sourceSessionId: 'sessao-1',
        title: 'A ponte',
        summaryFull: 'x'.repeat(1_000_001),
      },
    })).toThrow(/resumo completo/i)
  })
})
