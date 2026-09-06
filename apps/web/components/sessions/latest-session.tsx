import { ArtworkImage } from '@/components/media/artwork-image'
import { ActionLink } from '@/components/ui/action'
import { BodyCopy, Eyebrow, MetaText } from '@/components/ui/typography'
import type { PublicSession } from '@/lib/api/contracts/public-library'
import { displaySessionTitle, formatSessionDate } from '@/lib/formatters'

type LatestSessionProps = Readonly<{
  session: PublicSession
}>

export function LatestSession({ session }: LatestSessionProps) {
  const title = displaySessionTitle(session.title, session.sessionDate)
  const art = session.heroImageUrl || session.coverImageUrl

  return (
    <section
      aria-labelledby="latest-session-title"
      className="mx-auto grid w-full max-w-[1080px] overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-elevated lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.86fr)]"
    >
      <div className="flex flex-col p-7 sm:p-8 lg:p-9">
        <Eyebrow>Última memória</Eyebrow>

        {session.arc ? (
          <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-ui">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground-muted">Arco</span>
            <span className="text-sm font-semibold leading-5 text-accent">{session.arc}</span>
          </div>
        ) : null}

        <h2
          className="mt-3 max-w-3xl font-display text-4xl leading-[1.03] tracking-[-0.035em] text-foreground sm:text-5xl"
          id="latest-session-title"
        >
          {title}
        </h2>

        <BodyCopy className="mt-5 max-w-2xl lg:line-clamp-5">
          {session.summary || 'O resumo curto desta sessão ainda não foi publicado.'}
        </BodyCopy>

        <div className="mt-6">
          <MetaText>{formatSessionDate(session.sessionDate)}</MetaText>
        </div>

        <div className="mt-8">
          <ActionLink
            href={`/sessoes/${encodeURIComponent(session.sourceSessionId)}`}
            variant="primary"
          >
            Ler esta memória
          </ActionLink>
        </div>
      </div>

      <div className="relative min-h-64 overflow-hidden bg-surface sm:min-h-80 lg:min-h-[24rem]">
        {art ? (
          <ArtworkImage
            alt=""
            className="object-cover object-center"
            priority
            sizes="(min-width: 1024px) 44vw, 100vw"
            src={art}
          />
        ) : (
          <div className="grid h-full min-h-64 place-items-center bg-[radial-gradient(circle_at_50%_35%,var(--ds-accent-muted),transparent_48%),var(--ds-surface)] font-display text-8xl text-accent/35 sm:min-h-80 lg:min-h-[24rem]">
            20
          </div>
        )}
      </div>
    </section>
  )
}
