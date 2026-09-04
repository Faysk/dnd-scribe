import { MetaText } from '@/components/ui/typography'
import type { LibrarySession } from '@/lib/api/contracts/library'
import { formatCount, formatDuration } from '@/lib/formatters'

function totalDuration(sessions: readonly LibrarySession[]) {
  const value = sessions.reduce((sum, session) => sum + (session.durationMs || 0), 0)
  return value > 0 ? formatDuration(value) : '—'
}

type ArchiveStatsProps = Readonly<{
  sessions: readonly LibrarySession[]
}>

export function ArchiveStats({ sessions }: ArchiveStatsProps) {
  const totalSegments = sessions.reduce((sum, session) => sum + session.segments, 0)
  const arcs = new Set(sessions.map((session) => session.arc).filter(Boolean)).size

  return (
    <section aria-label="Dimensão do arquivo" className="grid gap-5 border-y border-border-subtle py-6 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <strong className="font-display text-3xl font-normal text-foreground">{formatCount(sessions.length)}</strong>
        <MetaText className="mt-1">sessões no arquivo</MetaText>
      </div>
      <div>
        <strong className="font-display text-3xl font-normal text-foreground">{formatCount(totalSegments)}</strong>
        <MetaText className="mt-1">falas registradas</MetaText>
      </div>
      <div>
        <strong className="font-display text-3xl font-normal text-foreground">{formatCount(arcs)}</strong>
        <MetaText className="mt-1">arcos nomeados</MetaText>
      </div>
      <div>
        <strong className="font-display text-3xl font-normal text-foreground">{totalDuration(sessions)}</strong>
        <MetaText className="mt-1">de mesa registrada</MetaText>
      </div>
    </section>
  )
}
