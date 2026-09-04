import type { Metadata } from 'next'

import { ArchiveStats } from '@/components/sessions/archive-stats'
import { LatestSession } from '@/components/sessions/latest-session'
import { SessionCard } from '@/components/sessions/session-card'
import { ActionLink } from '@/components/ui/action'
import { StatusPill } from '@/components/ui/status'
import { Surface } from '@/components/ui/surface'
import { BodyCopy, DisplayTitle, Eyebrow, SectionTitle } from '@/components/ui/typography'
import { fetchLibrarySessions } from '@/lib/api/library'
import { readAuthenticatedAccessToken } from '@/lib/auth/access-token'
import { bootstrapContent } from '@/lib/bootstrap'
import { readPublicSupabaseConfig } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Início',
  description: 'A memória navegável da campanha.',
}

function ordered<T extends { sessionDate: string; createdAt: string }>(sessions: readonly T[]) {
  return [...sessions].sort((a, b) => {
    const right = b.sessionDate || b.createdAt
    const left = a.sessionDate || a.createdAt
    return right.localeCompare(left)
  })
}

function TechnicalPreview() {
  return (
    <div className="grid min-h-[calc(100vh-77px)] place-items-center px-5 py-10 sm:px-8">
      <Surface aria-labelledby="phase-title" className="w-full max-w-2xl p-7 sm:p-10 lg:p-14" tone="elevated">
        <Eyebrow>{bootstrapContent.eyebrow}</Eyebrow>
        <DisplayTitle className="mt-4" id="phase-title">{bootstrapContent.title}</DisplayTitle>
        <BodyCopy className="mt-6 max-w-xl">{bootstrapContent.description}</BodyCopy>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <StatusPill tone="accent">{bootstrapContent.status}</StatusPill>
          <ActionLink href="/design-system" size="sm" variant="tertiary">Abrir catálogo visual</ActionLink>
        </div>
      </Surface>
    </div>
  )
}

function DataError({ message }: Readonly<{ message: string }>) {
  return (
    <div className="mx-auto w-[min(900px,calc(100%-2.5rem))] py-16 sm:py-24">
      <Surface className="p-7 sm:p-10" tone="elevated">
        <Eyebrow>Arquivo temporariamente indisponível</Eyebrow>
        <SectionTitle className="mt-4">As memórias continuam guardadas.</SectionTitle>
        <BodyCopy className="mt-4 max-w-2xl">Não foi possível carregar o catálogo agora. {message}</BodyCopy>
        <div className="mt-7"><ActionLink href="/" variant="secondary">Tentar novamente</ActionLink></div>
      </Surface>
    </div>
  )
}

export default async function CampaignHomePage() {
  if (!readPublicSupabaseConfig()) return <TechnicalPreview />

  const accessToken = await readAuthenticatedAccessToken()
  try {
    const payload = await fetchLibrarySessions(accessToken)
    const sessions = ordered(payload.sessions)
    const latest = sessions[0]
    const recent = sessions.slice(1, 5)

    return (
      <div className="mx-auto w-[min(1180px,calc(100%-2.5rem))] py-10 sm:py-14 lg:py-16">
        <header className="max-w-3xl pb-10 sm:pb-12">
          <Eyebrow>Arquivo da campanha</Eyebrow>
          <DisplayTitle className="mt-4">Onde paramos?</DisplayTitle>
          <BodyCopy className="mt-5 max-w-2xl">
            O DnD Scribe organiza a campanha como memória: primeiro o que aconteceu, depois o arquivo completo para quando alguém disser “caralho, quem era esse NPC mesmo?”.
          </BodyCopy>
        </header>

        {latest ? <LatestSession session={latest} /> : (
          <Surface className="p-8 sm:p-10" tone="subtle">
            <Eyebrow>Arquivo vazio</Eyebrow>
            <SectionTitle className="mt-3">Nenhuma sessão publicada ainda.</SectionTitle>
            <BodyCopy className="mt-4">Quando a primeira memória for publicada, ela aparece aqui automaticamente.</BodyCopy>
          </Surface>
        )}

        <div className="mt-10 sm:mt-12"><ArchiveStats sessions={sessions} /></div>

        {recent.length ? (
          <section aria-labelledby="recent-title" className="mt-12 sm:mt-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <Eyebrow>Memórias recentes</Eyebrow>
                <SectionTitle className="mt-3" id="recent-title">As sessões logo antes desta</SectionTitle>
              </div>
              <ActionLink href="/sessoes" size="sm" variant="tertiary">Ver arquivo completo</ActionLink>
            </div>
            <div className="mt-7 grid gap-5 lg:grid-cols-2">
              {recent.map((session) => <SessionCard key={session.sourceSessionId} session={session} />)}
            </div>
          </section>
        ) : null}
      </div>
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada ao consultar a biblioteca.'
    return <DataError message={message} />
  }
}
