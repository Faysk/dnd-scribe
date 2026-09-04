# Modernização do DnD Scribe — Roadmap mestre

Status: **blocos não-Vercel preparados até a Fase 15; RC/homologação/cutover em standby de plataforma**  
Data de referência: **2026-09-04**  
Escopo: **modernização tecnológica e de UX sem novas features de domínio**

## Objetivo

Modernizar o app público do DnD Scribe preservando o que funciona hoje, sem iniciar ainda Pessoas/NPCs, lore editável, galerias, timeline, relações, grafo ou outro domínio novo.

> Regra principal: primeiro modernizar a casa; depois ampliar a casa.

## Estado atual

```txt
Fases 0–2   → fundação, arquitetura e contratos concluídos
Fases 3–8   → app Next funcional implementado
Fase 9      → qualidade/segurança/a11y: bloco técnico concluído
Fase 10     → performance: bloco técnico concluído; benchmark autenticado pendente
Fase 11     → bloco automatizado concluído; uso real autenticado pendente
Fase 12     → roteiro/corpus/evidências preparados; execução no RC pendente
Fase 13     → gateway/runbook/rollback preparados; domínio não movido
Fase 14     → runbook de estabilização pronto; janela ainda não iniciada
Fase 15     → relatório final factual pré-preenchido; declaração final bloqueada
```

A produção continua deliberadamente no legado:

```txt
https://dnd.faysk.dev
```

Nenhum cutover foi realizado.

## O que foi fechado enquanto a Vercel está em standby

Além da matriz multi-browser já verde, os blocos finais agora possuem preparação operacional concreta:

- corpus real de homologação;
- matriz de paridade atualizada;
- namespace BFF reservado em `/api/web/*`;
- gateway legado preparado como fallback externo depois das rotas locais do Next;
- proteção anti-self-loop para `DND_LEGACY_ORIGIN`;
- preservação planejada de `/api/*`, `/edit*`, `/central-local*`, `/terms`, `/privacy`, `/linked-role` e `/docs/api*`;
- `Permissions-Policy` específica da Central Local preparada;
- smoke matrix de cutover congelada;
- critérios de rollback congelados;
- runbook de estabilização pronto;
- relatório final pré-preenchido somente com fatos já provados.

## Infra isolada do Next

Um Preview técnico real já provou a existência/isolamento do segundo projeto:

```txt
Project: dnd-scribe-web-next
Project ID: prj_RVVEAucDhhftHY3UlE8PtoNxn6yl
Deployment: dpl_Ha9etK6sk3e96qmqVxJTCmz6fLoQ
Source commit: bf7ce242d083825cc65ee03354b3c638c95e87f0
State: READY
```

Esse deploy não é o RC final porque o código continuou avançando.

### Standby Vercel

O próximo deployment precisa ser um candidato formal do SHA verde mais recente. O gate de plataforma permanece separado das evidências já concluídas em CI.

Itens diretamente dependentes do RC/plataforma:

```txt
novo deployment READY
URL final de homologação
configuração final de redirects/OAuth atrelada à URL
cookies HTTPS reais
external rewrites reais
headers reais do gateway
Home/acervo autenticados
transcrição/download reais
benchmark autenticado
homologação visual/manual
movimento de dnd.faysk.dev
observação pós-cutover
```

## Resultado automatizado consolidado

Matriz atual:

```txt
Desktop Chromium
Desktop Firefox
Desktop WebKit
Mobile Chromium — Pixel 5
Mobile WebKit — iPhone 13
```

Gate consolidado da Fase 11:

```txt
TypeScript strict        ✅
ESLint                   ✅
Vitest                   ✅
Next production build    ✅
Client bundle audit      ✅
Bundle inventory         ✅
Playwright multi-browser ✅ — 71 passed / 4 skips intencionais / 0 failed
CI legado                ✅
Companion regression     ✅
Python syntax            ✅
```

Os skips são restritos a expectativas de foco/Tab em WebKit que dependem de Full Keyboard Access; semântica e ativação continuam cobertas.

## Escopo congelado

### Entra

- Next.js + React + TypeScript strict;
- App Router e Server Components por padrão;
- design system próprio;
- dark/light de primeira classe;
- Supabase Auth SSR/cookies;
- Home reorganizada com dados existentes;
- `/sessoes`;
- resumo como página padrão;
- transcrição secundária com busca/filtro/paginação/download;
- testes/CI;
- segurança, acessibilidade e performance;
- homologação, cutover e estabilização.

### Não entra

- Pessoas/NPCs;
- lore editável;
- galerias;
- coleções;
- jornada/timeline;
- mundo;
- relações/grafo;
- busca global;
- novo modelo de canon;
- modernização da Central Local/pipeline/Whisper;
- migração completa do backend legado.

## Princípios

1. **Paridade antes de expansão**.
2. **Preservar a identidade editorial**.
3. **Dark e light são primeira classe**.
4. **Local-first permanece**.
5. **Supabase permanece**.
6. **Server-first**.
7. **TypeScript strict**.
8. **Acessibilidade não é acabamento**.
9. **Preview antes de produção**.
10. **Sem “já que estamos aqui”**.

## Stack operacional atual

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
| Processamento pesado | local companion atual |

## Topologia de coexistência

Durante homologação:

```txt
Browser
→ Next
→ BFF /api/web/*
→ DND_LEGACY_ORIGIN
→ projeto legado
→ Supabase/PostgreSQL
```

Após cutover:

```txt
dnd.faysk.dev
→ Next
├── páginas modernas
├── /api/web/* local
└── fallback legado
    ├── /api/* restante
    ├── /edit*
    ├── /central-local*
    ├── /terms
    ├── /privacy
    ├── /linked-role
    └── /docs/api*
        → origem legada
```

