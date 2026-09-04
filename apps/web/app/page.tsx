import { ActionLink } from '@/components/ui/action'
import { StatusPill } from '@/components/ui/status'
import { Surface } from '@/components/ui/surface'
import { BodyCopy, DisplayTitle, Eyebrow } from '@/components/ui/typography'
import { bootstrapContent } from '@/lib/bootstrap'

export default function HomePage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10 sm:px-8">
      <Surface
        aria-labelledby="bootstrap-title"
        className="w-full max-w-2xl p-7 sm:p-10 lg:p-14"
        tone="elevated"
      >
        <Eyebrow>{bootstrapContent.eyebrow}</Eyebrow>
        <DisplayTitle className="mt-4" id="bootstrap-title">
          {bootstrapContent.title}
        </DisplayTitle>
        <BodyCopy className="mt-6 max-w-xl">{bootstrapContent.description}</BodyCopy>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <StatusPill tone="accent">{bootstrapContent.status}</StatusPill>
          <ActionLink href="/design-system" size="sm" variant="tertiary">
            Abrir catálogo visual
          </ActionLink>
        </div>
      </Surface>
    </main>
  )
}
