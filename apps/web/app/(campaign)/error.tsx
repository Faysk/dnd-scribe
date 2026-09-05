'use client'

import { ActionLink, Button } from '@/components/ui/action'
import { Surface } from '@/components/ui/surface'
import { BodyCopy, Eyebrow, SectionTitle } from '@/components/ui/typography'

export default function CampaignError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <div className="mx-auto w-[min(900px,calc(100%-2.5rem))] py-16 sm:py-24">
      <Surface className="p-8 sm:p-10" tone="elevated">
        <Eyebrow>Arquivo temporariamente indisponível</Eyebrow>
        <SectionTitle className="mt-4">Algo interrompeu esta memória.</SectionTitle>
        <BodyCopy className="mt-4 max-w-2xl">Se foi uma falha transitória, tentar novamente deve retomar a leitura sem expor detalhes internos do sistema.</BodyCopy>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button onClick={reset} variant="primary">Tentar novamente</Button>
          <ActionLink href="/sessoes" variant="tertiary">Voltar às sessões</ActionLink>
        </div>
      </Surface>
    </div>
  )
}
