# 31 — Execução da Fase 3 — Bootstrap

Status: **CONCLUÍDA**  
Data de início: **2026-09-04**  
Data de encerramento operacional: **2026-09-04**  
PR inicial: **#25**

## Objetivo

Criar a nova fundação do app público em paralelo ao legado, sem colocar o projeto Vercel que atende `dnd.faysk.dev`, API, Central Local, crons e integrações dentro do blast radius da modernização.

## Fundação criada

```txt
pnpm-workspace.yaml
apps/web/
.github/workflows/web-next-ci.yml
```

`apps/web` contém:

- Next.js App Router;
- React;
- TypeScript strict;
- Tailwind CSS 4 via PostCSS;
- Vitest;
- Playwright;
- ESLint;
- CI isolado;
- build independente do frontend legado.

O root legado continua preservado. `web/`, `api/`, `lib/`, Central Local, workers e pipeline operacional não foram movidos nesta fase.

## Stack efetivamente validada

| Tecnologia | Versão validada |
| --- | --- |
| Node.js | 24.x |
| pnpm | 11.25.0 |
| Next.js | 16.3.3 |
| React | 19.2.7 |
| TypeScript | 6.0.3 |
| Tailwind CSS | 4.3.0 |
| Vitest | 5.0.0 |
| Playwright | 1.62.1 |

### TypeScript 7

A tentativa inicial de TypeScript 7.0.2 passou em `tsc --noEmit`, mas falhou na cadeia de lint porque `typescript-eslint` usada pelo `eslint-config-next` ainda não suportava a versão.

ADR 013 registra a decisão de usar TypeScript 6.0.3 como bridge temporária sem desligar lint ou typecheck.

## pnpm e lockfile

O workspace passou a usar lockfile versionado e CI com:

```txt
pnpm install --frozen-lockfile
```

O gate deixou de aceitar regeneração silenciosa de dependências no CI.

O caso de `unrs-resolver` permanece explicitamente tratado pelas políticas de build do pnpm, sem aprovação genérica de scripts arbitrários.

## CI

O fluxo moderno valida:

```txt
install frozen
TypeScript
ESLint
Vitest
Next build
client bundle audit
bundle inventory
Playwright
```

O CI legado continua sendo executado separadamente para proteger:

```txt
App checks
Companion regression tests
Python syntax
```

Assim a criação do novo frontend não substituiu nem enfraqueceu os gates existentes.

## Projeto Vercel separado

O segundo projeto Vercel foi efetivamente criado em 2026-09-04:

```txt
Team: DND / dndscribe
Projeto: dnd-scribe-web-next
Project ID: prj_RVVEAucDhhftHY3UlE8PtoNxn6yl
Framework: Next.js
```

O projeto legado continua separado:

```txt
Projeto: dnd-scribe
Project ID: prj_f9dVc7yr981wW9TkX0KbjeMrbSUm
Produção: dnd.faysk.dev
```

Nenhum domínio principal foi movido.

### Mecanismo de publicação

A superfície de automação disponível permitiu criar o projeto por deploy MCP, mas não permite alterar Git Integration/Root Directory de projeto existente.

ADR 014 registra a operação temporária aceita:

```txt
segundo projeto isolado
+
deploy reproduzível por SHA imutável
```

Git Integration com `Root Directory = apps/web` continua desejável, porém não é mais tratada como bloqueio técnico quando o deployment é reproduzível e identificado.

## Primeiro Preview Next válido

Release técnico usado para fechar o bootstrap:

```txt
Source commit:
bf7ce242d083825cc65ee03354b3c638c95e87f0

Deployment:
dpl_Ha9etK6sk3e96qmqVxJTCmz6fLoQ

URL:
https://dnd-scribe-web-next-q2fsoielw-dndscribe.vercel.app

State:
READY

Region:
iad1
```

O build real da Vercel detectou:

```txt
Next.js 16.3.3
```

e gerou:

```txt
/
/api/library/download
/api/library/transcript
/auth/callback
/auth/logout
/design-system
/login
/sessoes
/sessoes/[id]
/sessoes/[id]/transcricao
```

Isso prova que o segundo projeto está construindo o **app Next moderno**, e não `scripts/sync-public.js` do legado.

## Origem legada

A origem técnica usada pelo BFF ficou independente do hostname público móvel:

```txt
DND_LEGACY_ORIGIN=https://dnd-scribe-amber.vercel.app
DND_LEGACY_EDIT_ORIGIN=https://dnd-scribe-amber.vercel.app
```

`https://dnd-scribe-amber.vercel.app/api/auth-config` foi validado com HTTP 200 antes da integração.

Portanto o futuro cutover de `dnd.faysk.dev` não faz o BFF chamar a si próprio.

## Env do Preview MCP

Como a ferramenta de deploy não expõe gestão de Environment Variables, o primeiro Preview transportou somente valores não secretos necessários ao build/runtime:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
DND_LEGACY_ORIGIN
DND_LEGACY_EDIT_ORIGIN
```

Nenhum service role, senha, token de bot ou segredo operacional foi colocado no pacote.

Quando o app moderno precisar de qualquer segredo server-only adicional, env management nativo da Vercel passa a ser obrigatório antes da promoção.

## Limite da API Vercel

Após os deployments de execução do dia, a API do plano Hobby atingiu:

```txt
api-deployments-free-per-day
remaining: 0
reset: 2026-09-05T21:12:30.716Z
```

A tentativa de criar um deployment adicional recebeu HTTP 402.

Isso não invalida o Preview READY já criado e não afeta a produção legada.

A partir daqui deployments MCP devem ser tratados como release candidates, evitando chamadas redundantes.

## Gate final da Fase 3

```txt
apps/web criado                       ✅
App Router                            ✅
TypeScript strict                     ✅
Tailwind 4                            ✅
Vitest                                ✅
Playwright                            ✅
CI Next                               ✅
CI legado                             ✅
lockfile versionado/frozen            ✅
projeto Vercel separado               ✅
Preview Next real                     ✅
commit do Preview identificado        ✅
framework Next detectado              ✅
origem legada estável                 ✅
origem legada saudável                ✅
produção atual preservada             ✅
dnd.faysk.dev não movido              ✅
```

Resultado:

```txt
FASE 3 = CONCLUÍDA
```

## Observação histórica

As Fases 4–10 já foram executadas depois do bootstrap inicial. Este documento foi atualizado posteriormente para remover blockers que já tinham sido resolvidos na prática e registrar a evidência real do projeto Vercel separado.
