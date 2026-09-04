# 03 — Roadmap por fases

Status: **roadmap de execução**

## Regra geral

O roadmap é sequencial por risco, não por empolgação visual. Uma fase pode começar em paralelo com outra somente quando isso não comprometer seu gate de saída.

## Estado de execução em 2026-09-04

```txt
Fase 0 — em execução
Fase 1 — concluída
Fase 2 — concluída
Fase 3 — bloqueada pelo gate restante da Fase 0
```

As Fases 1 e 2 foram encerradas documentalmente em paralelo porque não alteram produção e não dependem dos screenshots finais para definir arquitetura. O bootstrap continua proibido até o baseline visual/performance mínimo da Fase 0 ser congelado.

O resultado detalhado dos gates está em `15-fases-1-2-gates.md`.

---

## Fase 0 — Baseline e congelamento

### Objetivo

Registrar o estado atual do produto e impedir expansão funcional durante a migração.

### Entregas

- mapa de telas atuais;
- rotas atuais;
- contratos usados pelo frontend;
- screenshots dark/light desktop/mobile;
- fluxos críticos;
- lista de capacidades atuais;
- feature freeze formal.

### Gate de saída

- baseline visual congelado;
- baseline funcional congelado;
- baseline técnico de performance reproduzível;
- escopo aprovado;
- backlog futuro separado.

### Estado atual

Concluído:

- auditoria de código;
- contratos funcionais;
- inventário de deploy;
- inventário Supabase;
- topologia Vercel;
- feature freeze.

Pendente:

- screenshots essenciais desktop/mobile;
- estados visuais de auth/erro;
- baseline técnico de performance.

---

## Fase 1 — Arquitetura alvo

### Objetivo

Definir a fundação da nova aplicação antes de criar UI real.

### Entregas

- stack alvo;
- política de versões;
- estrutura de diretórios;
- estratégia de rendering;
- estratégia de auth;
- estratégia de dados;
- estratégia de coexistência com legado.

### Gate de saída

Arquitetura aprovada e sem decisões críticas pendentes que bloqueiem bootstrap.

### Estado atual

**Concluída.**

Decisões adicionais fechadas durante a execução:

- API legada permanece como fronteira canônica de dados do player;
- BFF server-side no Next evita chamadas cross-origin do browser;
- projeto Vercel separado hospeda `apps/web` durante Preview/Homologação;
- produção atual permanece no projeto legado até cutover.

---

## Fase 2 — ADRs e contratos

### Objetivo

Registrar decisões arquiteturais que não devem depender de memória de conversa.

### Entregas mínimas

- App Router;
- TypeScript strict;
- permanência do Supabase;
- local-first preservado;
- design system próprio;
- Server Components por padrão;
- feature freeze.

### Entregas adicionais concluídas

- API legada como fronteira durante migração;
- topologia Vercel separada para o Next;
- BFF Next para consumo da API legada;
- contratos reais do app público legado congelados.

### Gate de saída

ADRs com status `Accepted` ou pendências explicitamente bloqueadas.

### Estado atual

**Concluída.**

Pendências como bridge final de URLs antigas e eventual substituição da API legada estão explicitamente adiadas para fases em que os destinos novos e testes de paridade já existam.

---

## Fase 3 — Bootstrap da nova aplicação

### Objetivo

Criar o novo app web sem substituir produção.

### Entregas

- workspace/pnpm;
- app Next;
- TypeScript strict;
- Tailwind;
- lint/format;
- Vitest;
- Playwright;
- scripts de typecheck/build/test;
- Vercel Preview;
- CI mínimo.

### Pré-condição adicional

A Fase 3 só pode começar quando o gate mínimo restante da Fase 0 estiver encerrado.

Topologia aprovada:

```txt
apps/web
→ projeto Vercel separado
→ Preview/Homologação
→ BFF server-side
→ API legada
```

### Gate de saída

```txt
install ✅
typecheck ✅
lint ✅
test ✅
build ✅
preview ✅
```

---

## Fase 4 — Design system

### Objetivo

Reproduzir a identidade existente de forma componentizada e consistente.

### Entregas

- tokens semânticos;
- dark mode;
- light mode;
- tipografia;
- espaçamento;
- bordas/sombras;
- estados de interação;
- componentes fundamentais;
- página de catálogo visual interna se útil.

### Gate de saída

Os elementos essenciais da UI atual podem ser reconstruídos sem CSS específico improvisado por tela.

---

## Fase 5 — Auth e shell

### Objetivo

Migrar a moldura da aplicação e o estado autenticado.

### Entregas

- Root Layout;
- Campaign Layout;
- header;
- navegação `Início` e `Sessões`;
- theme toggle;
- user menu;
- login/logout;
- estado de acesso pendente;
- campaign role;
- capabilities;
- SSR/cookies conforme integração oficial vigente.

