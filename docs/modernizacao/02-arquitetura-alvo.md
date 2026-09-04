# 02 — Arquitetura alvo

Status: **Fase 1 concluída — arquitetura aprovada para bootstrap**

## Objetivo

Definir a arquitetura da nova aplicação pública sem alterar o domínio funcional do DnD Scribe durante a modernização.

A Fase 1 está encerrada porque as decisões críticas que bloqueavam o bootstrap foram formalizadas. A implementação continua bloqueada pelo gate restante da Fase 0 até que o baseline visual/performance mínimo esteja congelado.

## Limites do sistema

A modernização é da camada pública de leitura e navegação.

Continuam separados:

```txt
App público Next
→ autentica jogadores
→ renderiza sessões, resumos e transcrições
→ atua como BFF do browser durante a migração

API legada
→ permanece fronteira canônica de dados do player
→ mantém regras atuais de acesso/campaign role/capabilities

Central Local / companion
→ importa Craig
→ processa áudio
→ transcreve
→ revisa
→ publica resultados pequenos

Supabase / PostgreSQL
→ autenticação
→ perfis
→ campanhas
→ sessões
→ conteúdo publicado
→ permissões
```

O novo frontend não absorve processamento local, revisão narrativa, ingestão de áudio ou novas features de domínio.

## Stack alvo

A documentação não fixa patch versions. Em cada fase deve ser adotada a versão estável/LTS mais recente compatível e validada em CI.

### Runtime

- Node.js LTS.

### Aplicação web

- Next.js com App Router;
- React;
- TypeScript strict;
- Server Components por padrão;
- Client Components apenas onde houver interação real.

### UI

- Tailwind CSS para utilitários e composição;
- design tokens próprios;
- componentes acessíveis e estilizados pela identidade DnD Scribe;
- nenhuma biblioteca deve impor visual genérico ao produto.

### Dados

- Supabase/PostgreSQL mantidos;
- Supabase Auth com integração SSR/cookies oficial vigente;
- API legada preservada como contrato canônico de leitura durante a migração;
- BFF server-side no Next para esconder a origem legada do browser;
- tipos de banco gerados quando isso for necessário e seguro;
- Zod para validação em runtime.

### Qualidade

- Vitest para unitários;
- Playwright para E2E e regressão visual;
- lint/format;
- typecheck obrigatório;
- Preview Deploy por PR.

## Organização do repositório

Estrutura alvo inicial:

```txt
dnd-scribe/
│
├── apps/
│   └── web/
│       ├── app/
│       ├── components/
│       ├── features/
│       ├── lib/
│       ├── styles/
│       ├── types/
│       ├── public/
│       └── tests/
│
├── local-companion/
├── api/                  # legado preservado durante coexistência
├── lib/
├── scripts/
├── tools/
└── docs/
```

A criação de `packages/` só deve acontecer quando existir compartilhamento real suficiente para justificá-la.

Durante o bootstrap, o objetivo é minimizar impacto sobre o root legado. O novo app deve nascer autocontido em `apps/web` e o projeto Vercel novo terá esse diretório como Root Directory.

## Organização do app web

```txt
apps/web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts
│   ├── api/
│   │   └── player/
│   │       └── ...
│   ├── sessoes/
│   │   ├── page.tsx
│   │   └── [sessionId]/
│   │       ├── page.tsx
│   │       └── transcricao/
│   │           └── page.tsx
│   └── ...
│
├── components/
│   ├── ui/
│   ├── layout/
│   └── campaign/
│
├── features/
│   ├── auth/
│   ├── sessions/
│   └── transcript/
│
├── lib/
│   ├── legacy-api/
│   ├── supabase/
│   ├── validation/
│   └── utils/
│
└── styles/
```

`lib/legacy-api` é server-only e concentra chamadas para o backend vigente.

## Rotas alvo durante a modernização

```txt
/
/sessoes
/sessoes/[id]
/sessoes/[id]/transcricao
```

### `/`

Home da campanha usando apenas dados já existentes.

### `/sessoes`

Arquivo cronológico completo.

### `/sessoes/[id]`

Resumo como conteúdo padrão.

### `/sessoes/[id]/transcricao`

Transcrição completa, busca, speaker filter e download.

Não criar rotas de pessoas, mundo ou lore neste roadmap.

A bridge final para URLs hash antigas permanece deliberadamente adiada até a Fase 7/cutover, quando os destinos novos já existirem.

## Rendering

### Server Components por padrão

Usar para:

- shell de página;
- Home;
- arquivo de sessões;
- resumo;
- metadados de sessão;
- conteúdo editorial.

### Client Components

Usar somente para:

- theme switch;
- menu interativo;
- filtros;
- busca da transcrição;
- carregamento incremental;
- ações do usuário;
- componentes que dependam de APIs exclusivas do browser.

Client Components não devem conhecer `LEGACY_API_ORIGIN` nem montar chamadas cross-origin para o backend antigo.

## Auth

Objetivo:

- sessão disponível no servidor;
- redirects coerentes;
- sem flicker de estado autenticado;
- cookies seguros;
- mesmas regras de campaign role/capabilities existentes;
- nenhuma chave privilegiada no browser.

