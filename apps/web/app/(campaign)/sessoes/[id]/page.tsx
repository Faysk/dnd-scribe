import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { MarkdownContent } from '@/components/content/markdown'
import { ArtworkImage } from '@/components/media/artwork-image'
import { SessionNavigation } from '@/components/sessions/session-navigation'
import { ActionLink } from '@/components/ui/action'
import { StatusPill } from '@/components/ui/status'
import { Surface } from '@/components/ui/surface'
import { BodyCopy, DisplayTitle, Eyebrow, MetaText, SectionTitle } from '@/components/ui/typography'
import type { PublicSessionDetail } from '@/lib/api/contracts/public-library'
import { LegacyApiError } from '@/lib/api/legacy'
import { fetchPublicSession } from '@/lib/api/public-library'
import { canRenderUnconfiguredPreview, hasConfiguredLegacyOrigin } from '@/lib/config'
import { displaySessionTitle, formatSessionDate } from '@/lib/formatters'

export const metadata: Metadata = {
  title: 'Sessão',
  description: 'Resumo público e memória publicada da sessão.',
}

type SessionPageProps = Readonly<{
  params: Promise<{ id: string }>
}>

type LoadResult =
  | Readonly<{ kind: 'data'; session: PublicSessionDetail }>
  | Readonly<{ kind: 'notFound' }>
  | Readonly<{ kind: 'error' }>

async function loadSessionPage(sourceSessionId: string): Promise<LoadResult> {
  try {
    const payload = await fetchPublicSession(sourceSessionId)
    return { kind: 'data', session: payload.session }
  } catch (error) {
    if (error instanceof LegacyApiError && error.status === 404) return { kind: 'notFound' }
    console.error('[web-next] Falha ao carregar memória pública da sessão.', error)
    return { kind: 'error' }
  }
}

function SetupState() {
  return (
    <div className="mx-auto w-[min(900px,calc(100%-2.5rem))] py-16 sm:py-24">
      <Surface className="p-8 sm:p-10" tone="elevated">
        <Eyebrow>Preview técnico</Eyebrow>
        <SectionTitle className="mt-4">A memória pública aguarda a origem de dados do Preview.</SectionTitle>
        <BodyCopy className="mt-4 max-w-2xl">Configure a origem legada estável para abrir os resumos publicados.</BodyCopy>
        <div className="mt-7"><ActionLink href="/sessoes" variant="tertiary">Voltar às sessões</ActionLink></div>
      </Surface>
    </div>
  )
}

function SessionError() {
  return (
    <div className="mx-auto w-[min(900px,calc(100%-2.5rem))] py-16 sm:py-24">
      <Surface className="p-8 sm:p-10" tone="elevated">
        <Eyebrow>Memória indisponível</Eyebrow>
        <SectionTitle className="mt-4">Não foi possível abrir esta sessão.</SectionTitle>
        <BodyCopy className="mt-4 max-w-2xl">O arquivo público não respondeu como esperado. Tente novamente em instantes.</BodyCopy>
        <div className="mt-7 flex flex-wrap gap-3">
          <ActionLink href="/sessoes" variant="secondary">Voltar ao arquivo</ActionLink>
        </div>
      </Surface>
    </div>
  )
}

function SessionHero({ session }: Readonly<{ session: PublicSessionDetail }>) {
  const title = displaySessionTitle(session.title, session.sessionDate)
  const art = session.heroImageUrl || session.coverImageUrl

  return (
    <header>
      <ActionLink href="/sessoes" size="sm" variant="tertiary">← Arquivo de sessões</ActionLink>
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
          <Eyebrow>Memória pública</Eyebrow>
          {session.arc ? <StatusPill tone="accent">{session.arc}</StatusPill> : null}
        </div>
        <DisplayTitle className="mt-4">{title}</DisplayTitle>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
          <MetaText>{formatSessionDate(session.sessionDate)}</MetaText>
          <MetaText>Resumo público</MetaText>
        </div>
        {session.summary ? <BodyCopy className="mt-6 max-w-3xl">{session.summary}</BodyCopy> : null}
      </div>
    </header>
  )
}

function SessionMemory({ session }: Readonly<{ session: PublicSessionDetail }>) {
  return (
    <div className="mx-auto w-[min(1180px,calc(100%-2.5rem))] py-8 sm:py-12">
      <SessionHero session={session} />

      <div className="mx-auto max-w-4xl">
        <SessionNavigation active="summary" sourceSessionId={session.sourceSessionId} />

        <article className="mx-auto max-w-[760px] pb-20 pt-8 sm:pt-10">
          {session.summaryFull ? (
            <MarkdownContent markdown={session.summaryFull} />
          ) : (
            <Surface className="p-6 sm:p-8" tone="subtle">
              <Eyebrow>Resumo em preparação</Eyebrow>
              <SectionTitle className="mt-3">A memória completa ainda não foi publicada.</SectionTitle>
              <BodyCopy className="mt-4">A sessão já existe no arquivo. A transcrição permanece reservada aos membros da campanha enquanto o recap completo é preparado.</BodyCopy>
              <div className="mt-6">
                <ActionLink href={`/sessoes/${encodeURIComponent(session.sourceSessionId)}/transcricao`} variant="secondary">Acessar área da mesa</ActionLink>
              </div>
            </Surface>
          )}
        </article>
      </div>
    </div>
  )
}

export default async function SessionSummaryPage({ params }: SessionPageProps) {
  if (!hasConfiguredLegacyOrigin() && canRenderUnconfiguredPreview()) return <SetupState />

  const { id } = await params
  const sourceSessionId = String(id || '').trim()
  if (!sourceSessionId || sourceSessionId.length > 220) notFound()

  const result = await loadSessionPage(sourceSessionId)

  if (result.kind === 'notFound') notFound()
  if (result.kind === 'error') return <SessionError />
  return <SessionMemory session={result.session} />
}
