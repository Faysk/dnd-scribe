> **Referência histórica — direção substituída em 2026-09-06.** O [reboot TDA](reboot/README.md) define o plano vigente. Este documento preserva decisões/evidências do escopo anterior; versões, fases e declarações de conclusão abaixo não certificam o estado do reboot. Revalidar requisitos antes de reutilizá-los.

# Inventário inicial do backend — Fase 2

## Objetivo

Este documento abre a Fase 2 com um mapa verificável do backend operacional antes de qualquer migração de rota. A regra continua sendo a do roadmap: `apps/web` será o backend HTTP canônico e cada responsabilidade antiga só será removida depois de paridade e validação.

## Estado em 2026-09-06

- `api/[...path].js`: **336.927 bytes** no início da Fase 2;
- o monólito concentra GET/POST de auth, lore, áudio, pipeline/jobs, Roll20, Discord, storage/R2, RBAC, biblioteca, Edit, sessões, publicações e revisão;
- além do catch-all, existem entrypoints standalone em `api/` para biblioteca pública, transcrição, download, custo/integrações, auth, jobs e uploads;
- `apps/web` já possui Route Handlers modernos em `/api/web/*` e `/api/library/*`, mas o restante ainda cai no backend operacional via fallback;
- o domínio público continua dependente da topologia Vercel com `dnd-scribe-web-next` separado. Enquanto o cutover administrativo da #48 não estiver concluído, nenhuma rota pública deve ser removida do backend raiz sem replacement validado.

## Guardrail executável

`tools/inventory_backend_routes.js` lê o código real e extrai:

1. rotas literais tratadas por `api/[...path].js`;
2. agrupamento aproximado por domínio;
3. entrypoints `.js` standalone em `api/`;
4. tamanho atual do monólito.

Comandos:

```bash
node tools/inventory_backend_routes.js
node tools/inventory_backend_routes.js --json
node tools/inventory_backend_routes.js --check
```

O modo `--check` falha se o catch-all crescer acima do baseline de 336.927 bytes. A partir deste ponto, o arquivo gigante só pode diminuir ou permanecer estável enquanto uma extração ainda está em andamento.

## Ordem inicial de extração

A ordem prioriza baixo acoplamento e risco reduzido antes de tocar jobs/transações:

1. endpoints read-only/sem estado e contratos auxiliares;
2. biblioteca e downloads já cobertos pelo BFF Next;
3. auth/capabilities em conjunto com a Fase 3, evitando criar uma segunda sessão;
4. sessões/Edit e mutações editoriais;
5. storage/uploads;
6. jobs/pipeline;
7. Roll20/Discord/integrações;
8. publicação/review e demais fluxos transacionais.

Cada extração deve, no mesmo slice ou numa janela explicitamente registrada na #51:

- criar o Route Handler TypeScript;
- mover regra de domínio para módulo sem dependência de HTTP quando aplicável;
- cobrir contrato e autorização;
- validar preview/CI/smoke;
- remover a implementação antiga da mesma rota;
- reexecutar o inventário e confirmar que o monólito não cresceu.

## Primeira janela de migração — health

O primeiro endpoint selecionado é `GET /api/health`, por ser read-only, sem estado, sem banco e sem autorização.

No slice inicial:

- `/api/web/health` permanece a implementação canônica em TypeScript;
- `/api/health` passa a existir também dentro de `apps/web` como reexport da mesma implementação, sem duplicar regra HTTP;
- o payload canônico inclui `app: dnd-scribe-vercel` e `campaignSlug: yuhara-main` para preservar os campos expostos pelo endpoint raiz antigo;
- E2E cobre os dois caminhos no build Next.

A implementação dentro de `api/[...path].js` **permanece temporariamente ativa no projeto raiz**. Ela só pode ser removida depois que o projeto `dnd-scribe-web-next` estiver executando um build da `main` que contenha `/api/health`, e um smoke do replacement confirmar status, cache e contrato. Essa exceção é uma janela de migração explícita exigida pela #48; não autoriza criar novas dependências do endpoint legado.

## Bloqueio de infraestrutura atual

A #48 continua aberta porque `dnd-scribe-web-next` ainda é um projeto separado sem Git Integration. O projeto raiz `dnd-scribe` mantém `dnd.faysk.dev` e faz rewrites para esse projeto intermediário. A inspeção em 2026-09-06 confirmou que o deployment de produção do projeto Web ainda foi criado por bootstrap e clonou um SHA antigo da `main`, portanto não serve como replacement seguro para código novo da Fase 2.

Enquanto esse bloqueio existir, mudanças da Fase 2 podem preparar e testar Route Handlers no workspace, mas uma rota operacional do projeto raiz só será removida quando o replacement correspondente estiver efetivamente publicado e validado.
