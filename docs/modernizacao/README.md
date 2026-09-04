# Modernização do DnD Scribe — Roadmap mestre

Status: **Fase 0 em execução; Fases 1 e 2 concluídas; Fase 3 bloqueada pelo baseline**  
Escopo: **modernização tecnológica e de UX sem novas features de domínio**

## Objetivo

Modernizar o app público do DnD Scribe preservando o que já funciona hoje, sem iniciar ainda a expansão para personagens, NPCs, lore editável, galerias, timeline, relações ou grafo.

A modernização deve deixar a aplicação pronta para crescer depois, mas sem misturar a migração de tecnologia com o roadmap de novas funcionalidades.

> Regra principal: primeiro modernizar a casa; depois ampliar a casa.

## Estado atual

A auditoria de código do legado da Fase 0 está concluída em nível suficiente para documentar:

- shell e rotas atuais;
- auth e estados de acesso;
- APIs consumidas pelo player;
- resumo e Markdown;
- transcrição, busca, speaker filter e paginação;
- temas dark/light/system;
- build estático atual;
- dependências;
- limites do deploy compartilhado com API/Central Local;
- schema real do Supabase relevante à modernização;
- topologia atual da Vercel.

A Fase 0 ainda **não está encerrada** porque o baseline visual oficial e o baseline técnico de performance precisam ser congelados de forma reproduzível, principalmente em mobile e nos estados de login, acesso pendente, resumo e erro.

Em paralelo, as Fases 1 e 2 foram encerradas documentalmente. Arquitetura, fronteira de dados e coexistência não são mais bloqueadores do bootstrap.

O bloqueio atual da Fase 3 é exclusivamente o gate restante da Fase 0, controlado pelo issue **#21 — golden baseline visual + performance**.

Já existe agora um manifesto das capturas desktop fornecidas durante o planejamento, com dimensões e SHA-256, além de um protocolo reproduzível para medição de performance. Isso reduz o trabalho restante a persistir as evidências e executar as medições em um navegador autenticado real.

Documentos de controle dessa etapa:

- [01 — Baseline atual](01-baseline-atual.md)
- [10 — Contratos do app público legado](10-contratos-legado-app-publico.md)
- [11 — Fase 0: evidências e checklist](11-fase-0-evidencias-e-checklist.md)
- [12 — Inventário de deploy e dependências do legado](12-inventario-deploy-e-dependencias-legado.md)
- [13 — Inventário Supabase e fronteira de dados](13-inventario-supabase-e-fronteira-de-dados.md)
- [14 — Topologia Preview e coexistência Vercel](14-topologia-preview-e-coexistencia-vercel.md)
- [15 — Gates das Fases 1 e 2](15-fases-1-2-gates.md)
- [16 — Fase 0: runbook de captura](16-fase-0-runbook-de-captura.md)
- [Baseline visual](baseline/visual/README.md)
- [Baseline de performance](baseline/performance/README.md)

## Escopo congelado

### Entra neste roadmap

- frontend público moderno;
- Next.js + React + TypeScript;
- App Router;
- Server Components por padrão;
- design system formalizado;
- dark e light mode preservados e refinados;
- autenticação moderna com Supabase;
- Home reorganizada como entrada da campanha, ainda usando apenas dados existentes;
- arquivo de sessões separado da Home;
- resumo como página principal da sessão;
- transcrição como recurso secundário da sessão;
- preservação da busca, filtro, paginação e download da transcrição;
- testes automatizados;
- CI;
- segurança, acessibilidade e performance;
- preview, homologação, cutover e estabilização.

### Não entra neste roadmap

- personagens;
- NPCs;
- páginas de lore;
- editor de lore;
- upload/galeria de referências por personagem;
- itens, armas, instrumentos e companheiros;
- timeline de personagem;
- timeline global;
- relações entre entidades;
- grafo de conexões;
- busca global entre entidades;
- novas regras de domínio para canon além das já existentes.

Essas features serão planejadas em um roadmap novo somente quando a modernização estiver concluída.

## Princípios

1. **Paridade antes de expansão** — nada de feature nova enquanto o legado ainda for necessário para uso normal.
2. **Preservar a identidade** — o visual atual continua sendo a base estética oficial.
3. **Dark e light são produtos de primeira classe** — nenhum tema é tratado como fallback.
4. **Local-first permanece** — áudio e processamento pesado continuam locais.
5. **Supabase permanece** — banco, auth e dados existentes são evoluídos, não substituídos sem motivo.
6. **Server-first** — conteúdo editorial e leitura devem enviar o mínimo possível de JavaScript ao browser.
7. **TypeScript strict** — contratos claros desde o início.
8. **Acessibilidade não é acabamento** — entra desde a fundação.
9. **Preview antes de produção** — modernização roda em paralelo ao legado até a homologação.
10. **Sem “já que estamos aqui”** — qualquer feature fora do escopo vai para backlog do próximo roadmap.

## Stack alvo

A política é usar a **versão estável/LTS mais recente suportada no momento de cada fase**, sem canary, beta ou RC em produção.

