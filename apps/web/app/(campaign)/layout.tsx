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

function ContentBoundary({ children }: Readonly<{ children: ReactNode }>) {
  return <main id="content" tabIndex={-1}>{children}</main>
}

export default async function CampaignLayout({ children }: CampaignLayoutProps) {
  if (!readPublicSupabaseConfig()) {
    return <ContentBoundary>{children}</ContentBoundary>
  }

  let state: AuthState
  try {
    state = await resolveAuthState()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada ao validar o acesso.'
    return <ContentBoundary><AuthError message={message} /></ContentBoundary>
  }

  if (state.kind === 'anonymous') redirect('/login')
  if (state.kind === 'pendingAccess') {
    return <ContentBoundary><PendingAccess identity={state.identity} /></ContentBoundary>
  }

  return (
    <CampaignShell access={state.access} identity={state.identity}>
      {children}
    </CampaignShell>
  )
}
