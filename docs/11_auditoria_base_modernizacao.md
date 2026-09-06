# Auditoria base da modernização — 2026-09-06

Este documento registra o ponto de partida técnico usado pelo roadmap de modernização total.

## Achados principais

### 1. Frontend público

`apps/web` já está em stack moderna e deve permanecer como única UI pública:

- Next.js 16.3.3 (Active LTS em 2026-09)
- React 19.2.8
- Tailwind CSS 4.3.0
- TypeScript 6.0.3
- Vitest 5.0.0
- Playwright 1.62.1
- Node 24.x

Atualizações imediatas candidatas: TypeScript 7, Supabase JS 2.115.x, Supabase SSR 0.12.6, Playwright 1.63.x. Toda atualização deve passar pelo CI e não será feita apenas por número de versão.

### 2. Package management

O repositório declara pnpm no root e em `apps/web`, mas ainda contém `package-lock.json` e scripts root com `npm run`. Isso cria duas fontes de resolução e deve ser eliminado.

### 3. Backend

O backend operacional ainda está separado da aplicação Next. O maior hotspot é `api/[...path].js` (~337 KB), sinal claro de responsabilidades misturadas e baixa capacidade de isolamento/teste.

Destino: Route Handlers TypeScript por domínio em `apps/web`, com regras de domínio desacopladas de HTTP.

### 4. Edit

O Edit legado vive em `web/central-local`:

- `app.js` ~58 KB
- `index.html` ~20 KB
- `processing-v04.js` ~13 KB
- `styles.css` ~28 KB

É uma superfície separada, em JS/DOM direto, com autenticação própria. Deve ser substituída por `/edit` no App Router e apagada após paridade.

### 5. Deploy

A Vercel ainda possui dois projetos envolvidos na UI (`dnd-scribe` e `dnd-scribe-web-next`). Isso viola o contrato `main = prod` enquanto o domínio depender de rewrite para um deployment intermediário.

Destino: um projeto público ligado a `main`, Root Directory `apps/web`, domínio direto. Backend/Edit legado só permanece como origem operacional até ser absorvido.

### 6. Supabase

Auditoria de metadados do projeto:

- PostgreSQL 17.6
- 43 tabelas públicas
- RLS habilitado em todas as 43
- 9 policies em 5 tabelas
- 8 funções públicas

RLS habilitado sem policy pode ser intencional para tabelas server-only, mas isso deve ser classificado e documentado explicitamente durante a fase de dados/autorização.

### 7. Companion local

`local-companion` usa:

- Python `>=3.11,<3.13`
- FastAPI 0.140.0
- faster-whisper 1.2.1
- CTranslate2 4.8.1
- Uvicorn 0.51.0

O limite `<3.13` está desatualizado em relação ao ecossistema atual: CTranslate2 4.8.1 já publica wheels para CPython 3.13 e 3.14. A escolha final entre 3.13 e 3.14 deve ser baseada em instalação real, CUDA, benchmark e regressão do pipeline, não apenas disponibilidade de wheel.

## Critério arquitetural

O estado final não terá camadas chamadas `legacy`, `next`, `v2` ou equivalentes como caminhos permanentes. Durante migrações, adapters são temporários e precisam de issue/critério de remoção.

O objetivo final é:

```text
Faysk/dnd-scribe@main
├─ apps/web       TDA completo: público + Edit + API
├─ local-companion processamento pesado local
├─ supabase       migrations/config
├─ integrations   clientes/bridges externos
└─ docs           documentação vigente
```

Produção pública:

```text
dnd.faysk.dev -> apps/web@main
```

Sem frontend intermediário e sem segunda autenticação.
