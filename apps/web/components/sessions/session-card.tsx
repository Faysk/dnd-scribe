import Link from 'next/link'

import { MetaText } from '@/components/ui/typography'
import type { LibrarySession } from '@/lib/api/contracts/library'
import { displaySessionTitle, formatCount, formatDuration, formatSessionDate } from '@/lib/formatters'

function artworkStyle(url: string) {
  return url ? { backgroundImage: `url(${JSON.stringify(url)})` } : undefined
}

type SessionCardProps = Readonly<{
  session: LibrarySession
  priority?: boolean
}>

export function SessionCard({ session }: SessionCardProps) {
  const title = displaySessionTitle(session.title, session.sessionDate)
  const art = session.coverImageUrl || session.heroImageUrl

  return (
    <Link
      aria-label={`Abrir ${title}`}
      className="group grid min-h-64 overflow-hidden rounded-lg border border-border-subtle bg-canvas-subtle no-underline transition-[border-color,background-color,transform] duration-150 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface md:grid-cols-[11rem_minmax(0,1fr)]"
      href={`/sessoes/${encodeURIComponent(session.sourceSessionId)}`}
    >
      <div
        aria-hidden="true"
        className="min-h-52 bg-surface bg-cover bg-center md:min-h-full"
        style={artworkStyle(art)}
      >
        {!art ? (
          <div className="grid h-full min-h-52 place-items-center bg-[radial-gradient(circle_at_40%_20%,var(--ds-accent-muted),transparent_55%),var(--ds-surface)] font-display text-5xl text-accent/45">
            20
          </div>
        ) : null}
      </div>

      <article className="flex min-w-0 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
            {session.arc || 'Sessão'}
          </span>
          <MetaText>{formatSessionDate(session.sessionDate)}</MetaText>
        </div>

        <h2 className="mt-3 font-display text-2xl leading-tight tracking-[-0.02em] text-foreground transition-colors group-hover:text-accent-strong">
          {title}
        </h2>
        <p className="mt-3 line-clamp-3 font-body text-[15px] leading-6 text-foreground-soft">
          {session.summary || 'Esta memória ainda não possui um resumo curto publicado.'}
        </p>

        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-6 font-ui text-[11px] text-foreground-muted">
          <span>{formatDuration(session.durationMs)}</span>
          <span>{formatCount(session.segments)} falas</span>
          <span>{formatCount(session.participants)} participantes</span>
        </div>
      </article>
    </Link>
  )
}
