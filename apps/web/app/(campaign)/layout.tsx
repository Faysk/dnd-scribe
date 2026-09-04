import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { AuthError } from '@/components/auth/auth-error'
import { PendingAccess } from '@/components/auth/pending-access'
import { CampaignShell } from '@/components/shell/campaign-shell'
import { readPublicSupabaseConfig } from '@/lib/config'
import { resolveAuthState, type AuthState } from '@/lib/auth/state'

type CampaignLayoutProps = Readonly<{
  children: ReactNode
}>

export default async function CampaignLayout({ children }: CampaignLayoutProps) {
  if (!readPublicSupabaseConfig()) {
    return <main id="content">{children}</main>
  }

  let state: AuthState
  try {
    state = await resolveAuthState()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada ao validar o acesso.'
    return <AuthError message={message} />
  }

  if (state.kind === 'anonymous') redirect('/login')
  if (state.kind === 'pendingAccess') return <PendingAccess identity={state.identity} />

  return (
    <CampaignShell access={state.access} identity={state.identity}>
      {children}
    </CampaignShell>
  )
}
