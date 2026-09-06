> **Referência histórica — direção substituída em 2026-09-06.** O [reboot TDA](reboot/README.md) define o plano vigente. Este documento preserva decisões/evidências do escopo anterior; versões, fases e declarações de conclusão abaixo não certificam o estado do reboot. Revalidar requisitos antes de reutilizá-los.

# Roadmap de modernização total — TDA

## Objetivo

Modernizar o projeto inteiro sem manter versões concorrentes. A regra é simples:

- `main = produção`;
- `apps/web` é a aplicação web canônica;
- frontend, backend HTTP e Edit convergem para a mesma aplicação Next.js;
- Supabase continua como banco/Auth/Storage;
- `local-companion` continua como serviço local especializado de processamento pesado;
- qualquer implementação antiga só existe durante uma janela explícita de migração e é removida assim que a substituição passa nos gates.

## Estado auditado em 2026-09-06

### Web

- Next.js 16.3.3
- React 19.2.8
- TypeScript 6.0.3
- Tailwind CSS 4.3.0
- Vitest 5.0.0
- Playwright 1.62.1
- Supabase JS 2.111.0
- Supabase SSR 0.12.5
- Node 24.x

O frontend está em tecnologia recente, mas ainda carrega dependência de um backend/Editor legado e a topologia de deploy está duplicada.

### Backend

O backend operacional ainda está fora de `apps/web`, em JavaScript sem TypeScript. O maior risco estrutural é `api/[...path].js`, com mais de 330 KB, concentrando muitas rotas e responsabilidades.

### Edit

`web/central-local` ainda é HTML/CSS/JS direto, com arquivos grandes (`app.js` ~58 KB, `styles.css` ~28 KB) e sessão de autenticação separada da aplicação Next.

### Banco

- PostgreSQL 17.6
- 43 tabelas públicas
- RLS habilitado nas 43 tabelas
- 9 policies distribuídas em 5 tabelas

A base está em versão atual, mas a autorização precisa ser revisada em conjunto com a migração do backend para garantir que RLS, capabilities e service-role tenham responsabilidades explícitas.

### Companion local

- Python `>=3.11,<3.13`
- FastAPI 0.140.0
- faster-whisper 1.2.1
- CTranslate2 4.8.1
- Uvicorn 0.51.0

O runtime Python está artificialmente preso antes do 3.13 apesar de CTranslate2 já publicar wheels para 3.13/3.14. A atualização deve ser feita com benchmark de GPU/CPU e regressão de transcrição antes de escolher 3.13 ou 3.14 como baseline.

## Princípios

1. **Uma implementação por responsabilidade.** Nada de UI pública duplicada, duas sessões de auth ou dois backends para a mesma rota.
2. **Migração com remoção.** A fase só termina quando a implementação substituída é apagada.
3. **Tipos no limite.** Entrada HTTP, dados Supabase, jobs e integrações devem ter contratos validados e tipados.
4. **Server-first.** Server Components e Route Handlers por padrão; Client Components apenas onde há interação real.
5. **Sem framework por moda.** Adicionar dependência apenas quando ela remove complexidade real.
6. **Auditoria obrigatória após cada fase.** Build verde não encerra fase sozinho.
7. **Produção verificável.** SHA de produção deve corresponder ao HEAD de `main`.

## Fase 0 — Produção canônica e observabilidade de deploy

Objetivo: fazer `main = prod` ser verdadeiro na infraestrutura, não só no Git.

- um único projeto Vercel público para `apps/web`;
- `dnd.faysk.dev` apontando diretamente para ele;
- Production Branch `main`;
- remover rewrites públicos para `dnd-scribe-web-next`;
- manter backend/Edit antigo apenas em origem operacional temporária durante as fases seguintes;
- `/api/web/health` expõe SHA/ref de deploy;
- smoke test compara produção com HEAD de `main`;
- remover projeto Vercel intermediário quando não houver mais tráfego.

**Gate de auditoria:** Home TDA nova, assets/metadata corretos, login, sessões, `/edit`, APIs essenciais e SHA de produção validados.

## Fase 1 — Monorepo e toolchain únicos

Objetivo: remover mistura de ferramentas e estabelecer uma base de engenharia única.

- pnpm como único package manager;
- remover `package-lock.json` e comandos npm redundantes;
- scripts de raiz usando `pnpm --filter`/workspace;
- Node 24 LTS como baseline de produção; avaliar Node 26 apenas quando entrar em LTS;
- TypeScript 7 para o código TypeScript após validação com Next 16;
- atualizar Supabase SSR/JS e Playwright para patches estáveis atuais;
- lint/typecheck/test/build em um único quality gate;
- configurar atualização automatizada de dependências com política de patches/minors e PR para majors;
- padronizar `.editorconfig`, formatting e imports.

**Gate de auditoria:** instalação limpa do zero, lockfile único, CI reproduzível, nenhuma dependência duplicada desnecessária, build e E2E verdes.

## Fase 2 — Backend TypeScript modular dentro de `apps/web`

Objetivo: matar o backend JavaScript monolítico e colocar HTTP/API no mesmo runtime da aplicação.

