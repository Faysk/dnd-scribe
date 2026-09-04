'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/', label: 'Início', active: (pathname: string) => pathname === '/' },
  { href: '/sessoes', label: 'Sessões', active: (pathname: string) => pathname.startsWith('/sessoes') },
] as const

export function PrimaryNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Navegação principal" className="hidden items-center gap-1 md:flex">
      {items.map((item) => {
        const current = item.active(pathname)
        return (
          <Link
            aria-current={current ? 'page' : undefined}
            className={current
              ? 'rounded-sm bg-accent-muted px-3 py-2 text-sm text-foreground no-underline'
              : 'rounded-sm px-3 py-2 text-sm text-foreground-soft no-underline hover:bg-accent-muted hover:text-foreground'}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
