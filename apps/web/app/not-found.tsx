import { ActionLink } from '@/components/ui/action'
import { Surface } from '@/components/ui/surface'
import { BodyCopy, Eyebrow, SectionTitle } from '@/components/ui/typography'

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh w-[min(900px,calc(100%-2.5rem))] place-items-center py-16" id="content" tabIndex={-1}>
      <Surface className="w-full p-8 sm:p-10" tone="elevated">
        <Eyebrow>Página não encontrada</Eyebrow>
        <SectionTitle className="mt-4">Essa lembrança não está por aqui.</SectionTitle>
        <BodyCopy className="mt-4 max-w-2xl">Confira o endereço ou volte ao arquivo principal da campanha.</BodyCopy>
        <div className="mt-7"><ActionLink href="/" variant="primary">Voltar ao DnD Scribe</ActionLink></div>
      </Surface>
    </main>
  )
}
