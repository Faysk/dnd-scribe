# 32 — Fase 4: execução do Design System

Status: **implementação iniciada em paralelo ao gate de Preview da Fase 3**

## Contexto

A Fase 3 já entregou o bootstrap técnico do `apps/web`, CI e lockfile reproduzível. O único gate externo ainda aberto é o projeto Vercel separado registrado no issue #27.

A regra do roadmap permite iniciar uma fase em paralelo quando isso não compromete o gate anterior. A Fase 4 atua somente no `apps/web`, não altera o frontend legado, não toca em `dnd.faysk.dev`, API, Supabase, RLS ou Central Local. Por isso o Design System pode ser implementado enquanto o Preview separado aguarda criação.

## Fonte visual

O mapeamento inicial deriva diretamente do `web/library.css` legado.

### Legado → semântica nova

```txt
--ink          → canvas
--ink-soft     → canvas-subtle
--panel        → surface
--panel-hover  → surface-hover
--line         → border
--line-soft    → border-subtle
--paper        → foreground
--paper-soft   → foreground-soft
--muted        → foreground-muted
--gold         → accent
--gold-bright  → accent-strong
--gold-fade    → accent-muted
--danger       → danger
--success      → success
--shadow       → shadow-elevated
--serif        → font-display / font-body
--sans         → font-ui
```

No código os custom properties usam prefixo `--ds-*` para evitar colisões, enquanto o Tailwind 4 expõe o vocabulário semântico (`bg-canvas`, `text-foreground`, `border-border`, `text-accent`, etc.).

## Tokens implementados

- canvas / canvas-subtle;
- surface / surface-hover / surface-elevated;
- border / border-subtle;
- foreground / foreground-soft / foreground-muted;
- accent / accent-strong / accent-muted / accent-contrast;
- danger / success;
- shadow-elevated;
- radius sm/md/lg/xl;
- font-display / font-body / font-ui;
- ambient accents específicos por tema.

Dark e light compartilham a mesma semântica. O dark preserva o caráter de grimório noturno; o light usa papel quente e bronze.

## Fundamentos implementados

```txt
components/ui/action.tsx
  Button
  ActionLink
  actionStyles

components/ui/surface.tsx
  Surface

components/ui/status.tsx
  StatusPill

components/ui/typography.tsx
  Eyebrow
  DisplayTitle
  SectionTitle
  BodyCopy
  MetaText

lib/class-names.ts
  cn
```

Esses componentes cobrem os elementos essenciais necessários para reconstruir Home, arquivo de sessões e página de sessão sem criar CSS específico improvisado em cada tela.

## Catálogo visual

A rota interna `/design-system` exibe lado a lado, sem JavaScript de tema:

- dark specimen;
- light specimen;
- tipografia;
- superfícies;
- hierarquia de ações;
- estados compactos;
- tokens de cor;
- regras de composição.

O catálogo existe para validação durante Preview e não é uma feature de domínio do produto.

## Acessibilidade incorporada

- foco visível global;
- contraste semântico separado por tema;
- `prefers-reduced-motion` respeitado;
- ações com área mínima confortável;
- estados não dependem exclusivamente de cor;
- tipografia editorial mantém largura e ritmo de leitura.

## Testes

- unit test para composição de classes;
- smoke E2E do Preview técnico preservado;
- smoke E2E do catálogo visual em dark/light;
- pipeline continua executando typecheck, lint, Vitest, build e Playwright.

## Gate da Fase 4

O gate técnico desta fase é considerar os elementos essenciais da UI reconstruíveis sem CSS improvisado por tela.

Para encerramento formal ainda devem ser confirmados:

- CI verde no PR da Fase 4;
- catálogo visual aprovado no Preview separado;
- nenhuma regressão no CI legado.

Enquanto o issue #27 estiver aberto, a validação visual externa permanece pendente, mas não bloqueia a implementação isolada do Design System.
