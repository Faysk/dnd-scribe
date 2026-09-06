import Link from 'next/link'
import type { ReactNode } from 'react'

import { Brand } from '@/components/shell/brand'
import { PrimaryNav } from '@/components/shell/primary-nav'
import { UserMenu } from '@/components/shell/user-menu'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import type { AuthState } from '@/lib/auth/state'

type CampaignShellProps = Readonly<{
  children: ReactNode
  authState: AuthState
}>

export function CampaignShell({ authState, children }: CampaignShellProps) {
  const pending = authState.kind === 'pendingAccess'

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] w-[min(1280px,calc(100%-1.5rem))] items-center justify-between gap-2 py-2.5 sm:w-[min(1280px,calc(100%-2.5rem))] sm:gap-5 sm:py-3">
          <Brand />
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <PrimaryNav />
            <ThemeToggle />
            {authState.kind === 'anonymous' ? (
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-border px-3.5 font-ui text-sm font-semibold text-foreground no-underline transition-colors hover:border-accent/60 hover:bg-surface"
                href="/login"
              >
                Entrar
              </Link>
            ) : (
              <UserMenu
                access={authState.kind === 'authorized' ? authState.access : null}
                identity={authState.identity}
              />
            )}
          </div>
        </div>
        {pending ? (
          <div className="border-t border-border-subtle bg-accent-muted/45 px-5 py-2 text-center font-ui text-xs text-foreground-soft">
            Sua conta está conectada. Transcrições e material interno aguardam aprovação de acesso.
          </div>
        ) : null}
      </header>
      <main id="content" tabIndex={-1}>{children}</main>
    </>
  )
}
