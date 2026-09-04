# 43 — Fase 15: Relatório final — rascunho factual

Status: **RASCUNHO PRONTO — conclusão depende de cutover + estabilização**  
Data de preparação: **2026-09-04**

> Este documento separa fatos já provados de campos que só podem ser preenchidos depois da produção moderna estabilizada.

## 1. Objetivo da modernização

Modernizar o app público do DnD Scribe sem iniciar novas features de domínio e sem reescrever simultaneamente API, Central Local, jobs, crons ou processamento pesado local.

Mudança de produto deliberada:

> o app deixa de tratar a transcrição como entrada principal e passa a tratar a memória/resumo da sessão como conteúdo principal.

## 2. Escopo preservado

Fora do ciclo:

```txt
Pessoas/NPCs
Lore editável
Galerias
Coleções
Jornada/Timeline
Mundo
Relações/Grafo
Busca global de entidades
modernização completa do backend
modernização do Companion/pipeline
```

## 3. Stack implementada

Versões observadas no workspace antes do RC final:

| Camada | Versão |
| --- | --- |
| Node.js | 24.x |
| Next.js | 16.3.3 |
| React | 19.2.7 |
| React DOM | 19.2.7 |
| TypeScript | 6.0.3 strict |
| Tailwind CSS | 4.3.0 |
| pnpm | 11.25.0 |
| Supabase JS | 2.111.0 |
| @supabase/ssr | 0.12.5 |
| marked | 18.0.7 |
| Vitest | 5.0.0 |
| Playwright | 1.62.1 |

Nota: TypeScript 6 permanece como bridge documentada pelo ADR 013 até o tooling estável suportar TypeScript 7 sem enfraquecer lint/build.

## 4. Arquitetura implementada

```txt
Browser
→ Next App Router
→ Server Components por padrão
→ Client Components apenas onde interação exige
→ Supabase Auth SSR/cookies
→ BFF server-side
→ DND_LEGACY_ORIGIN
→ API legada
→ Supabase/PostgreSQL
```

Topologia operacional prevista/implementada em código:

```txt
Projeto Next
├── app público
├── /api/web/* BFF
└── fallback de contratos legados

Projeto legado
├── API
├── Central Local/Edit
├── integrations
├── jobs
└── crons
```

## 5. UX deliberadamente alterada

### Home

Antes:

```txt
catálogo de sessões como tela principal
```

Novo modelo:

```txt
CampaignHero
LatestSession
ArchiveStats
RecentSessions
```

### Arquivo

```txt
/sessoes
→ catálogo completo
```

### Sessão

Antes:

```txt
transcrição como entrada
```

Depois:

```txt
/sessoes/[id] → resumo/memória
/sessoes/[id]/transcricao → recurso secundário
```

### Links históricos

Bridge preservada:

```txt
#/sessao/:id        → /sessoes/:id/transcricao
#/sessao/:id/resumo → /sessoes/:id
```

Possui cobertura unitária e E2E.

## 6. Design system

Identidade preservada como dois temas oficiais:

```txt
dark  → grimório noturno/cinemático
light → livro/arquivo em papel quente
```

A base usa tokens semânticos e componentes próprios, evitando estética genérica de dashboard SaaS.

## 7. Auth e autorização

Implementado:

- Supabase Auth SSR/cookies;
- OAuth Google/Discord no fluxo moderno;
- callback PKCE;
- logout server-side com proteção de Origin;
- estados anonymous/pending/authorized;
- capabilities/campaignRole/profile preservados;
- autorização de dados continua no backend/RLS, não apenas em esconder UI.

Homologação real em produção/RC: **PENDENTE**.

## 8. Sessões e resumo

Implementado:

- Home moderna com dados existentes;
- `/sessoes`;
- `/sessoes/[id]` como resumo default;
- Markdown renderizado server-side com sanitização;
- hero/covers responsivos via `next/image`;
- estados sem resumo/erro/not-found.

Paridade com acervo real autenticado: **PENDENTE RC**.

## 9. Transcrição

Implementado/preservado:

- primeira página de 120 segmentos;
- busca textual;
- filtro por speaker;
- combinação/clear;
- contador;
- cursor;
- progressive/infinite load;
- fallback "Carregar mais";
- retry;
- empty state;
- download `.md`;
- namespace BFF `/api/web/library/*`;
- conteúdo privado `no-store`.

Paridade real com corpus autenticado: **PENDENTE RC**.

