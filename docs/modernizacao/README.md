# Modernização do DnD Scribe — Roadmap mestre

Status: **Fase 11 em execução — bloco automatizado verde; homologação autenticada pendente**  
Data de referência: **2026-09-04**  
Escopo: **modernização tecnológica e de UX sem novas features de domínio**

## Objetivo

Modernizar o app público do DnD Scribe preservando o que já funciona, sem iniciar ainda a expansão para personagens, NPCs, lore editável, galerias, timeline, relações ou grafo.

> Regra principal: primeiro modernizar a casa; depois ampliar a casa.

## Estado atual

A modernização já ultrapassou o bootstrap descrito nas primeiras versões deste roadmap.

O estado operacional atual é:

```txt
Fases 0–2  → fundação, arquitetura e contratos concluídos
Fases 3–8  → app Next funcional implementado
Fase 9     → implementação de qualidade/segurança/a11y concluída
Fase 10    → bloco técnico de performance concluído; benchmark autenticado pendente
Fase 11    → em execução; matriz automatizada multi-browser verde
Fases 12–15→ aguardam o fechamento real da paridade/homologação
```

A branch ativa da Fase 11 é:

```txt
modernizacao/fase-11-paridade-base
PR #36 — test: iniciar matriz de paridade multi-browser
```

A produção continua deliberadamente no app legado:

```txt
https://dnd.faysk.dev
```

Nenhum cutover foi realizado.

## Infra isolada do Next

O segundo projeto Vercel foi criado e um Preview técnico real chegou a `READY`:

```txt
Project: dnd-scribe-web-next
Project ID: prj_RVVEAucDhhftHY3UlE8PtoNxn6yl
Deployment: dpl_Ha9etK6sk3e96qmqVxJTCmz6fLoQ
Source commit: bf7ce242d083825cc65ee03354b3c638c95e87f0
State: READY
```

Esse Preview confirmou build e isolamento de infraestrutura, mas **não é o release candidate final** porque a branch avançou depois do SHA publicado.

O próximo deployment deve ser criado somente como candidato formal pinado no SHA verde mais recente.

### Limitação temporária da Vercel

A API de deploy do plano Hobby atingiu o limite diário durante a validação:

```txt
resource: api-deployments-free-per-day
remaining: 0
reset: 2026-09-05T21:12:30.716Z
```

Enquanto esse limite existir, a execução continua em CI, testes, documentação, contratos, segurança, acessibilidade e preparação da homologação. A produção não é afetada.

## Resultado automatizado mais recente

A matriz da Fase 11 roda em:

```txt
Desktop Chromium
Desktop Firefox
Desktop WebKit
Mobile Chromium — Pixel 5
Mobile WebKit — iPhone 13
```

Último gate que fechou o bloco automatizado:

```txt
Web Next CI #69
run 33923147976

TypeScript              ✅
ESLint                  ✅
Vitest                  ✅ — 12 arquivos / 25 testes
Next production build   ✅
Client bundle audit     ✅ — 18 arquivos / 0 marcadores server-only
Bundle inventory        ✅
Playwright              ✅ — 71 passed / 4 skipped / 0 failed
```

Os quatro skips são intencionais e restritos a checks de foco/Tab em WebKit que dependem da preferência Full Keyboard Access do Safari/OS. A semântica e ativação do skip link continuam verificadas em todas as engines.

O legado permaneceu verde no mesmo ciclo:

```txt
CI #388
Companion regression tests ✅
App checks                ✅
Python syntax             ✅
```

## O que ainda impede fechar a Fase 11

A automação sem credenciais não substitui homologação real. Permanecem pendentes:

```txt
Google OAuth real
Discord OAuth real
membership aprovada e pendente
refresh de sessão
perfil/avatar/capabilities reais
Home com acervo real
/sessoes com catálogo real
resumo real
transcrição longa real
busca e speaker filter reais
cursor/infinite load reais
download real
visual dark/light autenticado
zoom 200% autenticado
cookies HTTPS
benchmark legado x Next
```

Esses itens serão executados no próximo release candidate autenticável, usando o corpus fixo de `39-fase-11-corpus-homologacao.md`.

---

## Escopo congelado

### Entra neste roadmap

- frontend público moderno;
- Next.js + React + TypeScript strict;
- App Router e Server Components por padrão;
- design system próprio;
- dark e light como temas de primeira classe;
- Supabase Auth com SSR/cookies;
- Home reorganizada usando apenas dados existentes;
- `/sessoes` como arquivo completo;
- resumo como página padrão da sessão;
- transcrição como recurso secundário;
- busca, speaker filter, paginação e download preservados;
- testes automatizados e CI;
- segurança, acessibilidade e performance;
- Preview, homologação, cutover e estabilização.

### Não entra neste roadmap