- inventariar todas as rotas de `api/`;
- quebrar `api/[...path].js` por domínio;
- migrar para `apps/web/app/api/**/route.ts`;
- extrair regras para módulos de domínio sem dependência de Request/Response;
- contratos de entrada/saída validados;
- tipos de banco gerados do Supabase;
- remover `pg` direto onde Supabase/PostgREST/RPC já resolve melhor; manter SQL direto apenas onde houver justificativa de performance/transação;
- observabilidade estruturada por request/job;
- remover a rota antiga imediatamente após paridade.

**Gate de auditoria:** contrato de cada endpoint antigo vs novo, autorização, idempotência, erro, timeout, logs e smoke de produção.

## Fase 3 — Auth e autorização únicas

Objetivo: um login, uma sessão, capabilities verificadas no servidor.

- Supabase SSR como única implementação web de sessão;
- Home, Sessões, Edit e APIs usam a mesma sessão por cookie;
- eliminar autenticação própria do `central-local`;
- consolidar `resolveAuthState`/capabilities;
- separar claramente autenticação, autorização de campanha e autorização de recurso;
- revisar RLS das 43 tabelas e documentar quais são client-access, server-only e deny-by-default;
- service-role nunca exposto ao browser;
- logout único;
- testes de escalada horizontal/vertical de privilégio.

**Gate de auditoria:** login único, `/edit` abre sem segundo login, revogação de permissão tem efeito imediato, logout encerra tudo, matriz RBAC/E2E verde.

## Fase 4 — Edit moderno em Next/React

Objetivo: apagar `web/central-local` e transformar Edit em parte nativa do TDA.

- `/edit` protegido no App Router;
- migrar funcionalidade em slices pequenos, não portar o DOM antigo literalmente;
- componentes e formulários tipados;
- usar o mesmo design system e tokens da aplicação pública;
- acessibilidade de teclado/foco;
- autosave/estado local apenas onde necessário;
- progresso de processamento e jobs com UI resiliente;
- remover `index.html`, `app.js`, `processing-v04.js`, `styles.css` assim que a paridade estiver concluída.

**Gate de auditoria:** checklist funcional completo do Edit antigo, E2E dos fluxos críticos, sem segunda autenticação e sem assets do Edit legado.

## Fase 5 — Dados, Supabase e contratos

Objetivo: banco previsível, tipado e auditável.

- gerar tipos do schema no CI;
- revisar migrations e consolidar documentação do schema atual;
- identificar tabelas sem policy intencionalmente server-only;
- índices para consultas reais;
- constraints e enums onde hoje há strings livres críticas;
- funções/RPC com ownership e `search_path` seguros;
- contratos de Storage e URLs de artwork explícitos;
- backups/restore testados;
- eliminar dados/config históricos não usados.

**Gate de auditoria:** advisors de segurança/performance, RLS, migrations reprodutíveis, restore de teste e nenhum drift entre schema e tipos.

## Fase 6 — Companion local moderno

Objetivo: manter o processamento pesado local, mas com runtime e packaging atuais.

- testar Python 3.14 e 3.13; adotar o mais novo que passar GPU/CPU e dependências;
- lock de dependências reproduzível;
- typing gradual (mypy/pyright) nas fronteiras críticas;
- lint/format moderno;
- FastAPI com schemas explícitos;
- separar transcrição, catálogo, jobs e HTTP;
- health/status versionado;
- installer idempotente;
- benchmark antes/depois de faster-whisper/CTranslate2;
- remover scripts/paths históricos após migração.

**Gate de auditoria:** instalação limpa no Windows alvo, GPU e fallback CPU, regressão de qualidade/tempo/memória, testes e upgrade do installer.

## Fase 7 — Integrações e jobs

Objetivo: tirar lógica de integração do caminho crítico da UI e padronizar execução.

- Discord, Roll20 e workers com contratos próprios;
- idempotência e retries explícitos;
- jobs longos fora de requests síncronos;
- cron/supervisor com observabilidade;
- secrets por ambiente;
- remover endpoints compat/aliases sem consumidores;
- versionar APIs externas onde necessário.

**Gate de auditoria:** falhas simuladas, retry, duplicidade, timeout, observabilidade e segurança de webhook/API key.

## Fase 8 — UX, performance, segurança e encerramento do legado

Objetivo: finalizar modernização com uma aplicação coerente para visitante e editor.

- aplicar `docs/08_design_system_visual.md` em público e Edit;
- auditoria light/dark, contraste, responsividade e motion;
- Web Vitals e budget de bundle;
- imagens e OG/social;
- headers/CSP/cookies;
- accessibility E2E;
- remover flags, aliases, adapters e documentos de migração que perderam função;
- atualizar README para arquitetura final;
- renomear projeto/serviços para TDA onde fizer sentido;
- fechar issues de migração.

**Gate final:** nenhuma referência operacional ao frontend/Edit/backend antigos; produção em `main`; CI completo verde; smoke real no domínio; autenticação única; documentação atual.

## Ciclo obrigatório por fase

Cada fase segue exatamente este ciclo:

1. inventário e plano da fase;
2. implementação em branch/PR;
3. testes automáticos;
4. revisão do diff e busca de legado remanescente;
5. auditoria funcional em preview/produção conforme o risco;
6. correções;
7. segunda passagem de testes;
8. merge;
9. remoção explícita do substituído;
10. validação de produção e registro do SHA.

Nenhuma fase é considerada concluída apenas porque o código novo existe. Ela termina quando **o novo funciona e o velho foi removido**.