API antiga, Central Local/Edit, jobs, integrações e crons podem permanecer no projeto legado deliberadamente.

## Rotas do app público

```txt
/                         → Home
/sessoes                  → arquivo
/sessoes/[id]             → resumo
/sessoes/[id]/transcricao → transcrição
```

Compatibilidade histórica:

```txt
#/sessao/:id        → /sessoes/:id/transcricao
#/sessao/:id/resumo → /sessoes/:id
```

A bridge possui cobertura unitária e E2E.

## Fases

| Fase | Nome | Estado atual | Evidência |
| --- | --- | --- | --- |
| 0 | Baseline | **concluída** | docs 01, 10, 11, 16, 30 |
| 1 | Arquitetura | **concluída** | doc 02 + ADRs |
| 2 | ADRs/contratos | **concluída** | ADRs |
| 3 | Bootstrap | **implementada/validada** | Next + CI + projeto isolado |
| 4 | Design system | **implementada** | temas/tokens/componentes |
| 5 | Auth/shell | **implementada; RC real pendente** | SSR auth |
| 6 | Home/arquivo | **implementada; dados reais pendentes** | `/` + `/sessoes` |
| 7 | Sessão | **implementada; dados reais pendentes** | `/sessoes/[id]` |
| 8 | Transcrição | **implementada; dados reais pendentes** | reader/BFF |
| 9 | Qualidade/security/a11y | **bloco técnico concluído** | execução Fase 9 |
| 10 | Performance | **bloco técnico concluído** | doc 38 |
| 11 | Paridade | **automação concluída; RC pendente** | docs 37, 39 + matriz |
| 12 | Homologação | **preparada; execução RC pendente** | docs 26 e 40 |
| 13 | Cutover | **readiness concluída; domínio em standby** | docs 27 e 41 |
| 14 | Estabilização | **runbook pronto; aguarda produção** | docs 28 e 42 |
| 15 | Encerramento | **rascunho final pronto; declaração bloqueada** | docs 29 e 43 |

Preparar uma fase posterior não significa falsamente declarar seu gate cronológico concluído.

## Corpus fixo

Casos reais congelados em [39 — Corpus real de homologação](39-fase-11-corpus-homologacao.md), incluindo sessão mais recente, resumo longo, maior transcrição, transcrição histórica, duração ausente e ID manual longo.

## Definition of Done

Já provado:

- [x] TypeScript strict;
- [x] lint/typecheck/unit/build;
- [x] E2E multi-browser determinístico;
- [x] client bundle sem marcadores server-only;
- [x] bridge de links históricos;
- [x] gateway preparado em código;
- [x] runbooks de homologação/cutover/estabilização preparados;
- [x] relatório final pré-preenchido sem inventar produção.

Ainda depende de RC/produção real:

- [ ] nova stack em `dnd.faysk.dev`;
- [ ] login/permissões homologados;
- [ ] acervo real homologado;
- [ ] resumo/transcrição reais homologados;
- [ ] dark/light desktop/mobile aprovados;
- [ ] benchmark autenticado;
- [ ] cookies/OAuth HTTPS finais;
- [ ] gateway real homologado;
- [ ] rollback ensaiado na plataforma;
- [ ] estabilização encerrada;
- [ ] relatório final preenchido com produção;
- [ ] `MODERNIZAÇÃO: COMPLETA`.

## Documentação principal

### Fundação

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

### Baseline/arquitetura

- [10 — Contratos legados](10-contratos-legado-app-publico.md)
- [11 — Evidências Fase 0](11-fase-0-evidencias-e-checklist.md)
- [12 — Deploy/dependências legado](12-inventario-deploy-e-dependencias-legado.md)
- [13 — Supabase/fronteira de dados](13-inventario-supabase-e-fronteira-de-dados.md)
- [14 — Topologia Vercel](14-topologia-preview-e-coexistencia-vercel.md)
- [15 — Gates Fases 1/2](15-fases-1-2-gates.md)
- [16 — Runbook baseline](16-fase-0-runbook-de-captura.md)
- [30 — Encerramento Fase 0](30-fase-0-encerramento.md)

### Execução/fases finais

- [25 — Plano Fase 11](25-fase-11-paridade-total-plano-de-execucao.md)
- [26 — Plano Fase 12](26-fase-12-homologacao-plano-de-execucao.md)
- [27 — Plano Fase 13](27-fase-13-cutover-plano-de-execucao.md)
- [28 — Plano Fase 14](28-fase-14-estabilizacao-plano-de-execucao.md)
- [29 — Plano Fase 15](29-fase-15-encerramento-plano-de-execucao.md)
- [37 — Execução Fase 11](37-fase-11-paridade-execucao.md)
- [38 — Performance](38-fase-10-performance-execucao.md)
- [39 — Corpus real](39-fase-11-corpus-homologacao.md)
- [40 — Homologação preparada](40-fase-12-homologacao-preparada.md)
- [41 — Cutover readiness](41-fase-13-cutover-readiness.md)
- [42 — Runbook estabilização](42-fase-14-estabilizacao-runbook.md)
- [43 — Relatório final draft](43-fase-15-relatorio-final-draft.md)

### ADRs

As decisões aceitas permanecem em [`adr/`](adr/README.md). Exceções incompatíveis exigem atualização/novo ADR, não alteração silenciosa.

## Próximo gate externo

O único avanço cronológico que não pode ser simulado por código/documentação é publicar o **release candidate final**, homologá-lo com sessão real e então executar o movimento do domínio.

Até esse gate, a modernização fica em estado de **readiness máximo sem cutover**, com produção antiga preservada.
