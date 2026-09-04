import Link from 'next/link'

type SessionNavigationProps = Readonly<{
  sourceSessionId: string
  active: 'summary' | 'transcript'
}>

export function SessionNavigation({ active, sourceSessionId }: SessionNavigationProps) {
  const encoded = encodeURIComponent(sourceSessionId)

  return (
    <nav aria-label="Conteúdo da sessão" className="flex gap-1 border-b border-border-subtle">
      <Link
        aria-current={active === 'summary' ? 'page' : undefined}
        className={active === 'summary'
          ? 'border-b-2 border-accent px-4 py-3 font-ui text-sm font-semibold text-foreground no-underline'
          : 'border-b-2 border-transparent px-4 py-3 font-ui text-sm text-foreground-muted no-underline hover:text-foreground'}
        href={`/sessoes/${encoded}`}
      >
        Resumo
      </Link>
      <Link
        aria-current={active === 'transcript' ? 'page' : undefined}
        className={active === 'transcript'
          ? 'border-b-2 border-accent px-4 py-3 font-ui text-sm font-semibold text-foreground no-underline'
          : 'border-b-2 border-transparent px-4 py-3 font-ui text-sm text-foreground-muted no-underline hover:text-foreground'}
        href={`/sessoes/${encoded}/transcricao`}
      >
        Transcrição
      </Link>
    </nav>
  )
}
