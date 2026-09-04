# DnD Scribe — Web Next

App público moderno do DnD Scribe, criado durante o roadmap de modernização.

## Estado atual

A aplicação já contém:

- App Router;
- Design System próprio dark/light;
- Supabase Auth SSR/cookies;
- shell autenticado;
- Home moderna;
- `/sessoes`;
- `/sessoes/[id]` com resumo como entrada padrão;
- `/sessoes/[id]/transcricao`;
- busca/filtro/cursor/progressive load;
- download `.md`;
- compatibilidade de links hash antigos;
- BFF server-side;
- preparação do gateway legado para o cutover;
- testes unitários e E2E multi-browser.

O app ainda **não substituiu `dnd.faysk.dev`**. Produção permanece no frontend legado até homologação e cutover.

## Stack

- Node.js 24.x;
- Next.js 16.3.3;
- React 19.2.7;
- TypeScript 6.0.3 em `strict`;
- Tailwind CSS 4.3.0;
- Supabase JS 2.111.0;
- `@supabase/ssr` 0.12.5;
- Vitest 5.0.0;
- Playwright 1.62.1;
- pnpm 11.25.0.

TypeScript 7.0.2 foi tentado e passou no `tsc`, mas o `typescript-eslint` da stack estável ainda não suporta sua API. O ADR 013 registra TypeScript 6.0.3 como bridge temporária sem desativar lint/typecheck.

## Rodar localmente

A partir da raiz:

```bash
pnpm install --frozen-lockfile
pnpm --filter @dnd-scribe/web dev
```

Checks:

```bash
pnpm --filter @dnd-scribe/web typecheck
pnpm --filter @dnd-scribe/web lint
pnpm --filter @dnd-scribe/web test
pnpm --filter @dnd-scribe/web build
pnpm --filter @dnd-scribe/web audit:client-bundle
pnpm --filter @dnd-scribe/web measure:client-bundle
pnpm --filter @dnd-scribe/web test:e2e
```

## Envs

Copie `.env.example` para um arquivo local apropriado e forneça os valores do ambiente.

Principais fronteiras:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
DND_LEGACY_ORIGIN
DND_LEGACY_EDIT_ORIGIN   # opcional
```

`DND_LEGACY_ORIGIN` é server-only e **não pode** apontar para `dnd.faysk.dev`, porque esse hostname será móvel no cutover.

## BFF moderno

Namespace canônico:

```txt
/api/web/*
```

Rotas atuais usadas pelo client:

```txt
/api/web/library/transcript
/api/web/library/download
```

Handlers antigos em `/api/library/*` continuam temporariamente versionados durante a migração para reduzir risco, mas o client moderno já usa `/api/web/*`.

## Gateway legado

O `next.config.ts` prepara external rewrites em `fallback` para contratos que continuam no projeto antigo:

```txt
/api/* restante
/edit*
/central-local*
/terms
/privacy
/linked-role
/docs/api*
```

Como são fallback rewrites, rotas locais do Next têm precedência.

A origem é validada e deve ser uma origem HTTPS estável separada do domínio público móvel.

## Central Local

`/edit*` e `/central-local*` preservam a política necessária para acesso local:

```txt
Permissions-Policy: local-network=(self), loopback-network=(self)
```

A efetividade final em external rewrite será homologada no release candidate da Vercel antes do cutover.

## Coexistência

O projeto legado continua responsável por:

- API antiga;
- Central Local/Edit;
- integrations;
- jobs;
- crons;
- build/frontend de produção até o cutover.

A modernização do app público não reescreve essas superfícies ao mesmo tempo.

## Qualidade

A matriz automatizada roda em:

- Desktop Chromium;
- Desktop Firefox;
- Desktop WebKit;
- Mobile Chromium;
- Mobile WebKit.

O cutover continua bloqueado até homologação autenticada, benchmark real e aprovação do release candidate.

## Documentação

O estado canônico do roadmap está em:

```txt
docs/modernizacao/README.md
```

O ponto de retomada enquanto a Vercel está em standby é:

```txt
docs/modernizacao/44-standby-vercel.md
```
