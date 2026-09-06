'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/sessoes', label: 'Sessões', active: (pathname: string) => pathname.startsWith('/sessoes') },
] as const

export function PrimaryNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Navegação principal" className="flex items-center">
      {items.map((item) => {
        const current = item.active(pathname)
        return (
          <Link
            aria-current={current ? 'page' : undefined}
            className={current
              ? 'rounded-full bg-accent-muted px-3.5 py-2 text-sm font-medium text-foreground no-underline'
              : 'rounded-full px-3.5 py-2 text-sm font-medium text-foreground-soft no-underline transition-colors hover:bg-accent-muted hover:text-foreground'}
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