- personagens e NPCs;
- páginas/editor de lore;
- galerias de referências;
- itens, armas, instrumentos e companheiros;
- jornada/timeline de personagem;
- timeline global;
- relações e grafo;
- busca global de entidades;
- novo modelo de canon;
- modernização da Central Local/pipeline/Whisper;
- migração completa do backend legado.

Esses temas pertencem a outro roadmap, criado somente depois da modernização ser formalmente encerrada.

---

## Princípios

1. **Paridade antes de expansão** — feature nova não entra durante a migração.
2. **Preservar a identidade** — o visual editorial atual é a base oficial.
3. **Dark e light são primeira classe** — nenhum é fallback.
4. **Local-first permanece** — áudio/processamento pesado continuam locais.
5. **Supabase permanece** — banco/auth não são trocados sem motivo.
6. **Server-first** — leitura editorial envia pouco JS ao browser.
7. **TypeScript strict** — contratos claros desde o início.
8. **Acessibilidade não é acabamento**.
9. **Preview antes de produção**.
10. **Sem “já que estamos aqui”** — expansão vai para backlog futuro.

---

## Stack operacional atual

| Camada | Versão/direção atual |
| --- | --- |
| Runtime | Node.js 24 LTS |
| Framework | Next.js 16.3.3 App Router |
| UI | React 19.2.7 |
| Linguagem | TypeScript 6.0.3 strict — bridge do ADR 013 |
| CSS | Tailwind CSS 4.3.0 + tokens próprios |
| Unit tests | Vitest 5.0.0 |
| E2E | Playwright 1.62.1 |
| Package manager | pnpm 11.25.0 |
| Banco | PostgreSQL / Supabase preservado |
| Auth | Supabase Auth + SSR/cookies |
| Dados durante migração | BFF Next → origem legada → API → Supabase |
| Deploy | segundo projeto Vercel isolado durante Preview/Homologação |
| Processamento pesado | local companion atual |

A política continua sendo usar versões estáveis/LTS recentes. Exceções de compatibilidade precisam de ADR e não podem ser resolvidas desativando checks.

---

## Topologia de coexistência

Durante desenvolvimento/homologação:

```txt
Browser
→ novo app Next
→ BFF server-side
→ DND_LEGACY_ORIGIN
→ projeto Vercel legado
→ API/Supabase
```

`dnd.faysk.dev` continua no projeto legado até a Fase 13.

ADR 012 define uma origem técnica estável para o legado, evitando que o novo app use o próprio domínio de produção como upstream depois do cutover.

### Após o cutover

```txt
dnd.faysk.dev
→ novo projeto Next
│
├── páginas modernas
├── BFF moderno
└── gateway de contratos ainda legados
    → origem técnica legada
    → projeto legado
```

API antiga, Central Local/Edit, jobs, integrações e crons podem permanecer no projeto legado enquanto necessário.

---

## Rotas alvo

```txt
/                         → Home da campanha
/sessoes                  → arquivo completo
/sessoes/[id]             → resumo
/sessoes/[id]/transcricao → transcrição
```

Links históricos permanecem compatíveis:

```txt
#/sessao/:id        → /sessoes/:id/transcricao
#/sessao/:id/resumo → /sessoes/:id
```

A bridge já possui cobertura unitária e E2E no browser.

---

## Fases

| Fase | Nome | Estado atual | Evidência principal |
| --- | --- | --- | --- |
| 0 | Baseline e congelamento | **concluída** | docs 01, 10, 11, 16 e 30 |
| 1 | Arquitetura alvo | **concluída** | doc 02 + ADRs |
| 2 | ADRs e contratos | **concluída** | ADRs 001+ |
| 3 | Bootstrap | **implementada e validada** | app Next + CI + Vercel isolada |
| 4 | Design system | **implementada** | tokens/componentes/temas |
| 5 | Auth e shell | **implementada; homologação real pendente** | SSR auth/shell |
| 6 | Home e arquivo | **implementada; paridade real pendente** | `/` + `/sessoes` |
| 7 | Página de sessão | **implementada; paridade real pendente** | `/sessoes/[id]` |
| 8 | Transcrição | **implementada; paridade real pendente** | rota/BFF/reader |
| 9 | Qualidade, segurança e a11y | **bloco técnico concluído** | doc de execução Fase 9 |
| 10 | Performance | **bloco técnico concluído; benchmark pendente** | doc 38 |
| 11 | Paridade total | **em execução** | docs 25, 37 e 39 |
| 12 | Homologação | **aguardando Fase 11** | doc 26 |
| 13 | Cutover | **não iniciado** | docs 08 e 27 |
| 14 | Estabilização | **não iniciada** | docs 08 e 28 |
| 15 | Encerramento | **não iniciado** | docs 09 e 29 |

