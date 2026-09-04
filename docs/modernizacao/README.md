# Modernização do DnD Scribe — Roadmap mestre

Status: **Fase 0 em execução; Fases 1 e 2 concluídas; Fase 3 bloqueada pelo baseline**  
Escopo: **modernização tecnológica e de UX sem novas features de domínio**

## Objetivo

Modernizar o app público do DnD Scribe preservando o que já funciona hoje, sem iniciar ainda a expansão para personagens, NPCs, lore editável, galerias, timeline, relações ou grafo.

A modernização deve deixar a aplicação pronta para crescer depois, mas sem misturar a migração de tecnologia com o roadmap de novas funcionalidades.

> Regra principal: primeiro modernizar a casa; depois ampliar a casa.

## Estado atual

A auditoria do legado da Fase 0 já documenta:

- shell e rotas atuais;
- auth e estados de acesso;
- APIs consumidas pelo player;
- resumo e Markdown;
- transcrição, busca, speaker filter e paginação;
- temas dark/light/system;
- build estático atual;
- dependências;
- limites do deploy compartilhado com API/Central Local;
- schema Supabase relevante;
- topologia Vercel atual.

A Fase 0 ainda **não está encerrada** porque o golden baseline visual e o baseline técnico de performance precisam ser congelados de forma reproduzível, conforme issue **#21**.

As Fases 1 e 2 já foram encerradas documentalmente. Arquitetura, fronteira de dados e coexistência não são mais bloqueadores.

O bloqueio atual da Fase 3 é exclusivamente a Fase 0.

### Planejamento antecipado

As Fases **3 a 15** já possuem planos de execução detalhados.

Isso é preparação documental, não execução antecipada:

> nenhuma fase começa antes do gate da fase anterior.

O objetivo é chegar ao código sem improvisar arquitetura, auth, paridade, cutover ou rollback no meio da implementação.

---

## Escopo congelado

### Entra neste roadmap

- frontend público moderno;
- Next.js + React + TypeScript;
- App Router;
- Server Components por padrão;
- design system formalizado;
- dark e light preservados/refinados;
- Supabase Auth com SSR/cookies;
- Home reorganizada usando apenas dados existentes;
- `/sessoes` como arquivo completo;
- resumo como página padrão da sessão;
- transcrição como recurso secundário;
- busca, speaker filter, paginação e download preservados;
- testes automatizados;
- CI;
- segurança;
- acessibilidade;
- performance;
- Preview;
- homologação;
- cutover;
- estabilização.

### Não entra neste roadmap

- personagens;
- NPCs;
- páginas/editor de lore;
- galerias de referências;
- itens, armas, instrumentos e companheiros;
- jornada/timeline de personagem;
- timeline global;
- relações;
- grafo;
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

## Stack alvo

A política é usar a **versão estável/LTS mais recente suportada no momento de cada fase**, sem canary, beta ou RC em produção.

| Camada | Direção |
| --- | --- |
| Runtime | Node.js LTS |
| Framework | Next.js App Router |
| UI | React |
| Linguagem | TypeScript strict |
| CSS | Tailwind CSS + design tokens próprios |
| Banco | PostgreSQL / Supabase |
| Auth | Supabase Auth + SSR/cookies |
| Dados durante migração | BFF Next → origem legada → API → Supabase |
| Validação | Zod |
| Unit tests | Vitest |
| E2E/visual | Playwright |
| Package manager | pnpm no novo app |
| Deploy | Vercel; projeto separado para `apps/web` durante Preview/Homologação |
| Processamento pesado | local companion atual |

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

O novo app roda em um segundo projeto Vercel com Root Directory `apps/web`.

`dnd.faysk.dev` continua no projeto legado até a Fase 13.

### Origem técnica legada

ADR 012 define uma origem estável, recomendada como:

```txt
legacy.dnd.faysk.dev
```

Ela continua apontando ao projeto antigo mesmo depois do cutover.

O BFF moderno **não usa** `dnd.faysk.dev` como upstream interno.

Isso evita self-loop quando o domínio principal for movido.

---

## Topologia após cutover

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

O projeto legado continua hospedando enquanto necessário:

- API antiga;
- Central Local/Edit;
- jobs;
- integrações;
- crons;
- outras superfícies operacionais fora do escopo do frontend.

A modernização do app público não depende de eliminar esse backend legado.

---

## Rotas alvo

```txt
/
/sessoes
/sessoes/[id]
/sessoes/[id]/transcricao
```

Semântica:

```txt
/                         → Home da campanha
/sessoes                  → arquivo completo
/sessoes/[id]             → resumo
/sessoes/[id]/transcricao → transcrição
```

---

## Compatibilidade histórica

ADR 011 preserva links antigos:

```txt
#/sessao/:id
→ /sessoes/:id/transcricao

#/sessao/:id/resumo
→ /sessoes/:id
```

Como fragmentos `#` não chegam ao servidor, a compatibilidade usa bridge client-side mínima e isolada.

---

## Fases

| Fase | Nome | Estado atual | Plano |
| --- | --- | --- | --- |
| 0 | Baseline e congelamento | **em execução — issue #21** | docs 01, 10, 11, 16 + baseline |
| 1 | Arquitetura alvo | **concluída** | doc 02 + ADRs |
| 2 | ADRs e contratos | **concluída** | ADRs 001+ |
| 3 | Bootstrap | **bloqueada; plano pronto** | doc 17 |
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

A preparação documental antecipada não muda o estado das fases.

---

## Visão resumida da execução

```txt
FASE 0
congelar legado
        ↓
FASES 1–2
arquitetura/decisões
        ↓
FASE 3
criar apps/web + CI + Preview
        ↓
FASE 4
Design System
        ↓
FASE 5
Auth + Shell
        ↓
FASE 6
Home + /sessoes
        ↓
FASE 7
Resumo first
        ↓
FASE 8
Transcrição completa
        ↓
FASE 9
Segurança + a11y + qualidade
        ↓
FASE 10
Performance comparativa
        ↓
FASE 11
Paridade 100%
        ↓
FASE 12
Homologação humana
        ↓
FASE 13
Cutover reversível
        ↓
FASE 14
Estabilização
        ↓
FASE 15
Relatório final
        ↓
MODERNIZAÇÃO: COMPLETA
```

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
- [ ] dark homologado;
- [ ] light homologado;
- [ ] desktop homologado;
- [ ] mobile homologado;
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

API/Central Local/jobs/crons legados podem permanecer atrás da origem técnica/gateway, porque sua modernização nunca fez parte deste roadmap.

Somente depois deste documento receber:

```txt
MODERNIZAÇÃO: COMPLETA
```

pode ser criado o roadmap das features de Pessoas, Lore, Coleções, Jornada, Mundo e Relações.
