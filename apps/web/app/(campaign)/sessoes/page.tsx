import type { Metadata } from 'next'

import { SessionCard } from '@/components/sessions/session-card'
import { ActionLink } from '@/components/ui/action'
import { Surface } from '@/components/ui/surface'
import { BodyCopy, DisplayTitle, Eyebrow, MetaText, SectionTitle } from '@/components/ui/typography'
import type { LibrarySession } from '@/lib/api/contracts/library'
import { fetchLibrarySessions } from '@/lib/api/library'
import { readAuthenticatedAccessToken } from '@/lib/auth/access-token'
import { readPublicSupabaseConfig } from '@/lib/config'
import { formatCount } from '@/lib/formatters'

export const metadata: Metadata = {
  title: 'Sessões',
  description: 'Arquivo cronológico completo das sessões da campanha.',
}

function ordered<T extends { sessionDate: string; createdAt: string }>(sessions: readonly T[]) {
  return [...sessions].sort((a, b) => (b.sessionDate || b.createdAt).localeCompare(a.sessionDate || a.createdAt))
}

function SetupState() {
  return (
    <div className="mx-auto w-[min(900px,calc(100%-2.5rem))] py-16 sm:py-24">
      <Surface className="p-8 sm:p-10" tone="elevated">
        <Eyebrow>Preview técnico</Eyebrow>
        <SectionTitle className="mt-4">O arquivo real depende do ambiente autenticado.</SectionTitle>
        <BodyCopy className="mt-4 max-w-2xl">Configure os envs do Preview para carregar as sessões privadas da campanha. Produção legada continua intocada.</BodyCopy>
        <div className="mt-7"><ActionLink href="/" variant="tertiary">Voltar ao início</ActionLink></div>
      </Surface>
    </div>
  )
}

function ArchiveError() {
  return (
    <div className="mx-auto w-[min(900px,calc(100%-2.5rem))] py-16 sm:py-24">
      <Surface className="p-8 sm:p-10" tone="elevated">
        <Eyebrow>Arquivo indisponível</Eyebrow>
        <SectionTitle className="mt-4">Não foi possível abrir as sessões.</SectionTitle>
        <BodyCopy className="mt-4 max-w-2xl">O arquivo não respondeu como esperado. Tente novamente em instantes.</BodyCopy>
        <div className="mt-7"><ActionLink href="/sessoes" variant="secondary">Tentar novamente</ActionLink></div>
      </Surface>
    </div>
  )
}

function SessionsArchive({ sessions }: Readonly<{ sessions: readonly LibrarySession[] }>) {
  return (
    <div className="mx-auto w-[min(1180px,calc(100%-2.5rem))] py-10 sm:py-14 lg:py-16">
      <header className="max-w-3xl">
        <Eyebrow>Arquivo cronológico</Eyebrow>
        <DisplayTitle className="mt-4">Sessões</DisplayTitle>
        <BodyCopy className="mt-5 max-w-2xl">Toda a campanha publicada em ordem, da lembrança mais recente até onde o arquivo alcança.</BodyCopy>
        <MetaText className="mt-5">{formatCount(sessions.length)} sessões disponíveis</MetaText>
      </header>

      {sessions.length ? (
        <section aria-label="Catálogo de sessões" className="mt-10 grid gap-5 sm:mt-12 lg:grid-cols-2">
          {sessions.map((session) => <SessionCard key={session.sourceSessionId} session={session} />)}
        </section>
      ) : (
        <Surface className="mt-10 p-8 sm:p-10" tone="subtle">
          <Eyebrow>Arquivo vazio</Eyebrow>
          <SectionTitle className="mt-3">Nenhuma sessão publicada.</SectionTitle>
          <BodyCopy className="mt-4">Assim que uma sessão for publicada, ela aparece aqui sem cadastro duplicado.</BodyCopy>
        </Surface>
      )}
    </div>
  )
}

export default async function SessionsArchivePage() {
  if (!readPublicSupabaseConfig()) return <SetupState />

  const accessToken = await readAuthenticatedAccessToken()
  let sessions: readonly LibrarySession[] = []
  let loadFailed = false

  try {
    const payload = await fetchLibrarySessions(accessToken)
    sessions = ordered(payload.sessions)
  } catch (error) {
    console.error('[web-next] Falha ao consultar o arquivo de sessões.', error)
    loadFailed = true
  }

  if (loadFailed) return <ArchiveError />
  return <SessionsArchive sessions={sessions} />
}
