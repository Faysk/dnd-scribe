# Modernização do DnD Scribe — Roadmap mestre

Status: **Fases 0, 1 e 2 concluídas; Fase 3 em execução**  
Escopo: **modernização tecnológica e de UX sem novas features de domínio**

## Objetivo

Modernizar o app público do DnD Scribe preservando o que já funciona hoje, sem iniciar ainda a expansão para personagens, NPCs, lore editável, galerias, timeline, relações ou grafo.

> Regra principal: primeiro modernizar a casa; depois ampliar a casa.

## Estado atual

A Fase 0 foi encerrada em 2026-09-04 após autorização explícita do owner para avançar ao bootstrap. O fechamento está registrado em [30 — Encerramento da Fase 0](30-fase-0-encerramento.md).

O baseline estrutural do legado está congelado: shell, rotas, auth, APIs do player, resumo, transcrição, temas, build, deploy, Supabase, local-first, feature freeze e topologia de coexistência.

As evidências visuais ainda não coletadas não foram descartadas: login/pending/menu entram na Fase 5 e a paridade visual completa desktop/mobile dark/light continua obrigatória na Fase 11. O baseline quantitativo de performance continua obrigatório na Fase 10 antes do cutover.

A Fase 3 está sendo executada na branch `modernizacao/fase-3-bootstrap` e no PR #25. O novo `apps/web` já existe como shell técnico em Next e possui CI próprio. A produção legada continua intacta.

### Resultado técnico parcial da Fase 3

O bootstrap já provou em CI:

```txt
pnpm install       ✅
TypeScript strict  ✅
ESLint             ✅
Vitest             ✅
Next build         ✅
Playwright smoke   ✅
CI legado          ✅
```

A primeira tentativa usou TypeScript 7.0.2. O `tsc` passou, mas `typescript-eslint@8.69.0`, usado pela integração estável do Next 16.3.3, ainda não suporta a API do TS7. O ADR 013 formaliza TypeScript 6.0.3 como bridge temporária, mantendo `strict`, lint e build reais.

Pendências para encerrar a Fase 3:

- persistir o `pnpm-lock.yaml` reproduzível e trocar o CI para frozen lockfile;
- publicar/validar o Next em **projeto Vercel separado** com Root Directory `apps/web`;
- registrar o deployment Preview técnico;
- manter planejada/saudável a origem técnica legada do ADR 012 antes do primeiro BFF real.

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

Esses temas pertencem a um roadmap novo somente depois da modernização ser formalmente encerrada.

---

## Princípios

1. **Paridade antes de expansão** — feature nova não entra durante a migração.
2. **Preservar a identidade** — o visual atual é a base oficial.
3. **Dark e light são primeira classe** — nenhum é fallback.
4. **Local-first permanece** — áudio/processamento pesado continuam locais.
5. **Supabase permanece** — banco/auth não são trocados sem motivo.
6. **Server-first** — leitura editorial envia pouco JS ao browser.
7. **TypeScript strict** — contratos claros desde o início.
8. **Acessibilidade não é acabamento**.
9. **Preview antes de produção**.
10. **Sem “já que estamos aqui”** — expansão vai para backlog futuro.

---

## Stack operacional da Fase 3

| Camada | Versão/direção atual |
| --- | --- |
| Runtime | Node.js 24 LTS |
| Framework | Next.js 16.3.3 App Router |
| UI | React 19.2.7 |
| Linguagem | TypeScript 6.0.3 strict — bridge do ADR 013 |
| CSS | Tailwind CSS 4.3.0 + tokens próprios |
| Unit tests | Vitest 5.0.0 |
| E2E | Playwright 1.62.1 |
| Package manager | pnpm 11.25.0 no novo workspace |
| Banco | PostgreSQL / Supabase preservado |
| Auth futuro | Supabase Auth + SSR/cookies |
| Dados durante migração | BFF Next → origem legada → API → Supabase |
| Deploy | segundo projeto Vercel para `apps/web` durante Preview/Homologação |
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

ADR 012 define uma origem técnica estável recomendada como:

```txt
legacy.dnd.faysk.dev
```

O BFF moderno não deve usar `dnd.faysk.dev` como upstream interno, evitando self-loop depois do cutover.

### Após o cutover