## 10. Segurança

Fatos já provados:

- TypeScript strict sem bypass de build;
- BFF com allowlist de endpoints e timeout;
- inputs de transcrição com limites explícitos;
- logout cross-origin rejeitado;
- headers básicos de segurança;
- client bundle audit sem markers server-only;
- origem legada não pode ser `dnd.faysk.dev` no BFF/gateway;
- Markdown possui renderer seguro;
- RLS/Supabase foram revisados sem DDL cosmético para silenciar advisor.

Dívidas aceitas/documentadas antes da produção final:

```txt
SEC-01 — superfície SECURITY DEFINER RPC — medium
SEC-02 — leaked-password protection — info / não aplicável ao OAuth atual
SEC-03 — CSP com nonce — medium / adiada
```

Critical/high abertos conhecidos no bloco automatizado: **0**.

## 11. Acessibilidade

Automação já cobre:

- landmarks/H1;
- skip link;
- target programaticamente focável;
- foco visível onde a engine oferece Full Keyboard Access;
- reduced motion;
- reflow estreito;
- labels de inputs;
- estados de loading/erro;
- matriz Chromium/Firefox/WebKit desktop/mobile.

Contrastes principais foram medidos em AA para textos normais auditados.

Validação manual autenticada/zoom/mobile real: **PENDENTE**.

## 12. Performance

Otimizações implementadas:

- `next/image` em covers/heroes;
- allowlist de hosts de imagem;
- prefetch reduzido em catálogo/transcrição;
- bundle audit/measurement no CI;
- cache privado preservado;
- virtualização da transcrição não adicionada sem evidência.

Inventário do build observado antes do RC final:

```txt
JS  ~881 KiB raw / ~265 KiB gzip em 17 chunks
CSS ~32.4 KiB raw / ~6.6 KiB gzip
```

Esses números representam inventário global emitido, não payload inicial de uma rota.

Benchmark autenticado legado × moderno: **PENDENTE**.

## 13. CI

Estado antes do RC final:

```txt
frozen lockfile      ✅
typecheck            ✅
lint                 ✅
unit tests           ✅
Next build           ✅
client bundle audit  ✅
bundle measurement   ✅
Playwright 5 projetos✅
CI legado            ✅
Companion regression ✅
Python syntax        ✅
```

Matriz E2E verde consolidada na Fase 11.

## 14. Gateway de coexistência

Preparado em código como fallback externo depois das rotas locais.

Classes encaminhadas:

```txt
/api/* restante
/edit*
/central-local*
/terms
/privacy
/linked-role
/docs/api*
```

Namespace moderno local:

```txt
/api/web/*
```

A efetividade real do external rewrite/headers fica para o RC Vercel.

## 15. Produção/cutover

```txt
Data do cutover: PENDENTE
RC SHA: PENDENTE
Deployment ID: PENDENTE
Houve rollback?: PENDENTE
```

## 16. Estabilização

```txt
Início: PENDENTE
Fim: PENDENTE
Incidentes critical/high: PENDENTE
Bugs corrigidos: PENDENTE
Uso real suficiente: PENDENTE
Feedback da mesa: PENDENTE
```

## 17. Legado restante esperado

Mesmo depois do frontend moderno entrar em produção, o projeto legado pode continuar hospedando deliberadamente:

```txt
API
Central Local/Edit
integrations
jobs
crons
tooling operacional
```

Isso não significa falha da modernização: o escopo é o app público.

## 18. Frontend legado

Decisão final: **PENDENTE APÓS ESTABILIZAÇÃO**.

Preferência segura inicial:

```txt
manter versionado/recuperável durante a estabilização
```

Qualquer remoção deve ser PR posterior e não misturada ao cutover.

## 19. Dívidas e próximos passos

Após estabilização, classificar separadamente:

```txt
modernization debt
legacy backend debt
operational improvement
future feature
```

O Roadmap V2 não começa antes da declaração final.

## 20. Declaração final

Ainda **NÃO** emitir:

```txt
MODERNIZAÇÃO: COMPLETA
```

Esse marcador só pode substituir esta seção após:

- Fase 11 real fechada;
- Fase 12 homologada;
- Fase 13 executada;
- Fase 14 estabilizada;
- checklist final revisado.

Até lá o presente documento funciona como relatório pré-preenchido, reduzindo o trabalho administrativo do encerramento sem inventar fatos de produção.
