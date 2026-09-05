import { MetaText } from '@/components/ui/typography'
import type { PublicSession } from '@/lib/api/contracts/public-library'
import { formatCount } from '@/lib/formatters'

type ArchiveStatsProps = Readonly<{
  sessions: readonly PublicSession[]
}>

export function ArchiveStats({ sessions }: ArchiveStatsProps) {
  const summaries = sessions.filter((session) => session.hasSummary).length
  const arcs = new Set(sessions.map((session) => session.arc).filter(Boolean)).size
  const illustrated = sessions.filter((session) => session.coverImageUrl || session.heroImageUrl).length

  return (
    <section aria-label="Dimensão do arquivo público" className="grid gap-5 border-y border-border-subtle py-6 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <strong className="font-display text-3xl font-normal text-foreground">{formatCount(sessions.length)}</strong>
        <MetaText className="mt-1">sessões publicadas</MetaText>
      </div>
      <div>
        <strong className="font-display text-3xl font-normal text-foreground">{formatCount(summaries)}</strong>
        <MetaText className="mt-1">memórias completas</MetaText>
      </div>
      <div>
        <strong className="font-display text-3xl font-normal text-foreground">{formatCount(arcs)}</strong>
        <MetaText className="mt-1">arcos nomeados</MetaText>
      </div>
      <div>
        <strong className="font-display text-3xl font-normal text-foreground">{formatCount(illustrated)}</strong>
        <MetaText className="mt-1">sessões ilustradas</MetaText>
      </div>
    </section>
  )
}
