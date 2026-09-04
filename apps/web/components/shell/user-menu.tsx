import Link from 'next/link'

import { campaignRoleLabel, type AuthIdentity } from '@/lib/auth/state'
import type { CampaignAccessPayload } from '@/lib/api/contracts/auth'
import { getLegacyEditUrl } from '@/lib/config'

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'M'
}

type UserMenuProps = Readonly<{
  identity: AuthIdentity
  access: CampaignAccessPayload
}>

export function UserMenu({ access, identity }: UserMenuProps) {
  const editUrl = access.capabilities?.canOpenEdit ? getLegacyEditUrl() : null
  const avatarStyle = identity.avatarUrl
    ? { backgroundImage: `url(${JSON.stringify(identity.avatarUrl).slice(1, -1)})` }
    : undefined

  return (
    <details className="group relative">
      <summary
        aria-label={`Abrir menu de ${identity.displayName}`}
        className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-canvas-subtle p-1 pr-2 text-foreground-soft transition-colors hover:border-accent/60 hover:bg-surface [&::-webkit-details-marker]:hidden"
      >
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-full border border-accent/40 bg-accent-muted bg-cover bg-center text-xs font-bold text-accent-strong"
          style={avatarStyle}
        >
          {identity.avatarUrl ? null : initials(identity.displayName)}
        </span>
        <span aria-hidden="true" className="text-xs transition-transform group-open:rotate-180">⌄</span>
      </summary>

      <div className="absolute right-0 z-30 mt-2 grid min-w-56 rounded-md border border-border bg-surface-elevated p-2 shadow-elevated">
        <div className="border-b border-border-subtle px-3 py-2">
          <strong className="block max-w-48 truncate text-sm text-foreground">{identity.displayName}</strong>
          <span className="mt-1 block text-[11px] text-foreground-muted">{campaignRoleLabel(access.campaignRole)}</span>
        </div>
        <Link className="mt-1 rounded-sm px-3 py-2 text-sm text-foreground-soft no-underline hover:bg-surface hover:text-foreground" href="/">Início</Link>
        {editUrl ? (
          <a className="rounded-sm px-3 py-2 text-sm text-foreground-soft no-underline hover:bg-surface hover:text-foreground" href={editUrl}>Editar <span className="sr-only">no app legado</span></a>
        ) : null}
        <form action="/auth/logout" method="post" className="mt-1 border-t border-border pt-1">
          <button className="w-full rounded-sm px-3 py-2 text-left text-sm text-foreground-soft hover:bg-surface hover:text-danger" type="submit">Sair</button>
        </form>
      </div>
    </details>
  )
}
