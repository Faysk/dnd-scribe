import { ActionLink } from '@/components/ui/action'
import { Surface } from '@/components/ui/surface'
import { BodyCopy, Eyebrow, SectionTitle } from '@/components/ui/typography'

export default function CampaignNotFound() {
  return (
    <div className="mx-auto w-[min(900px,calc(100%-2.5rem))] py-16 sm:py-24">
      <Surface className="p-8 sm:p-10" tone="elevated">
        <Eyebrow>Memória não encontrada</Eyebrow>
        <SectionTitle className="mt-4">Esta página não existe no arquivo.</SectionTitle>
        <BodyCopy className="mt-4 max-w-2xl">O endereço pode ter mudado ou a sessão pode não fazer parte desta campanha.</BodyCopy>
        <div className="mt-7 flex flex-wrap gap-3">
          <ActionLink href="/sessoes" variant="primary">Abrir sessões</ActionLink>
          <ActionLink href="/" variant="tertiary">Voltar ao início</ActionLink>
        </div>
      </Surface>
    </div>
  )
}
