import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { MarkdownContent } from '@/components/content/markdown'
import { SessionNavigation } from '@/components/sessions/session-navigation'
import { ActionLink } from '@/components/ui/action'
import { StatusPill } from '@/components/ui/status'
import { Surface } from '@/components/ui/surface'
import { BodyCopy, DisplayTitle, Eyebrow, MetaText, SectionTitle } from '@/components/ui/typography'
import type { LibrarySession } from '@/lib/api/contracts/library'
import type { SessionSummary } from '@/lib/api/contracts/summary'
import { fetchLibrarySessions, fetchSessionSummary } from '@/lib/api/library'
import { readAuthenticatedAccessToken } from '@/lib/auth/access-token'
import { readPublicSupabaseConfig } from '@/lib/config'
import { displaySessionTitle, formatCount, formatDuration, formatSessionDate } from '@/lib/formatters'

export const metadata: Metadata = {
  title: 'Sessão',
  description: 'Resumo e memória publicada da sessão.',
}

type SessionPageProps = Readonly<{
  params: Promise<{ id: string }>
}>

type SessionPageData = Readonly<{
  session: LibrarySession
  summary: SessionSummary | null
}>

type LoadResult =
  | Readonly<{ kind: 'data'; data: SessionPageData }>
  | Readonly<{ kind: 'notFound' }>
  | Readonly<{ kind: 'error'; message: string }>

async function loadSessionPage(sourceSessionId: string, accessToken: string): Promise<LoadResult> {
  try {
    const library = await fetchLibrarySessions(accessToken)
    const session = library.sessions.find((item) => item.sourceSessionId === sourceSessionId)
    if (!session) return { kind: 'notFound' }
    if (!session.hasSummary) return { kind: 'data', data: { session, summary: null } }

    const summary = await fetchSessionSummary(accessToken, sourceSessionId)
    return { kind: 'data', data: { session, summary: summary.session } }
  } catch (error) {
    return {
      kind: 'error',
      message: error instanceof Error ? error.message : 'Falha inesperada ao carregar a sessão.',
    }
  }
}

function SetupState() {
  return (
    <div className="mx-auto w-[min(900px,calc(100%-2.5rem))] py-16 sm:py-24">
      <Surface className="p-8 sm:p-10" tone="elevated">
        <Eyebrow>Preview técnico</Eyebrow>
        <SectionTitle className="mt-4">O detalhe real depende do ambiente autenticado.</SectionTitle>
        <BodyCopy className="mt-4 max-w-2xl">Configure os envs do Preview para abrir uma memória privada da campanha.</BodyCopy>
        <div className="mt-7"><ActionLink href="/sessoes" variant="tertiary">Voltar às sessões</ActionLink></div>
      </Surface>
    </div>
  )
}

function SessionError({ message }: Readonly<{ message: string }>) {
  return (
    <div className="mx-auto w-[min(900px,calc(100%-2.5rem))] py-16 sm:py-24">
      <Surface className="p-8 sm:p-10" tone="elevated">
        <Eyebrow>Memória indisponível</Eyebrow>
        <SectionTitle className="mt-4">Não foi possível abrir esta sessão.</SectionTitle>
        <BodyCopy className="mt-4 max-w-2xl">{message}</BodyCopy>
        <div className="mt-7 flex flex-wrap gap-3">
          <ActionLink href="/sessoes" variant="secondary">Voltar ao arquivo</ActionLink>
        </div>
      </Surface>
    </div>
  )
}

function SessionHero({ session, summary }: SessionPageData) {
  const title = displaySessionTitle(summary?.title || session.title, summary?.sessionDate || session.sessionDate)
  const art = summary?.heroImageUrl || session.heroImageUrl || summary?.coverImageUrl || session.coverImageUrl

  return (
    <header>
      <ActionLink href="/sessoes" size="sm" variant="tertiary">← Arquivo de sessões</ActionLink>
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-elevated">
        {art ? (
          // A URL já foi validada como HTTPS pelo contrato da biblioteca.
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={`Arte de destaque de ${title}`} className="aspect-[16/7] w-full bg-surface object-cover" fetchPriority="high" src={art} />
        ) : (
          <div aria-label={`Sessão ${title} sem arte de destaque`} className="grid aspect-[16/7] w-full place-items-center bg-[radial-gradient(circle_at_50%_35%,var(--ds-accent-muted),transparent_45%),var(--ds-surface)]" role="img">
            <span className="font-display text-8xl text-accent/30">20</span>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-4xl py-8 sm:py-10">
        <div className="flex flex-wrap items-center gap-3">
          <Eyebrow>Memória da sessão</Eyebrow>
          {(summary?.arc || session.arc) ? <StatusPill tone="accent">{summary?.arc || session.arc}</StatusPill> : null}
        </div>
        <DisplayTitle className="mt-4">{title}</DisplayTitle>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
          <MetaText>{formatSessionDate(summary?.sessionDate || session.sessionDate)}</MetaText>
          <MetaText>{formatDuration(session.durationMs)}</MetaText>
          <MetaText>{formatCount(session.segments)} falas</MetaText>
          <MetaText>{formatCount(session.participants)} participantes</MetaText>
        </div>
        {(summary?.summary || session.summary) ? (
          <BodyCopy className="mt-6 max-w-3xl">{summary?.summary || session.summary}</BodyCopy>
        ) : null}
      </div>
    </header>
  )
}

function SessionMemory({ data }: Readonly<{ data: SessionPageData }>) {
  return (
    <div className="mx-auto w-[min(1180px,calc(100%-2.5rem))] py-8 sm:py-12">
      <SessionHero session={data.session} summary={data.summary} />

      <div className="mx-auto max-w-4xl">
        <SessionNavigation active="summary" sourceSessionId={data.session.sourceSessionId} />

        <article className="mx-auto max-w-[760px] pb-20 pt-8 sm:pt-10">
          {data.summary?.summaryFull ? (
            <MarkdownContent markdown={data.summary.summaryFull} />
          ) : (
            <Surface className="p-6 sm:p-8" tone="subtle">
              <Eyebrow>Resumo em preparação</Eyebrow>
              <SectionTitle className="mt-3">A memória completa ainda não foi publicada.</SectionTitle>
              <BodyCopy className="mt-4">A sessão já existe no arquivo e a transcrição continua disponível; o recap completo entra aqui assim que for aprovado.</BodyCopy>
              <div className="mt-6">
                <ActionLink href={`/sessoes/${encodeURIComponent(data.session.sourceSessionId)}/transcricao`} variant="secondary">Abrir transcrição</ActionLink>
              </div>
            </Surface>
          )}
        </article>
      </div>
    </div>
  )
}

export default async function SessionSummaryPage({ params }: SessionPageProps) {
  if (!readPublicSupabaseConfig()) return <SetupState />

  const { id } = await params
  const sourceSessionId = String(id || '').trim()
  if (!sourceSessionId || sourceSessionId.length > 220) notFound()

  const accessToken = await readAuthenticatedAccessToken()
  const result = await loadSessionPage(sourceSessionId, accessToken)

  if (result.kind === 'notFound') notFound()
  if (result.kind === 'error') return <SessionError message={result.message} />
  return <SessionMemory data={result.data} />
}
