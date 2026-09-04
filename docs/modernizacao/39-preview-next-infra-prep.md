# 39 — Preparação operacional do Preview Next separado

Status: **preparação concluída; criação do projeto Vercel exige ação externa**  
Data: **2026-09-04**

## Motivo desta etapa

A auditoria da Fase 10 confirmou uma lacuna de infraestrutura já registrada desde a Fase 3:

- o projeto Vercel atual `dnd-scribe` continua apontando para a raiz legada;
- previews de branches da modernização nesse projeto **não executam `apps/web`**;
- os logs de build confirmam `npm run build → scripts/sync-public.js → public/`;
- não existe hoje um segundo projeto Vercel ligado ao mesmo repositório com Root Directory `apps/web`.

Consequência:

> ainda não existe um Preview remoto real do novo Next para executar OAuth, benchmark autenticado e homologação.

Isso explica por que a Fase 10 consegue concluir otimizações de código/CI, mas não consegue fechar o benchmark autenticado.

---

## 1. Projeto atual preservado

Team:

```txt
DND
slug: dndscribe
id: team_r8ASBmnk3arIV9YwBkbqplKE
```

Projeto legado:

```txt
name: dnd-scribe
id: prj_f9dVc7yr981wW9TkX0KbjeMrbSUm
framework preset: none
Node: 24.x
GitHub: Faysk/dnd-scribe
```

Esse projeto **não deve** ter Root Directory alterado para `apps/web`, pois continua responsável pela produção legada, APIs, Edit/Central Local e funções operacionais.

---

## 2. Origem técnica legada resolvida sem novo DNS

ADR 012 exige que o BFF do Next use uma origem estável diferente do hostname móvel `dnd.faysk.dev`.

Foi verificado em 2026-09-04 que:

```txt
https://dnd-scribe-amber.vercel.app/api/auth-config
→ HTTP 200
→ API legada atual
```

Esse domínio é um domínio de projeto já associado ao Vercel legado, portanto pode cumprir a função de origem técnica durante coexistência sem depender imediatamente de criar `legacy.dnd.faysk.dev`.

Configuração preparada:

```env
DND_LEGACY_ORIGIN="https://dnd-scribe-amber.vercel.app"
DND_LEGACY_EDIT_ORIGIN="https://dnd-scribe-amber.vercel.app"
```

O hostname público `dnd.faysk.dev` continua proibido como upstream interno.

Um domínio dedicado `legacy.dnd.faysk.dev` ainda pode ser criado no futuro por clareza operacional, mas deixa de bloquear o Preview Next.

---

## 3. Projeto Vercel que precisa existir

Criar no team `DND` um segundo projeto com configuração equivalente a:

```txt
Project name: dnd-scribe-web-next
Git repository: Faysk/dnd-scribe
Root Directory: apps/web
Framework Preset: Next.js
Node.js: 24.x
Production domain principal: nenhum durante bootstrap/homologação
```

Não mover `dnd.faysk.dev` nesta etapa.

---

## 4. Variáveis mínimas do projeto novo

### Públicas

```env
NEXT_PUBLIC_SUPABASE_URL="https://dmrqnbdvbkfqzctcerbx.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="<mesma publishable key pública usada pelo app atual>"
```

A publishable key pode ser copiada da configuração pública do app legado; não usar service role/secret key.

### Server-only

```env
DND_LEGACY_ORIGIN="https://dnd-scribe-amber.vercel.app"
DND_LEGACY_EDIT_ORIGIN="https://dnd-scribe-amber.vercel.app"
```

Não copiar para o projeto Next:

```txt
SUPABASE_SECRET_KEY / service_role
DB password
Discord bot token
OpenAI key
R2 secrets
worker/companion credentials
cron secrets
```

---

## 5. Redirect URLs do Supabase Auth

O login atual monta `/auth/callback` a partir da própria origem do browser. Portanto o domínio do projeto Next precisa constar na allowlist de Redirect URLs do Supabase.

A documentação oficial do Supabase suporta wildcards para Preview URLs da Vercel e recomenda padrões controlados para esse cenário.

Configuração mínima sugerida após o projeto existir:

```txt
http://localhost:3000/**
https://dnd-scribe-web-next-*-dndscribe.vercel.app/**
```

Depois que a Vercel expuser um alias estável de branch/projeto, preferir adicionar também a URL exata usada na homologação.

Para produção futura, usar URL exata; não depender de wildcard amplo no domínio principal.

---

## 6. Smoke obrigatório após criação

Sem login:

```txt
GET /login
→ 200
```

Com OAuth real:

```txt
/login
→ Discord ou Google
→ Supabase
→ /auth/callback
→ cookie SSR
→ /
```

Usuário sem membership:

```txt
→ pending access
```

Usuário aprovado:

```txt
→ Home real
→ /sessoes
→ resumo
→ transcrição
```

Também validar:

```txt
DND_LEGACY_ORIGIN responde via server-side BFF
não há CORS browser → legado
logout funciona
headers da Fase 9 presentes
next/image consegue otimizar as três origens allowlisted
```

---

## 7. Performance depois do smoke

Com o Preview Next real e usuário aprovado, executar os itens bloqueados da Fase 10:

```txt
Home desktop/mobile × 3
Resumo × 3
Transcrição inicial × 3
Infinite load
Busca
Speaker filter
LCP
CLS
TBT/INP conforme ferramenta
TTFB
bytes/requests/imagens
```

Em paralelo, coletar o mesmo protocolo no legado usando a mesma sessão de referência.

Somente então a comparação legado × moderno pode ser marcada como PASS/FAIL.

---

## 8. O que foi possível automatizar nesta etapa

```txt
team Vercel auditado ✅
projeto legado auditado ✅
build real de Preview legado auditado ✅
confirmado que previews atuais não são apps/web ✅
origem técnica legada alternativa verificada com HTTP 200 ✅
.env.example preparado ✅
configuração mínima do projeto Next definida ✅
redirect pattern definido conforme suporte oficial Supabase ✅
```

## 9. Hard blocker restante

A integração Vercel disponível neste ambiente permite consultar projetos, deploys e logs, mas não expõe criação/configuração de um segundo projeto.

Logo, existe **uma ação externa inevitável**:

```txt
criar/importar o projeto dnd-scribe-web-next no Vercel
com Root Directory = apps/web
```

Depois disso, toda a validação técnica volta a ser automatizável daqui.
