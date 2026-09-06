> **Referência histórica — direção substituída em 2026-09-06.** O [reboot TDA](../reboot/README.md) define o plano vigente. Este documento preserva decisões/evidências do escopo anterior; versões, fases e declarações de conclusão abaixo não certificam o estado do reboot. Revalidar requisitos antes de reutilizá-los.

# Modernização do DnD Scribe — Roadmap mestre

Status: **MODERNIZAÇÃO: COMPLETA ✅**  
Encerramento: **2026-09-06**  
Escopo encerrado: **modernização tecnológica e de UX sem expansão de domínio**

## Resultado

A modernização planejada nas Fases 0–15 foi concluída. O produto público está em produção em:

```txt
https://dnd.faysk.dev
```

O frontend público usa o app Next moderno. As superfícies operacionais que não faziam parte do escopo de modernização — Edit/Central Local, APIs legadas remanescentes, jobs, crons, integrações e companion local — foram deliberadamente preservadas atrás do mesmo domínio/gateway.

> Regra cumprida: primeiro modernizar a casa; depois ampliar a casa.

Nenhuma feature futura de Pessoas/NPCs, lore editável, timeline, relações, grafo ou outro domínio novo foi incorporada ao roadmap de modernização.

## Estado final das fases

```txt
Fase 0  — Baseline e congelamento           ✅ concluída
Fase 1  — Arquitetura alvo                  ✅ concluída
Fase 2  — ADRs e contratos                  ✅ concluída
Fase 3  — Bootstrap Next                    ✅ concluída
Fase 4  — Design system                     ✅ concluída
Fase 5  — Auth e shell                      ✅ concluída
Fase 6  — Home e arquivo                    ✅ concluída
Fase 7  — Resumo de sessão                  ✅ concluída
Fase 8  — Transcrição                       ✅ concluída
Fase 9  — Qualidade/security/a11y           ✅ concluída
Fase 10 — Performance                       ✅ concluída
Fase 11 — Paridade                          ✅ concluída
Fase 12 — Homologação                       ✅ concluída
Fase 13 — Cutover reversível                ✅ concluída
Fase 14 — Estabilização                     ✅ encerrada por aceite do proprietário
Fase 15 — Encerramento formal               ✅ concluída
```

O registro factual do encerramento está em [44 — Encerramento final da modernização](44-fase-15-encerramento-final.md).

## Topologia final de produção

```txt
dnd.faysk.dev
├── /, /sessoes*, /login, /auth*, /_next/*
│   └── frontend Next moderno
├── /api/web/*
│   └── BFF Next
├── /edit*, /central-local*
│   └── operação legada preservada no mesmo domínio
└── /api/* restante, jobs, crons e integrações
    └── backend legado preservado
```

O projeto Vercel separado `dnd-scribe-web-next` continua servindo o app Next, enquanto o projeto raiz `dnd-scribe` atua como gateway e mantém as superfícies operacionais legadas.

## Política de acesso final

```txt
Memória publicada
├── sessões publicadas       → público
└── resumo completo          → público

Material da mesa
├── transcrição              → login + campaign.transcript.read
├── download da transcrição  → login + campaign.transcript.read
└── revisão de fala          → campaign.transcript.read + campaign.content.edit
```

O painel Edit administra separadamente as capacidades de:

- Ver Edit;
- Editar conteúdo;
- Ver transcrições;
- Processar localmente;
- Acessar áudio.

A leitura de transcrição deixou de ser consequência implícita de membership ou acesso ao Edit.

## Stack final

| Camada | Versão/direção |
| --- | --- |
| Runtime | Node.js 24.x |
| Framework | Next.js 16.3.3 App Router |
| UI | React 19.2.7 |
| Linguagem | TypeScript 6.0.3 strict — ADR 013 |
| CSS | Tailwind CSS 4.3.0 + tokens próprios |
| Supabase JS | 2.111.0 |
| Supabase SSR | 0.12.5 |
| Unit | Vitest 5.0.0 |
| E2E | Playwright 1.62.1 |
| Package manager | pnpm 11.25.0 |
| Banco | PostgreSQL / Supabase preservado |
| Processamento pesado | companion local preservado |

## Evidência final de qualidade

O último hardening pré-encerramento foi o PR #42, com head `df80213c8ad47df156b5226c1eff6aab86a5a50c` e todos os gates verdes antes do merge:

