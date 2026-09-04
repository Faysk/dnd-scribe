'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import { actionStyles, Button } from '@/components/ui/action'
import {
  parseTranscriptPayload,
  TRANSCRIPT_QUERY_MAX_LENGTH,
  TRANSCRIPT_SPEAKER_MAX_LENGTH,
  type TranscriptPayload,
  type TranscriptSegment,
} from '@/lib/api/contracts/transcript'
import { formatCount, formatTimestamp } from '@/lib/formatters'

type TranscriptReaderProps = Readonly<{
  initial: TranscriptPayload
}>

function dedupeSegments(current: readonly TranscriptSegment[], incoming: readonly TranscriptSegment[]) {
  const seen = new Set(current.map((segment) => segment.id))
  return [...current, ...incoming.filter((segment) => !seen.has(segment.id))]
}

export function TranscriptReader({ initial }: TranscriptReaderProps) {
  const [segments, setSegments] = useState<readonly TranscriptSegment[]>(initial.segments)
  const [speakers, setSpeakers] = useState<readonly string[]>(initial.speakers)
  const [total, setTotal] = useState(initial.total)
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor)
  const [queryDraft, setQueryDraft] = useState('')
  const [speakerDraft, setSpeakerDraft] = useState('')
  const [query, setQuery] = useState('')
  const [speaker, setSpeaker] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const fetchPage = useCallback(async (
    cursor: string | null,
    filters: Readonly<{ query: string; speaker: string }>,
    replace: boolean,
  ) => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams({ sourceSessionId: initial.session.sourceSessionId })
    if (cursor) params.set('cursor', cursor)
    if (filters.query) params.set('q', filters.query)
    if (filters.speaker) params.set('speaker', filters.speaker)

    try {
      const response = await fetch(`/api/library/transcript?${params.toString()}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      const raw: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error('A consulta da transcrição falhou.')
      const payload = parseTranscriptPayload(raw)

      setSegments((current) => replace ? payload.segments : dedupeSegments(current, payload.segments))
      setSpeakers(payload.speakers)
      setTotal(payload.total)
      setNextCursor(payload.nextCursor)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar mais falas.')
    } finally {
      setLoading(false)
    }
  }, [initial.session.sourceSessionId])

  const loadMore = useCallback(() => {
    if (!nextCursor || loading) return
    void fetchPage(nextCursor, { query, speaker }, false)
  }, [fetchPage, loading, nextCursor, query, speaker])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !nextCursor || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore()
    }, { rootMargin: '1200px 0px' })

    observer.observe(node)
    return () => observer.disconnect()
  }, [loadMore, nextCursor])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextQuery = queryDraft.trim().slice(0, TRANSCRIPT_QUERY_MAX_LENGTH)
    const nextSpeaker = speakerDraft.trim().slice(0, TRANSCRIPT_SPEAKER_MAX_LENGTH)
    setQuery(nextQuery)
    setSpeaker(nextSpeaker)
    setSegments([])
    setNextCursor(null)
    void fetchPage(null, { query: nextQuery, speaker: nextSpeaker }, true)
  }

  function clearFilters() {
    setQueryDraft('')
    setSpeakerDraft('')
    setQuery('')
    setSpeaker('')
    setSegments([])
    setNextCursor(null)
    void fetchPage(null, { query: '', speaker: '' }, true)
  }

  function retry() {
    if (segments.length && nextCursor) loadMore()
    else void fetchPage(null, { query, speaker }, true)
  }

  const filtered = Boolean(query || speaker)
  const settledStatus = filtered
    ? `${formatCount(segments.length)} resultado(s) carregado(s)`
    : `${formatCount(segments.length)} de ${formatCount(total)} falas`
  const status = loading
    ? segments.length ? 'Carregando mais falas…' : 'Carregando falas…'
    : settledStatus
  const downloadHref = `/api/library/download?sourceSessionId=${encodeURIComponent(initial.session.sourceSessionId)}`

  return (
    <div aria-busy={loading} className="pb-20 pt-8 sm:pt-10">
      <form
        aria-controls="transcript-segments"
        className="grid gap-4 rounded-lg border border-border-subtle bg-canvas-subtle p-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.42fr)_auto] sm:items-end sm:p-5"
        onSubmit={applyFilters}
      >
        <label className="grid gap-2 font-ui text-xs font-semibold text-foreground-soft">
          Buscar na transcrição
          <input
            aria-controls="transcript-segments"
            className="min-h-11 rounded-md border border-border bg-canvas px-3 text-sm font-normal text-foreground outline-none placeholder:text-foreground-muted focus:border-accent"
            maxLength={TRANSCRIPT_QUERY_MAX_LENGTH}
            onChange={(event) => setQueryDraft(event.target.value)}
            placeholder="Uma frase, nome ou lembrança…"
            type="search"
            value={queryDraft}
          />
        </label>

        <label className="grid gap-2 font-ui text-xs font-semibold text-foreground-soft">
          Speaker
          <select
            aria-controls="transcript-segments"
            className="min-h-11 rounded-md border border-border bg-canvas px-3 text-sm font-normal text-foreground outline-none focus:border-accent"
            onChange={(event) => setSpeakerDraft(event.target.value)}
            value={speakerDraft}
          >
            <option value="">Todos</option>
            {speakers.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button disabled={loading} type="submit" variant="secondary">Filtrar</Button>
          {(queryDraft || speakerDraft || filtered) ? <Button disabled={loading} onClick={clearFilters} variant="tertiary">Limpar</Button> : null}
        </div>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-5 font-ui text-xs text-foreground-muted">
        <span aria-atomic="true" aria-live="polite" role="status">{status}</span>
        <a className={actionStyles({ size: 'sm', variant: 'tertiary' })} download href={downloadHref}>Baixar .md</a>
      </div>

      {segments.length ? (
        <ol aria-label="Falas da sessão" className="divide-y divide-border-subtle" id="transcript-segments">
          {segments.map((segment) => (
            <li className="grid gap-3 py-6 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-6" key={segment.id}>
              <div className="font-ui text-xs">
                <strong className="block break-words text-foreground">{segment.speaker}</strong>
                <span className="mt-1 block tabular-nums text-foreground-muted">{formatTimestamp(segment.startMs)}</span>
              </div>
              <p className="m-0 whitespace-pre-wrap font-body text-[1.02rem] leading-7 text-foreground-soft">{segment.text}</p>
            </li>
          ))}
        </ol>
      ) : !loading && !error ? (
        <div className="py-14 text-center" id="transcript-segments" role="status">
          <p className="font-display text-2xl text-foreground">Nenhuma fala encontrada.</p>
          <p className="mt-2 font-ui text-sm text-foreground-muted">Tente remover ou alterar os filtros.</p>
        </div>
      ) : (
        <div aria-hidden="true" id="transcript-segments" />
      )}

      {error ? (
        <div className="mt-6 rounded-md border border-danger/35 bg-surface p-4 font-ui text-sm text-foreground-soft" role="alert">
          <p>{error}</p>
          <Button className="mt-3" disabled={loading} onClick={retry} size="sm" variant="secondary">Tentar novamente</Button>
        </div>
      ) : null}

      <div aria-hidden="true" className="h-px" ref={sentinelRef} />

      {nextCursor ? (
        <div className="mt-7 flex justify-center">
          <Button disabled={loading} onClick={loadMore} variant="secondary">
            {loading ? 'Carregando…' : 'Carregar mais falas'}
          </Button>
        </div>
      ) : segments.length ? (
        <p className="mt-8 text-center font-ui text-xs text-foreground-muted">Fim da transcrição.</p>
      ) : null}
    </div>
  )
}