### Gate de saída

Usuários reais conseguem entrar e chegar a um shell autenticado no Preview sem regressão de permissões.

---

## Fase 6 — Home e arquivo de sessões

### Objetivo

Modernizar a entrada da campanha sem novas features de domínio.

### Home alvo

```txt
CampaignHero
LatestSession
ArchiveStats
RecentSessions
```

### Arquivo alvo

```txt
/sessoes
→ catálogo cronológico completo
```

### Gate de saída

- dados reais carregados;
- dark/light aprovados;
- desktop/mobile aprovados;
- Home não contém blocos vazios de features futuras.

---

## Fase 7 — Página de sessão

### Objetivo

Corrigir a hierarquia atual: sessão é a memória; transcrição é um recurso da memória.

### Nova semântica

```txt
/sessoes/[id]
→ resumo

/sessoes/[id]/transcricao
→ transcrição
```

### Entregas

- hero;
- arco;
- título;
- metadata;
- resumo curto/completo;
- navegação para transcrição;
- download quando aplicável;
- estratégia final de compatibilidade/redirect para links antigos.

### Gate de saída

Abrir qualquer sessão publicada leva ao resumo sem exigir rota adicional, e a estratégia para links antigos está testada antes do cutover.

---

## Fase 8 — Transcrição

### Objetivo

Migrar a experiência atual preservando comportamento.

### Paridade obrigatória

- busca;
- filtro por speaker;
- paginação/cursor;
- carregamento incremental;
- status de resultados;
- limpar filtros;
- download Markdown;
- loading;
- retry;
- empty state.

### Gate de saída

Todos os cenários da matriz de transcrição passam com dados reais.

---

## Fase 9 — Qualidade, segurança e acessibilidade

### Objetivo

Tornar garantias técnicas parte do produto e não uma etapa cosmética final.

### Entregas

- TypeScript strict limpo;
- validação de entradas;
- revisão RLS;
- revisão de cookies/auth;
- headers de segurança;
- keyboard navigation;
- focus states;
- semântica HTML;
- `aria-*` relevante;
- reduced motion;
- contraste.

### Gate de saída

Nenhum blocker de segurança/a11y conhecido nos fluxos críticos.

---

## Fase 10 — Performance

### Objetivo

Garantir que a modernização não gere uma aplicação mais pesada sem benefício.

### Medir

- LCP;
- CLS;
- INP;
- JS enviado;
- requests;
- imagens;
- primeira renderização;
- navegação entre sessões;
- transcrição longa;
- custo do hop BFF → API legada durante coexistência.

### Gate de saída

Sem regressão crítica frente ao baseline e sem problema conhecido que prejudique uso real da mesa.

---

## Fase 11 — Paridade total

### Objetivo

Comparar legado e novo sistematicamente.

### Entregas

- matriz funcional preenchida;
- matriz visual preenchida;
- browsers alvo testados;
- screenshots aceitos;
- diferenças deliberadas documentadas.

### Gate de saída

100% dos requisitos marcados como obrigatórios em estado verde.

---

## Fase 12 — Homologação

### Objetivo

Validar com uso humano, não apenas CI.

### Cenários

- usuário já aprovado;
- acesso pendente;
- sessão nova;
- sessão antiga;
- resumo longo;
- transcrição longa;
- dark;
- light;
- desktop;
- mobile.

### Gate de saída

A mesa aprova o Preview para substituir produção.

---

## Fase 13 — Cutover

### Objetivo

Trocar produção de forma reversível.

### Entregas

- checklist pré-deploy;
- backups aplicáveis;
- env validado;
- smoke tests;
- plano de rollback;
- deploy;
- monitoramento inicial.

### Gate de saída

Produção nova estável e rollback disponível.

---

## Fase 14 — Estabilização

### Objetivo

Corrigir regressões antes de começar qualquer expansão.

### Entregas

- bugs pós-cutover resolvidos;
- logs revisados;
- performance real revisada;
- feedback da mesa triado;
- documentação corrigida conforme produção real.

### Gate de saída

Sem bug crítico/alto aberto relacionado à migração por período de estabilidade definido pela equipe.

---

## Fase 15 — Encerramento

### Objetivo

Fechar formalmente o ciclo.

### Entregas

- relatório final;
- dívidas restantes;
- lista do legado ainda mantido;
- decisão sobre remoção/arquivamento do frontend antigo;
- documentação principal atualizada;
- tag/release quando aplicável;
- autorização explícita para criar o roadmap de features.

### Gate final

O `README.md` deste diretório é marcado como **modernização concluída**.

Somente depois disso é permitido iniciar o roadmap de personagens, NPCs, lore, coleções, timeline e relações.
