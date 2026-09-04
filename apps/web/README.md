# DnD Scribe — Web Next

Novo app público do DnD Scribe, criado durante a Fase 3 da modernização.

## Estado

**Bootstrap técnico.**

Este diretório ainda não contém a Home final, autenticação real, arquivo de sessões, resumo ou transcrição. O objetivo desta fase é validar a nova fundação sem alterar a produção legada.

## Stack do bootstrap

- Node.js 24 LTS;
- Next.js 16.3.3;
- React 19.2.7;
- TypeScript 7.0.2 em `strict`;
- Tailwind CSS 4.3.0;
- Vitest 5;
- Playwright 1.62;
- pnpm 11.25.

As versões acima são as versões efetivamente tentadas no bootstrap e só são consideradas aceitas depois de `typecheck`, `lint`, `test`, `build` e E2E verdes no CI.

## Rodar localmente

A partir da raiz do repositório:

```bash
pnpm install
pnpm --filter @dnd-scribe/web dev
```

Checks:

```bash
pnpm --filter @dnd-scribe/web typecheck
pnpm --filter @dnd-scribe/web lint
pnpm --filter @dnd-scribe/web test
pnpm --filter @dnd-scribe/web build
pnpm --filter @dnd-scribe/web test:e2e
```

## Coexistência

O frontend legado continua em `web/` e o build de produção do repositório raiz continua usando npm e `scripts/sync-public.js`.

A Fase 3 **não** move `dnd.faysk.dev`, não altera API/Supabase, não remove a Central Local e não implementa features novas.

## Próxima etapa

Depois que o bootstrap estiver verde em CI e publicado em um projeto Vercel separado, a Fase 4 começa a reconstrução do Design System oficial dark/light do DnD Scribe.
