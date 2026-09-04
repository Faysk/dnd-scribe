import type { Metadata } from 'next'

import { ActionLink, Button } from '@/components/ui/action'
import { StatusPill } from '@/components/ui/status'
import { Surface } from '@/components/ui/surface'
import {
  BodyCopy,
  DisplayTitle,
  Eyebrow,
  MetaText,
  SectionTitle,
} from '@/components/ui/typography'
import { cn } from '@/lib/class-names'

export const metadata: Metadata = {
  title: 'Design system — DnD Scribe',
  description: 'Catálogo visual interno dos fundamentos do DnD Scribe.',
}

const colorTokens = [
  ['Canvas', 'bg-canvas'],
  ['Canvas subtle', 'bg-canvas-subtle'],
  ['Surface', 'bg-surface'],
  ['Surface hover', 'bg-surface-hover'],
  ['Foreground', 'bg-foreground'],
  ['Foreground soft', 'bg-foreground-soft'],
  ['Muted', 'bg-foreground-muted'],
  ['Accent', 'bg-accent'],
  ['Accent strong', 'bg-accent-strong'],
] as const

type ThemeSpecimenProps = Readonly<{
  theme: 'dark' | 'light'
  label: string
  description: string
}>

function ThemeSpecimen({ description, label, theme }: ThemeSpecimenProps) {
  return (
    <article
      className="rounded-xl border border-border bg-canvas p-5 text-foreground shadow-elevated sm:p-7"
      data-theme={theme}
    >
      <div className="border-b border-border-subtle pb-6">
        <Eyebrow>{label}</Eyebrow>
        <SectionTitle className="mt-3">{description}</SectionTitle>
        <MetaText className="mt-3 max-w-2xl">
          A semântica permanece igual; apenas o mapeamento visual muda entre grimório e livro.
        </MetaText>
      </div>

      <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
        <div>
          <Eyebrow>Tipografia</Eyebrow>
          <h3 className="mt-3 font-display text-4xl leading-none tracking-[-0.035em] text-foreground">
            Memórias merecem espaço para respirar.
          </h3>
          <BodyCopy className="mt-4 max-w-2xl">
            Texto editorial usa ritmo confortável e largura contida. Controles e metadados continuam em sans-serif para leitura rápida.
          </BodyCopy>
          <MetaText className="mt-4 uppercase tracking-[0.12em]">
            Sessão 42 · 3h 18min · 1.284 falas
          </MetaText>
        </div>

        <Surface className="p-5" tone="subtle">
          <Eyebrow>Superfície contextual</Eyebrow>
          <p className="mt-3 font-ui text-sm leading-6 text-foreground-soft">
            Cards existem quando o conteúdo é uma entidade ou um estado compacto — não para embrulhar qualquer parágrafo.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <StatusPill tone="success">Publicado</StatusPill>
            <StatusPill tone="accent">Arco atual</StatusPill>
          </div>
        </Surface>
      </div>

      <div className="border-t border-border-subtle pt-8">
        <Eyebrow>Hierarquia de ações</Eyebrow>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="primary">Ação primária</Button>
          <Button variant="secondary">Ação secundária</Button>
          <Button variant="tertiary">Ação terciária</Button>
        </div>
      </div>

      <div className="mt-8 border-t border-border-subtle pt-8">
        <Eyebrow>Tokens de cor</Eyebrow>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {colorTokens.map(([name, swatchClass]) => (
            <div className="rounded-md border border-border-subtle bg-canvas-subtle p-3" key={name}>
              <div
                aria-hidden="true"
                className={cn('h-12 rounded-sm border border-border-subtle', swatchClass)}
              />
              <MetaText className="mt-2">{name}</MetaText>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

export default function DesignSystemPage() {
  return (
    <main className="mx-auto w-[min(1180px,calc(100%-2.5rem))] py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-4xl text-center">
        <Eyebrow>Fase 4 · catálogo interno</Eyebrow>
        <DisplayTitle className="mt-4">Design system</DisplayTitle>
        <BodyCopy className="mx-auto mt-6 max-w-3xl">
          A identidade do DnD Scribe saiu de CSS solto por tela e virou linguagem semântica: editorial, contida e pronta para dark e light sem virar dashboard genérico.
        </BodyCopy>
        <div className="mt-7 flex justify-center">
          <ActionLink href="/" size="sm" variant="tertiary">
            Voltar ao Preview técnico
          </ActionLink>
        </div>
      </div>

      <div className="mt-12 grid gap-8">
        <ThemeSpecimen
          description="Grimório noturno"
          label="Dark mode"
          theme="dark"
        />
        <ThemeSpecimen description="Arquivo em papel quente" label="Light mode" theme="light" />
      </div>

      <section className="mx-auto mt-12 max-w-4xl border-t border-border-subtle pt-8">
        <Eyebrow>Regras de composição</Eyebrow>
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <div>
            <p className="font-display text-2xl text-foreground">Uma pergunta</p>
            <MetaText className="mt-2">Cada página tem um objetivo principal claro.</MetaText>
          </div>
          <div>
            <p className="font-display text-2xl text-foreground">Uma ação forte</p>
            <MetaText className="mt-2">Apenas uma ação primária compete por atenção em cada região.</MetaText>
          </div>
          <div>
            <p className="font-display text-2xl text-foreground">Profundidade sob demanda</p>
            <MetaText className="mt-2">Informação secundária aparece só quando ajuda a próxima decisão.</MetaText>
          </div>
        </div>
      </section>
    </main>
  )
}
