# Modernização do DnD Scribe — Roadmap mestre

Status: **planejamento aprovado**  
Escopo: **modernização tecnológica e de UX sem novas features de domínio**

## Objetivo

Modernizar o app público do DnD Scribe preservando o que já funciona hoje, sem iniciar ainda a expansão para personagens, NPCs, lore editável, galerias, timeline, relações ou grafo.

A modernização deve deixar a aplicação pronta para crescer depois, mas sem misturar a migração de tecnologia com o roadmap de novas funcionalidades.

> Regra principal: primeiro modernizar a casa; depois ampliar a casa.

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
| Validação | Zod |
| Testes unitários | Vitest |
| Testes E2E/visuais | Playwright |
| Package manager | pnpm |
| Deploy | Vercel |
| Processamento pesado | local companion atual |

## Fases

| Fase | Nome | Saída principal |
| --- | --- | --- |
| 0 | Baseline e congelamento | estado atual documentado e screenshots de referência |
| 1 | Arquitetura alvo | stack, limites e organização definidos |
| 2 | ADRs e contratos | decisões técnicas formalizadas |
| 3 | Bootstrap | novo app Next rodando em paralelo |
| 4 | Design system | identidade atual transformada em sistema |
| 5 | Auth e shell | login, tema, header, sessão e permissões migrados |
| 6 | Home e arquivo | Home moderna + `/sessoes` |
| 7 | Página de sessão | resumo como default |
| 8 | Transcrição | paridade funcional da transcrição |
| 9 | Qualidade e segurança | strict, a11y, validação e revisão de acesso |
| 10 | Performance | métricas e otimizações medidas |
| 11 | Paridade | matriz antiga x nova em 100% |
| 12 | Homologação | mesa valida preview |
| 13 | Cutover | nova aplicação em produção com rollback |
| 14 | Estabilização | regressões corrigidas e métricas observadas |
| 15 | Encerramento | relatório final e liberação do próximo roadmap |

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
- [ADRs](adr/README.md)

## Estado do produto ao final deste roadmap

A aplicação continuará oferecendo essencialmente as mesmas capacidades de consulta atuais, porém com uma base moderna, modular, testada e preparada para o próximo ciclo.

A expansão de domínio começa somente depois deste documento ser marcado como **modernização concluída**.