```txt
CI raiz                 ✅
Companion regression    ✅
TypeScript strict       ✅
ESLint                  ✅
Vitest                  ✅
Next production build   ✅
Client bundle audit     ✅
Bundle inventory        ✅
Playwright multi-browser✅
```

O PR foi mergeado no `main` em `91fa1f88316d68e421813ad227dac76e6eea83e8`.

Deployment final validado do gateway:

```txt
dpl_2uGjfMAEWF1KpTdQGEbVKALYUjWN
state: READY
target: production
main SHA: 91fa1f88316d68e421813ad227dac76e6eea83e8
```

Smoke final em produção confirmou:

- Home pública moderna: 200;
- arquivo `/sessoes`: 200 com 11 sessões públicas;
- `/api/web/health`: `ready: true`;
- login Discord/Google disponível;
- transcrição anônima preserva destino e volta ao login;
- APIs de transcrição e download retornam 401 sem sessão;
- `/edit/`: 200;
- `Permissions-Policy` completa no Edit, com exceções somente para rede local;
- `/api/v1/health`: 200;
- nenhum 5xx encontrado no deployment final durante a verificação.

## Definition of Done

- [x] arquitetura alvo implementada;
- [x] stack moderna em produção;
- [x] Home e arquivo modernos;
- [x] resumo público;
- [x] auth real funcionando;
- [x] transcrição privada;
- [x] RBAC/capabilities por pessoa;
- [x] dark/light;
- [x] desktop/mobile;
- [x] testes unitários e E2E multi-browser;
- [x] segurança e acessibilidade;
- [x] performance/bundle gates;
- [x] gateway e coexistência com legado;
- [x] cutover em `dnd.faysk.dev`;
- [x] rollback preservado;
- [x] smoke real pós-cutover;
- [x] estabilização aceita pelo proprietário;
- [x] documentação final;
- [x] **MODERNIZAÇÃO: COMPLETA**.

## Dívidas aceitas — não bloqueiam o encerramento

- o projeto raiz está em **12/12 Node Functions** no limite Hobby da Vercel; novos endpoints devem consolidar functions ou exigir mudança de plano/arquitetura;
- CSP completo com nonce/hash fica como hardening futuro;
- revisão de privilégios de funções `SECURITY DEFINER` do Supabase fica como hardening dedicado;
- proteção contra senhas vazadas deve ser revisitada se autenticação por senha entrar no produto; o fluxo atual é OAuth;
- índices/FKs de performance devem ser ajustados com evidência de workload;
- há warning de depreciação Node relacionado a `url.parse()` no legado, sem impacto funcional observado;
- benchmark autenticado formal de performance fica como acompanhamento operacional, aceito pelo proprietário como não bloqueante após homologação real, gates de bundle e validação do produto em produção.

## Documentação principal

### Fundação e arquitetura

- [00 — Escopo e princípios](00-escopo-e-principios.md)
- [01 — Baseline](01-baseline-atual.md)
- [02 — Arquitetura](02-arquitetura-alvo.md)
- [03 — Roadmap](03-roadmap-fases.md)
- [04 — Design system e UX](04-design-system-e-ux.md)
- [05 — Migração](05-plano-de-migracao.md)
- [06 — Matriz de paridade](06-matriz-de-paridade.md)
- [07 — Qualidade/security/a11y](07-qualidade-seguranca-a11y.md)
- [08 — Cutover/estabilização](08-cutover-estabilizacao.md)
- [09 — Template final](09-relatorio-final-template.md)

### Execução final

- [37 — Execução Fase 11](37-fase-11-paridade-execucao.md)
- [38 — Performance](38-fase-10-performance-execucao.md)
- [39 — Corpus real](39-fase-11-corpus-homologacao.md)
- [40 — Homologação preparada](40-fase-12-homologacao-preparada.md)
- [41 — Cutover readiness](41-fase-13-cutover-readiness.md)
- [42 — Runbook de estabilização](42-fase-14-estabilizacao-runbook.md)
- [43 — Relatório final pré-cutover](43-fase-15-relatorio-final-draft.md)
- [44 — Encerramento final](44-fase-15-encerramento-final.md)

Os documentos 40–43 preservam o estado histórico de preparação anterior ao cutover. O documento 44 é a fonte canônica do estado final.

## Próximo ciclo

A modernização está encerrada. Qualquer expansão de domínio deve começar em **um novo roadmap separado**, sem reabrir artificialmente estas fases.

Possíveis temas futuros já conhecidos, fora deste escopo: Pessoas/NPCs, lore, timeline, relações, galerias, busca e outras experiências da campanha.
