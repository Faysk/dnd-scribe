import { ActionLink } from '@/components/ui/action'
import { StatusPill } from '@/components/ui/status'
import { Surface } from '@/components/ui/surface'
import { BodyCopy, DisplayTitle, Eyebrow } from '@/components/ui/typography'
import { bootstrapContent } from '@/lib/bootstrap'
import { readPublicSupabaseConfig } from '@/lib/config'

export default function CampaignHomePage() {
  const authConfigured = Boolean(readPublicSupabaseConfig())

  return (
    <div className="grid min-h-[calc(100vh-77px)] place-items-center px-5 py-10 sm:px-8">
      <Surface aria-labelledby="phase-title" className="w-full max-w-2xl p-7 sm:p-10 lg:p-14" tone="elevated">
        <Eyebrow>{bootstrapContent.eyebrow}</Eyebrow>
        <DisplayTitle className="mt-4" id="phase-title">
          {authConfigured ? 'Shell autenticado' : bootstrapContent.title}
        </DisplayTitle>
        <BodyCopy className="mt-6 max-w-xl">
          {authConfigured
            ? 'A moldura autenticada da campanha está ativa. A Home real e o arquivo de sessões entram somente na Fase 6.'
            : bootstrapContent.description}
        </BodyCopy>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <StatusPill tone="accent">
            {authConfigured ? 'Fase 5 · Auth + App Shell' : bootstrapContent.status}
          </StatusPill>
          <ActionLink href="/design-system" size="sm" variant="tertiary">Abrir catálogo visual</ActionLink>
        </div>
      </Surface>
    </div>
  )
}