| Camada | Direção |
| --- | --- |
| Runtime | Node.js LTS |
| Framework | Next.js App Router |
| UI | React |
| Linguagem | TypeScript strict |
| CSS | Tailwind CSS + design tokens do DnD Scribe |
| Banco | PostgreSQL / Supabase |
| Auth | Supabase Auth + SSR/cookies |
| Dados durante migração | BFF Next → API legada → Supabase |
| Validação | Zod |
| Testes unitários | Vitest |
| Testes E2E/visuais | Playwright |
| Package manager | pnpm |
| Deploy | Vercel; projeto separado para `apps/web` durante Preview/Homologação |
| Processamento pesado | local companion atual |

## Fases

| Fase | Nome | Estado atual | Saída principal |
| --- | --- | --- | --- |
| 0 | Baseline e congelamento | **em execução — último gate: issue #21** | estado atual documentado e screenshots/performance de referência |
| 1 | Arquitetura alvo | **concluída** | stack, limites, dados e organização definidos |
| 2 | ADRs e contratos | **concluída** | decisões técnicas formalizadas |
| 3 | Bootstrap | **bloqueada pela Fase 0** | novo app Next rodando em paralelo |
| 4 | Design system | não iniciada | identidade atual transformada em sistema |
| 5 | Auth e shell | não iniciada | login, tema, header, sessão e permissões migrados |
| 6 | Home e arquivo | não iniciada | Home moderna + `/sessoes` |
| 7 | Página de sessão | não iniciada | resumo como default |
| 8 | Transcrição | não iniciada | paridade funcional da transcrição |
| 9 | Qualidade e segurança | não iniciada | strict, a11y, validação e revisão de acesso |
| 10 | Performance | não iniciada | métricas e otimizações medidas |
| 11 | Paridade | não iniciada | matriz antiga x nova em 100% |
| 12 | Homologação | não iniciada | mesa valida Preview |
| 13 | Cutover | não iniciada | nova aplicação em produção com rollback |
| 14 | Estabilização | não iniciada | regressões corrigidas e métricas observadas |
| 15 | Encerramento | não iniciada | relatório final e liberação do próximo roadmap |

A conclusão das Fases 1 e 2 em paralelo é permitida pela regra do roadmap porque não altera produção e não compromete o gate da Fase 0. Ela **não autoriza** iniciar Fase 3 antes do baseline mínimo restante.

## Fronteira arquitetural já aprovada

Durante coexistência:

```txt
Browser
→ novo app Next
→ BFF/adapter server-side
→ API legada em produção
→ Supabase/PostgreSQL
```

O novo app roda em projeto Vercel separado com Root Directory `apps/web`. `dnd.faysk.dev` permanece no projeto atual até a Fase 13.

## ADRs aceitos

A lista completa vive em [adr/README.md](adr/README.md).

Até aqui estão aceitos ADRs para:

- App Router;
- TypeScript strict;
- Supabase;
- local-first;
- design system próprio;
- Server Components;
- feature freeze;
- API legada como fronteira de dados;
- projeto Vercel separado;
- BFF Next para API legada.

## Gate entre fases

Nenhuma fase é considerada concluída apenas porque “funcionou localmente”. Cada fase deve registrar:

- objetivo;
- decisão;
- arquivos alterados;
- validação;
- testes;
- riscos restantes;
- rollback ou plano de recuperação quando aplicável;
- próximo passo.

## Definition of Done da modernização

O roadmap de features só pode começar quando todos os itens abaixo estiverem concluídos:

- [ ] nova stack em produção;
- [ ] app público não depende mais do frontend legado para uso normal;
- [ ] login e permissões estabilizados;
- [ ] Home moderna publicada;
- [ ] `/sessoes` publicado;
- [ ] resumo é a entrada padrão da sessão;
- [ ] transcrição preserva busca, filtro, paginação e download;
- [ ] dark mode homologado;
- [ ] light mode homologado;
- [ ] desktop homologado;
- [ ] mobile homologado;
- [ ] TypeScript strict sem erros;
- [ ] lint/typecheck/test/build verdes;
- [ ] suíte E2E crítica verde;
- [ ] testes visuais de referência aceitos;
- [ ] performance medida e sem regressão crítica;
- [ ] segurança e RLS revisadas;
- [ ] acessibilidade básica validada;
- [ ] CI e Preview Deploy estáveis;
- [ ] rollback testado/documentado;
- [ ] período de estabilização encerrado;
- [ ] documentação atualizada;
- [ ] relatório final publicado.

## Documentos deste diretório

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
- [10 — Contratos do app público legado](10-contratos-legado-app-publico.md)
- [11 — Fase 0: evidências e checklist](11-fase-0-evidencias-e-checklist.md)
- [12 — Inventário de deploy e dependências do legado](12-inventario-deploy-e-dependencias-legado.md)
- [13 — Inventário Supabase e fronteira de dados](13-inventario-supabase-e-fronteira-de-dados.md)
- [14 — Topologia Preview e coexistência Vercel](14-topologia-preview-e-coexistencia-vercel.md)
- [15 — Gates das Fases 1 e 2](15-fases-1-2-gates.md)
- [16 — Fase 0: runbook de captura](16-fase-0-runbook-de-captura.md)
- [Baseline visual](baseline/visual/README.md)
- [Baseline de performance](baseline/performance/README.md)
- [ADRs](adr/README.md)

## Estado do produto ao final deste roadmap

A aplicação continuará oferecendo essencialmente as mesmas capacidades de consulta atuais, porém com uma base moderna, modular, testada e preparada para o próximo ciclo.

A expansão de domínio começa somente depois deste documento ser marcado como **modernização concluída**.
