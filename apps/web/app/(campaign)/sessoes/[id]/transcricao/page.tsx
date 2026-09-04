import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ArtworkImage } from '@/components/media/artwork-image'
import { SessionNavigation } from '@/components/sessions/session-navigation'
import { TranscriptReader } from '@/components/transcript/transcript-reader'
import { ActionLink } from '@/components/ui/action'
import { StatusPill } from '@/components/ui/status'
import { Surface } from '@/components/ui/surface'
import { BodyCopy, DisplayTitle, Eyebrow, MetaText, SectionTitle } from '@/components/ui/typography'
import { TRANSCRIPT_PAGE_SIZE, type TranscriptPayload } from '@/lib/api/contracts/transcript'
import { LegacyApiError } from '@/lib/api/legacy'
import { fetchSessionTranscript } from '@/lib/api/library'
import { readAuthenticatedAccessToken } from '@/lib/auth/access-token'
import { readPublicSupabaseConfig } from '@/lib/config'
import { displaySessionTitle, formatDuration, formatSessionDate } from '@/lib/formatters'

export const metadata: Metadata = {
  title: 'Transcrição',
  description: 'Transcrição pesquisável da sessão.',
}

type TranscriptPageProps = Readonly<{
  params: Promise<{ id: string }>
}>

type LoadResult =
  | Readonly<{ kind: 'data'; data: TranscriptPayload }>
  | Readonly<{ kind: 'notFound' }>
  | Readonly<{ kind: 'error'; message: string }>

async function loadTranscript(sourceSessionId: string, accessToken: string): Promise<LoadResult> {
  try {
    const data = await fetchSessionTranscript(accessToken, {
      sourceSessionId,
      limit: TRANSCRIPT_PAGE_SIZE,
    })
    return { kind: 'data', data }
  } catch (error) {
    if (error instanceof LegacyApiError && error.status === 404) return { kind: 'notFound' }
    return {
      kind: 'error',
      message: error instanceof Error ? error.message : 'Falha inesperada ao carregar a transcrição.',
    }
  }
}

function SetupState() {
  return (
    <div className="mx-auto w-[min(900px,calc(100%-2.5rem))] py-16 sm:py-24">
      <Surface className="p-8 sm:p-10" tone="elevated">
        <Eyebrow>Preview técnico</Eyebrow>
        <SectionTitle className="mt-4">A transcrição real depende do ambiente autenticado.</SectionTitle>
        <BodyCopy className="mt-4 max-w-2xl">Configure os envs do Preview para carregar as falas privadas da campanha.</BodyCopy>
        <div className="mt-7"><ActionLink href="/sessoes" variant="tertiary">Voltar às sessões</ActionLink></div>
      </Surface>
    </div>
  )
}

function TranscriptError({ message }: Readonly<{ message: string }>) {
  return (
    <div className="mx-auto w-[min(900px,calc(100%-2.5rem))] py-16 sm:py-24">
      <Surface className="p-8 sm:p-10" tone="elevated">
        <Eyebrow>Transcrição indisponível</Eyebrow>
        <SectionTitle className="mt-4">Não foi possível abrir as falas desta sessão.</SectionTitle>
        <BodyCopy className="mt-4 max-w-2xl">{message}</BodyCopy>
        <div className="mt-7"><ActionLink href="/sessoes" variant="secondary">Voltar ao arquivo</ActionLink></div>
      </Surface>
    </div>
  )
}

function TranscriptPage({ data }: Readonly<{ data: TranscriptPayload }>) {
  const { session } = data
  const title = displaySessionTitle(session.title, session.sessionDate)
  const art = session.heroImageUrl || session.coverImageUrl

  return (
    <div className="mx-auto w-[min(1180px,calc(100%-2.5rem))] py-8 sm:py-12">
      <header>
        <ActionLink href={`/sessoes/${encodeURIComponent(session.sourceSessionId)}`} size="sm" variant="tertiary">← Resumo da sessão</ActionLink>
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-elevated">
          {art ? (
            <div className="relative aspect-[16/7] w-full bg-surface">
              <ArtworkImage
                alt={`Arte de destaque de ${title}`}
                className="object-cover"
                priority
                sizes="(min-width: 1180px) 1180px, calc(100vw - 2.5rem)"
                src={art}
              />
            </div>
          ) : (
            <div aria-label={`Sessão ${title} sem arte de destaque`} className="grid aspect-[16/7] w-full place-items-center bg-[radial-gradient(circle_at_50%_35%,var(--ds-accent-muted),transparent_45%),var(--ds-surface)]" role="img">
              <span className="font-display text-8xl text-accent/30">20</span>
            </div>
          )}
        </div>

        <div className="mx-auto max-w-4xl py-8 sm:py-10">
          <div className="flex flex-wrap items-center gap-3">
            <Eyebrow>Transcrição da sessão</Eyebrow>
            {session.arc ? <StatusPill tone="accent">{session.arc}</StatusPill> : null}
          </div>
          <DisplayTitle className="mt-4">{title}</DisplayTitle>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            <MetaText>{formatSessionDate(session.sessionDate)}</MetaText>
            <MetaText>{formatDuration(session.durationMs)}</MetaText>
          </div>
          {session.summary ? <BodyCopy className="mt-6 max-w-3xl">{session.summary}</BodyCopy> : null}
        </div>
      </header>

      <div className="mx-auto max-w-4xl">
        <SessionNavigation active="transcript" sourceSessionId={session.sourceSessionId} />
        <TranscriptReader initial={data} />
      </div>
    </div>
  )
}

export default async function SessionTranscriptPage({ params }: TranscriptPageProps) {
  if (!readPublicSupabaseConfig()) return <SetupState />

  const { id } = await params
  const sourceSessionId = String(id || '').trim()
  if (!sourceSessionId || sourceSessionId.length > 220) notFound()

  const accessToken = await readAuthenticatedAccessToken()
  const result = await loadTranscript(sourceSessionId, accessToken)

  if (result.kind === 'notFound') notFound()
  if (result.kind === 'error') return <TranscriptError message={result.message} />
  return <TranscriptPage data={result.data} />
}
