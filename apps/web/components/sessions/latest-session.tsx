import Link from 'next/link'

import { StatusPill } from '@/components/ui/status'
import { BodyCopy, Eyebrow, MetaText } from '@/components/ui/typography'
import type { LibrarySession } from '@/lib/api/contracts/library'
import { displaySessionTitle, formatCount, formatDuration, formatSessionDate } from '@/lib/formatters'

function artworkStyle(url: string) {
  return url ? { backgroundImage: `url(${JSON.stringify(url)})` } : undefined
}

type LatestSessionProps = Readonly<{
  session: LibrarySession
}>

export function LatestSession({ session }: LatestSessionProps) {
  const title = displaySessionTitle(session.title, session.sessionDate)
  const art = session.heroImageUrl || session.coverImageUrl

  return (
    <section aria-labelledby="latest-session-title" className="grid overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-elevated lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
      <div className="flex flex-col p-7 sm:p-9 lg:p-11">
        <div className="flex flex-wrap items-center gap-3">
          <Eyebrow>Última memória publicada</Eyebrow>
          {session.arc ? <StatusPill tone="accent">{session.arc}</StatusPill> : null}
        </div>
        <h2 className="mt-5 max-w-3xl font-display text-4xl leading-[1.03] tracking-[-0.035em] text-foreground sm:text-5xl" id="latest-session-title">
          {title}
        </h2>
        <BodyCopy className="mt-5 max-w-2xl">
          {session.summary || 'O resumo curto desta sessão ainda não foi publicado.'}
        </BodyCopy>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
          <MetaText>{formatSessionDate(session.sessionDate)}</MetaText>
          <MetaText>{formatDuration(session.durationMs)}</MetaText>
          <MetaText>{formatCount(session.segments)} falas</MetaText>
          <MetaText>{formatCount(session.participants)} participantes</MetaText>
        </div>
        <div className="mt-8">
          <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-accent-strong bg-accent-strong px-4 font-ui text-sm font-semibold text-accent-contrast no-underline transition-[background-color,border-color,transform] hover:-translate-y-px hover:border-accent hover:bg-accent" href={`/sessoes/${encodeURIComponent(session.sourceSessionId)}`}>
            Relembrar esta sessão
          </Link>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="min-h-72 bg-surface bg-cover bg-center lg:min-h-full"
        style={artworkStyle(art)}
      >
        {!art ? (
          <div className="grid h-full min-h-72 place-items-center bg-[radial-gradient(circle_at_50%_35%,var(--ds-accent-muted),transparent_48%),var(--ds-surface)] font-display text-8xl text-accent/35">
            20
          </div>
        ) : null}
      </div>
    </section>
  )
}
