import type { ReactNode } from 'react'

import { Brand } from '@/components/shell/brand'
import { PrimaryNav } from '@/components/shell/primary-nav'
import { UserMenu } from '@/components/shell/user-menu'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import type { AuthIdentity } from '@/lib/auth/state'
import type { CampaignAccessPayload } from '@/lib/api/contracts/auth'

type CampaignShellProps = Readonly<{
  children: ReactNode
  identity: AuthIdentity
  access: CampaignAccessPayload
}>

export function CampaignShell({ access, children, identity }: CampaignShellProps) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[76px] w-[min(1280px,calc(100%-2.5rem))] items-center justify-between gap-5 py-3">
          <Brand />
          <div className="flex items-center gap-3">
            <PrimaryNav />
            <ThemeToggle />
            <UserMenu access={access} identity={identity} />
          </div>
        </div>
      </header>
      <main id="content" tabIndex={-1}>{children}</main>
    </>
  )
}
