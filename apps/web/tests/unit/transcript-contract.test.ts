import { describe, expect, it } from 'vitest'

import { parseTranscriptPayload, TRANSCRIPT_PAGE_SIZE } from '../../lib/api/contracts/transcript'

function segment(index: number) {
  return {
    id: `segment-${index}`,
    startMs: index * 1000,
    endMs: index * 1000 + 500,
    speaker: 'Dandelion',
    text: `Fala ${index}`,
  }
}

function payload(segments = [segment(1)]) {
  return {
    ok: true,
    session: {
      sourceSessionId: 'session-1',
      title: 'Uma memória',
      sessionDate: '2026-09-04',
      arc: 'Arco',
      status: 'published',
      durationMs: 1000,
      summary: 'Resumo',
      hasSummary: true,
      coverImageUrl: '',
      heroImageUrl: '',
      updatedAt: '2026-09-04T00:00:00Z',
    },
    segments,
    speakers: ['Dandelion'],
    total: segments.length,
    nextCursor: null,
  }
}

describe('transcript contract', () => {
  it('accepts a bounded legacy transcript page', () => {
    const parsed = parseTranscriptPayload(payload())
    expect(parsed.segments).toHaveLength(1)
    expect(parsed.speakers).toEqual(['Dandelion'])
  })

  it('rejects an upstream page larger than the client contract', () => {
    const oversized = Array.from({ length: TRANSCRIPT_PAGE_SIZE + 1 }, (_, index) => segment(index))
    expect(() => parseTranscriptPayload(payload(oversized))).toThrow('tamanho máximo de página')
  })

  it('rejects an oversized cursor before it reaches client state', () => {
    expect(() => parseTranscriptPayload({ ...payload(), nextCursor: 'x'.repeat(1201) })).toThrow('cursor')
  })

  it('rejects an unsuccessful or missing upstream envelope', () => {
    expect(() => parseTranscriptPayload({ ...payload(), ok: false })).toThrow('Resposta inválida')
    const { ok: _ok, ...withoutOk } = payload()
    expect(() => parseTranscriptPayload(withoutOk)).toThrow('Resposta inválida')
  })
})
