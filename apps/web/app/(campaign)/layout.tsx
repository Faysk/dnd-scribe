import type { ReactNode } from 'react'

import { CampaignShell } from '@/components/shell/campaign-shell'
import { readPublicSupabaseConfig } from '@/lib/config'
import { resolveAuthState, type AuthState } from '@/lib/auth/state'

type CampaignLayoutProps = Readonly<{
  children: ReactNode
}>

export default async function CampaignLayout({ children }: CampaignLayoutProps) {
  let state: AuthState = { kind: 'anonymous' }

  if (readPublicSupabaseConfig()) {
    try {
      state = await resolveAuthState()
    } catch (error) {
      console.warn('[web-next] Auth indisponível no shell público; seguindo como visitante.', {
        category: 'public_shell_auth',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return <CampaignShell authState={state}>{children}</CampaignShell>
}
