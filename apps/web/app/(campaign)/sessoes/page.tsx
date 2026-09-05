import type { Metadata } from 'next'

import { SessionCard } from '@/components/sessions/session-card'
import { ActionLink } from '@/components/ui/action'
import { Surface } from '@/components/ui/surface'
import { BodyCopy, DisplayTitle, Eyebrow, MetaText, SectionTitle } from '@/components/ui/typography'
import type { PublicSession } from '@/lib/api/contracts/public-library'
import { fetchPublicSessions } from '@/lib/api/public-library'
import { canRenderUnconfiguredPreview, hasConfiguredLegacyOrigin } from '@/lib/config'
import { formatCount } from '@/lib/formatters'

export const metadata: Metadata = {
  title: 'Sessões',
  description: 'Arquivo público e cronológico das memórias da campanha.',
}

// O catálogo é uma visão viva das sessões publicadas. Mantê-lo dinâmico evita consultar
// a API legada durante o build e não prende novas memórias ao ciclo de deploy do frontend.
export const dynamic = 'force-dynamic'

function ordered<T extends { sessionDate: string; updatedAt: string }>(sessions: readonly T[]) {
  return [...sessions].sort((a, b) => (b.sessionDate || b.updatedAt).localeCompare(a.sessionDate || a.updatedAt))
}

function SetupState() {
  return (
    <div className="mx-auto w-[min(900px,calc(100%-2.5rem))] py-16 sm:py-24">
      <Surface className="p-8 sm:p-10" tone="elevated">
        <Eyebrow>Preview técnico</Eyebrow>
        <SectionTitle className="mt-4">O arquivo público aguarda a origem de dados do Preview.</SectionTitle>
        <BodyCopy className="mt-4 max-w-2xl">Configure a origem legada estável para carregar as memórias publicadas. Produção continua intocada.</BodyCopy>
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
        <SectionTitle className="mt-4">Não foi possível abrir as memórias.</SectionTitle>
        <BodyCopy className="mt-4 max-w-2xl">O arquivo público não respondeu como esperado. Tente novamente em instantes.</BodyCopy>
        <div className="mt-7"><ActionLink href="/sessoes" variant="secondary">Tentar novamente</ActionLink></div>
      </Surface>
    </div>
  )
}

function SessionsArchive({ sessions }: Readonly<{ sessions: readonly PublicSession[] }>) {
  return (
    <div className="mx-auto w-[min(1180px,calc(100%-2.5rem))] py-10 sm:py-14 lg:py-16">
      <header className="max-w-3xl">
        <Eyebrow>Arquivo cronológico</Eyebrow>
        <DisplayTitle className="mt-4">Sessões</DisplayTitle>
        <BodyCopy className="mt-5 max-w-2xl">Toda memória já publicada, da lembrança mais recente até onde o arquivo alcança. Nenhum login é necessário para ler os resumos.</BodyCopy>
        <MetaText className="mt-5">{formatCount(sessions.length)} sessões públicas</MetaText>
      </header>

      {sessions.length ? (
        <section aria-label="Catálogo de sessões" className="mt-10 grid gap-5 sm:mt-12 lg:grid-cols-2">
          {sessions.map((session) => <SessionCard key={session.sourceSessionId} session={session} />)}
        </section>
      ) : (
        <Surface className="mt-10 p-8 sm:p-10" tone="subtle">
          <Eyebrow>Arquivo vazio</Eyebrow>
          <SectionTitle className="mt-3">Nenhuma sessão publicada.</SectionTitle>
          <BodyCopy className="mt-4">Assim que uma sessão virar memória pública, ela aparece aqui automaticamente.</BodyCopy>
        </Surface>
      )}
    </div>
  )
}

export default async function SessionsArchivePage() {
  if (!hasConfiguredLegacyOrigin() && canRenderUnconfiguredPreview()) return <SetupState />

  let sessions: readonly PublicSession[] = []
  let loadFailed = false

  try {
    const payload = await fetchPublicSessions()
    sessions = ordered(payload.sessions)
  } catch (error) {
    console.error('[web-next] Falha ao consultar o arquivo público de sessões.', error)
    loadFailed = true
  }

  if (loadFailed) return <ArchiveError />
  return <SessionsArchive sessions={sessions} />
}