A implementação técnica de fases anteriores não autoriza pular os gates de paridade/homologação.

---

## Corpus fixo da paridade

O snapshot real da campanha publicado em 2026-09-04 possui 11 sessões. A Fase 11 fixou casos representativos para evitar homologação por amostragem conveniente.

Casos obrigatórios incluem:

```txt
rmDsxh640RR4                           → sessão mais recente / recap muito longo
Svz6mvN0cBUk                           → maior transcrição / busca e filtro
craig-AdabEqbzngmT-stage1-full         → transcrição mínima/histórica
craig-BIRq3nIWB4v9                     → duração ausente
manual-2026-07-05-20260705-sessao-000806 → source_session_id longo
```

Detalhes e queries fixas estão em [39 — Corpus real de homologação](39-fase-11-corpus-homologacao.md).

---

## Definition of Done da modernização

O roadmap de features só pode começar quando:

- [ ] nova stack em produção;
- [ ] app público não depende do frontend legado para uso normal;
- [ ] login e permissões estabilizados;
- [ ] Home moderna publicada;
- [ ] `/sessoes` publicado;
- [ ] resumo é entrada padrão da sessão;
- [ ] transcrição preserva busca, filtro, paginação e download;
- [ ] dark e light homologados;
- [ ] desktop e mobile homologados;
- [x] TypeScript strict sem erros no bloco automatizado atual;
- [x] lint/typecheck/unit/build verdes no bloco automatizado atual;
- [x] E2E determinístico multi-browser verde no bloco automatizado atual;
- [ ] testes visuais autenticados aceitos;
- [ ] performance medida e sem regressão crítica não justificada;
- [ ] segurança/RLS revisadas no release candidate final;
- [ ] acessibilidade manual/autenticada validada;
- [ ] CI e Preview finais estáveis;
- [ ] legacy origin/gateway estabilizados;
- [x] bridge de contratos históricos críticos coberta por testes;
- [ ] rollback testado/documentado;
- [ ] estabilização encerrada;
- [ ] documentação final atualizada;
- [ ] relatório final publicado;
- [ ] README marcado como **MODERNIZAÇÃO: COMPLETA**.

---

## Documentação principal

### Fundação

- [00 — Escopo e princípios](00-escopo-e-principios.md)
- [01 — Baseline atual](01-baseline-atual.md)
- [02 — Arquitetura alvo](02-arquitetura-alvo.md)
- [03 — Roadmap por fases](03-roadmap-fases.md)
- [04 — Design system e UX](04-design-system-e-ux.md)
- [05 — Plano de migração](05-plano-de-migracao.md)
- [06 — Matriz de paridade](06-matriz-de-paridade.md)
- [07 — Qualidade, segurança e acessibilidade](07-qualidade-seguranca-a11y.md)
- [08 — Cutover e estabilização](08-cutover-estabilizacao.md)
- [09 — Template do relatório final](09-relatorio-final-template.md)

### Baseline e arquitetura

- [10 — Contratos do app público legado](10-contratos-legado-app-publico.md)
- [11 — Fase 0: evidências e checklist](11-fase-0-evidencias-e-checklist.md)
- [12 — Inventário de deploy e dependências do legado](12-inventario-deploy-e-dependencias-legado.md)
- [13 — Inventário Supabase e fronteira de dados](13-inventario-supabase-e-fronteira-de-dados.md)
- [14 — Topologia Preview e coexistência Vercel](14-topologia-preview-e-coexistencia-vercel.md)
- [15 — Gates das Fases 1 e 2](15-fases-1-2-gates.md)
- [16 — Fase 0: runbook de captura](16-fase-0-runbook-de-captura.md)
- [30 — Encerramento da Fase 0](30-fase-0-encerramento.md)

### Execução atual

- [25 — Plano da Fase 11](25-fase-11-paridade-total-plano-de-execucao.md)
- [26 — Plano da Fase 12](26-fase-12-homologacao-plano-de-execucao.md)
- [37 — Execução da Fase 11](37-fase-11-paridade-execucao.md)
- [38 — Execução da Fase 10 / Performance](38-fase-10-performance-execucao.md)
- [39 — Corpus real de homologação](39-fase-11-corpus-homologacao.md)
- [Matriz de paridade](06-matriz-de-paridade.md)

### ADRs

As decisões arquiteturais aceitas permanecem em [`adr/`](adr/README.md). Mudanças incompatíveis ou exceções relevantes exigem ADR em vez de alteração silenciosa.

---

## Próximo gate

O próximo passo técnico que depende da Vercel é criar um release candidate do SHA verde mais recente após o reset da quota. Até lá, todo trabalho que não depende de novo deployment deve continuar sendo fechado na branch da Fase 11.

A modernização **não está concluída** até o release candidate passar por paridade real, homologação, cutover, estabilização e relatório final.