```txt
dnd.faysk.dev
→ novo projeto Next
│
├── páginas modernas
├── /api/web/* BFF moderno
└── gateway de contratos ainda legados
    → legacy.dnd.faysk.dev
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

ADR 011 preserva links históricos:

```txt
#/sessao/:id        → /sessoes/:id/transcricao
#/sessao/:id/resumo → /sessoes/:id
```

---

## Fases

| Fase | Nome | Estado atual | Plano |
| --- | --- | --- | --- |
| 0 | Baseline e congelamento | **concluída** | docs 01, 10, 11, 16 e 30 |
| 1 | Arquitetura alvo | **concluída** | doc 02 + ADRs |
| 2 | ADRs e contratos | **concluída** | ADRs 001+ |
| 3 | Bootstrap | **em execução** | doc 17 + PR #25 |
| 4 | Design system | **não iniciada; plano pronto** | doc 18 |
| 5 | Auth e shell | **não iniciada; plano pronto** | doc 19 |
| 6 | Home e arquivo | **não iniciada; plano pronto** | doc 20 |
| 7 | Página de sessão | **não iniciada; plano pronto** | doc 21 |
| 8 | Transcrição | **não iniciada; plano pronto** | doc 22 |
| 9 | Qualidade, segurança e a11y | **não iniciada; plano pronto** | doc 23 |
| 10 | Performance | **não iniciada; plano pronto** | doc 24 |
| 11 | Paridade total | **não iniciada; plano pronto** | doc 25 |
| 12 | Homologação | **não iniciada; plano pronto** | doc 26 |
| 13 | Cutover | **não iniciada; plano pronto** | doc 27 |
| 14 | Estabilização | **não iniciada; plano pronto** | doc 28 |
| 15 | Encerramento | **não iniciada; plano pronto** | doc 29 |

Nenhuma fase posterior começa antes do gate da anterior.

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
- [ ] TypeScript strict sem erros;
- [ ] lint/typecheck/test/build verdes;
- [ ] E2E crítico verde;
- [ ] testes visuais aceitos;
- [ ] performance medida e sem regressão crítica não justificada;
- [ ] segurança/RLS revisadas;
- [ ] acessibilidade validada;
- [ ] CI e Preview estáveis;
- [ ] legacy origin/gateway estabilizados;
- [ ] contratos históricos críticos preservados;
- [ ] rollback testado/documentado;
- [ ] estabilização encerrada;
- [ ] documentação atualizada;
- [ ] relatório final publicado;
- [ ] README marcado como **MODERNIZAÇÃO: COMPLETA**.

---

## Documentação

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

### Baseline/auditoria

- [10 — Contratos do app público legado](10-contratos-legado-app-publico.md)
- [11 — Fase 0: evidências e checklist](11-fase-0-evidencias-e-checklist.md)
- [12 — Inventário de deploy e dependências do legado](12-inventario-deploy-e-dependencias-legado.md)
- [13 — Inventário Supabase e fronteira de dados](13-inventario-supabase-e-fronteira-de-dados.md)
- [14 — Topologia Preview e coexistência Vercel](14-topologia-preview-e-coexistencia-vercel.md)
- [15 — Gates das Fases 1 e 2](15-fases-1-2-gates.md)
- [16 — Fase 0: runbook de captura](16-fase-0-runbook-de-captura.md)
- [30 — Encerramento da Fase 0](30-fase-0-encerramento.md)
- [Baseline visual](baseline/visual/README.md)
- [Baseline de performance](baseline/performance/README.md)

### Planos de execução

- [17 — Fase 3: Bootstrap](17-fase-3-bootstrap-plano-de-execucao.md)
- [18 — Fase 4: Design System](18-fase-4-design-system-plano-de-execucao.md)
- [19 — Fase 5: Auth e Shell](19-fase-5-auth-shell-plano-de-execucao.md)
- [20 — Fase 6: Home e Arquivo](20-fase-6-home-arquivo-plano-de-execucao.md)
- [21 — Fase 7: Página de Sessão](21-fase-7-pagina-sessao-plano-de-execucao.md)
- [22 — Fase 8: Transcrição](22-fase-8-transcricao-plano-de-execucao.md)
- [23 — Fase 9: Qualidade, Segurança e A11y](23-fase-9-qualidade-seguranca-a11y-plano-de-execucao.md)
- [24 — Fase 10: Performance](24-fase-10-performance-plano-de-execucao.md)
- [25 — Fase 11: Paridade Total](25-fase-11-paridade-total-plano-de-execucao.md)
- [26 — Fase 12: Homologação](26-fase-12-homologacao-plano-de-execucao.md)
- [27 — Fase 13: Cutover](27-fase-13-cutover-plano-de-execucao.md)
- [28 — Fase 14: Estabilização](28-fase-14-estabilizacao-plano-de-execucao.md)
- [29 — Fase 15: Encerramento](29-fase-15-encerramento-plano-de-execucao.md)

### Decisões

- [ADRs](adr/README.md)

---

## Estado do produto ao final

A aplicação continuará oferecendo essencialmente as mesmas capacidades públicas de consulta, porém com base moderna, modular, tipada, testada e preparada para crescer.

O frontend antigo não será mais necessário para o uso normal dos jogadores.

API/Central Local/jobs/crons legados podem permanecer atrás da origem técnica/gateway porque sua modernização não faz parte deste roadmap.

Somente depois deste documento receber:

```txt
MODERNIZAÇÃO: COMPLETA
```

pode ser criado o roadmap das features de Pessoas, Lore, Coleções, Jornada, Mundo e Relações.
