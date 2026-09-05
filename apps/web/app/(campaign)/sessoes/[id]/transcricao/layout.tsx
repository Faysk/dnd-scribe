import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { AuthError } from '@/components/auth/auth-error'
import { PendingAccess } from '@/components/auth/pending-access'
import { Surface } from '@/components/ui/surface'
import { BodyCopy, Eyebrow, SectionTitle } from '@/components/ui/typography'
import { readPublicSupabaseConfig } from '@/lib/config'
import { resolveAuthState, type AuthState } from '@/lib/auth/state'

type TranscriptLayoutProps = Readonly<{
  children: ReactNode
  params: Promise<{ id: string }>
}>

function AuthSetupState() {
  return (
    <div className="mx-auto w-[min(900px,calc(100%-2.5rem))] py-16 sm:py-24">
      <Surface className="p-8 sm:p-10" tone="elevated">
        <Eyebrow>Área reservada</Eyebrow>
        <SectionTitle className="mt-4">O acesso às transcrições ainda não está configurado neste ambiente.</SectionTitle>
        <BodyCopy className="mt-4 max-w-2xl">Os resumos públicos continuam disponíveis normalmente.</BodyCopy>
      </Surface>
    </div>
  )
}

export default async function TranscriptLayout({ children, params }: TranscriptLayoutProps) {
  const { id } = await params
  const sourceSessionId = String(id || '').trim()
  const returnHref = sourceSessionId ? `/sessoes/${encodeURIComponent(sourceSessionId)}` : '/sessoes'
  const transcriptHref = sourceSessionId ? `${returnHref}/transcricao` : '/sessoes'

  if (!readPublicSupabaseConfig()) return <AuthSetupState />

  let state: AuthState
  try {
    state = await resolveAuthState()
  } catch (error) {
    console.error('[web-next] Falha ao validar acesso à transcrição.', error)
    return <AuthError message="Não foi possível validar seu acesso à transcrição agora. Tente novamente em instantes." />
  }

  if (state.kind === 'anonymous') {
    redirect(`/login?next=${encodeURIComponent(transcriptHref)}`)
  }
  if (state.kind === 'pendingAccess') {
    return <PendingAccess identity={state.identity} returnHref={returnHref} />
  }
  return children
}