Fluxo alvo de alto nível:

```txt
Browser
→ Supabase OAuth
→ /auth/callback no app Next
→ sessão SSR/cookies
→ Server Component/BFF
→ access token do próprio usuário
→ API legada
```

O novo projeto precisa ter suas URLs de callback/redirect aprovadas na configuração de Auth do Supabase antes da Fase 5.

## Fronteira de dados durante a migração

A decisão canônica está nos ADRs 008 e 010.

```txt
Browser
  ↓
Next.js
  ↓
legacy-api adapter (server-only)
  ↓ Authorization: Bearer <user token>
API legada
  ↓
Supabase/PostgreSQL
```

### Server Components

Podem chamar o adapter diretamente.

### Fluxos interativos

Devem passar por Route Handlers internos do Next, por exemplo:

```txt
/api/player/transcript
```

que então chamam `/api/library-transcript` no legado.

### Variável de origem

O projeto Next terá configuração server-only equivalente a:

```txt
LEGACY_API_ORIGIN=https://dnd.faysk.dev
```

A origem concreta pode variar por ambiente, mas nunca deve ficar espalhada em componentes.

### Cache

Conteúdo autenticado é privado. A implementação inicial deve preferir comportamento dinâmico/privado até existir uma política explícita e testada de cache.

Nenhum dado protegido da campanha pode ser promovido acidentalmente a cache público compartilhado.

## Contratos de dados

Não reescrever API e frontend ao mesmo tempo sem necessidade.

A migração de endpoints para handlers próprios, RPCs ou acesso direto ao Supabase só deve ocorrer quando:

1. existir teste de paridade;
2. o contrato estiver documentado;
3. autorização equivalente estiver comprovada;
4. a mudança reduzir complexidade ou melhorar segurança;
5. houver rollback simples;
6. o ADR 008/010 for atualizado ou superseded quando necessário.

## Markdown

Resumos atuais continuam no formato existente.

A modernização pode trocar o mecanismo de renderização, mas não deve exigir conversão manual do acervo.

Requisitos:

- sanitização segura;
- renderização server-side quando possível;
- suporte ao Markdown atual;
- regressão visual testada.

## Imagens

Mesmo sem novas galerias neste roadmap, a nova base deve tratar capas e hero images com a solução nativa do framework quando apropriado.

Requisitos:

- dimensões conhecidas;
- responsive sizes;
- lazy loading fora da dobra;
- hosts remotos explicitamente permitidos;
- ausência de layout shift evitável.

## Design system

A estética atual deve virar um sistema semântico.

Os tokens atuais serão mapeados para conceitos como:

```txt
canvas
surface
surface-elevated
border
foreground
foreground-muted
accent
accent-strong
danger
success
```

Dark e light usam os mesmos nomes semânticos com valores diferentes.

## Topologia de deploy durante coexistência

Decisão formalizada no ADR 009:

```txt
Projeto Vercel atual
  dnd-scribe
  Root Directory: repositório legado
  produção: dnd.faysk.dev
  função: produção atual + API existente

Projeto Vercel novo
  app Next
  Root Directory: apps/web
  produção de domínio: NÃO durante bootstrap
  função: Preview/Homologação
```

O domínio `dnd.faysk.dev` não muda de projeto durante Fases 3–12.

O cutover só ocorre na Fase 13, com smoke test e rollback documentado.

## Dependências futuras explicitamente adiadas

Não instalar na modernização sem uso real:

- Tiptap;
- React Flow / XYFlow;
- bibliotecas de grafo;
- uploader avançado de galeria;
- editor colaborativo.

## Estratégia de compatibilidade

A nova aplicação deve coexistir com o legado durante a migração.

```txt
main / produção
→ frontend atual + API atual

apps/web em projeto Vercel separado
→ nova aplicação
→ consome API atual por BFF

paridade 100%
→ homologação
→ cutover

estabilização
→ remoção controlada do legado
```

## Decisões formalizadas

- ADR 001 — Next.js App Router;
- ADR 002 — TypeScript strict;
- ADR 003 — Supabase permanece;
- ADR 004 — local-first preservado;
- ADR 005 — design system próprio;
- ADR 006 — Server Components por padrão;
- ADR 007 — feature freeze;
- ADR 008 — API legada como fronteira de dados;
- ADR 009 — projeto Vercel separado para Preview/Homologação;
- ADR 010 — BFF Next para consumo da API legada.

## Gate da Fase 1

- [x] stack e política de versões definidas;
- [x] limites local/cloud explícitos;
- [x] rotas alvo definidas;
- [x] organização do app definida;
- [x] auth definida em nível arquitetural;
- [x] estratégia de dados definida;
- [x] rendering strategy definida;
- [x] coexistência/deploy definida;
- [x] decisões críticas registradas em ADRs;
- [x] nenhuma feature futura misturada ao escopo.

Resultado:

```txt
FASE 1 = CONCLUÍDA
FASE 3 = AINDA BLOQUEADA PELO GATE RESTANTE DA FASE 0
```
