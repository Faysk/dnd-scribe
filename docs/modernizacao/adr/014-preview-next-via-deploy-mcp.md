# ADR 014 — Preview Next pode ser publicado por deploy MCP reproduzível

Status: **Accepted**  
Data: **2026-09-04**

## Contexto

ADR 009 definiu corretamente que o novo app Next deve viver em um segundo projeto Vercel, isolado do projeto legado que ainda atende `dnd.faysk.dev`, APIs, Central Local, crons e integrações.

A decisão original assumia que esse segundo projeto seria ligado diretamente ao mesmo repositório GitHub com `Root Directory = apps/web`.

Durante a execução real, a superfície de automação disponível passou a expor uma operação de deploy que cria um projeto Vercel a partir de uma árvore de arquivos, porém não expõe mutação de Git Integration, Root Directory ou Environment Variables de um projeto existente.

A modernização não deve ficar artificialmente bloqueada quando a propriedade arquitetural importante — **isolamento do novo frontend** — pode ser preservada de forma reproduzível.

## Decisão

É aceito, durante modernização e homologação, operar o segundo projeto Vercel por **deploy MCP reproduzível**, mesmo que o campo de Git Integration permaneça vazio, desde que todas as regras abaixo sejam respeitadas.

### 1. Projeto separado obrigatório

O projeto Next nunca é publicado dentro do projeto legado durante esta etapa.

Estado criado em 2026-09-04:

```txt
Team: DND / dndscribe
Projeto: dnd-scribe-web-next
Project ID: prj_RVVEAucDhhftHY3UlE8PtoNxn6yl
Framework: Next.js
```

O projeto legado permanece:

```txt
dnd-scribe
prj_f9dVc7yr981wW9TkX0KbjeMrbSUm
```

### 2. Fonte precisa ser um commit Git imutável

Um deploy MCP de homologação não pode buscar `main` e simplesmente confiar no conteúdo recebido.

O bootstrap deve:

1. declarar o SHA esperado;
2. obter o repositório público;
3. verificar `git rev-parse HEAD`;
4. abortar se o SHA não for exatamente o candidato esperado;
5. copiar somente a aplicação `apps/web` necessária para o build.

O primeiro Preview Next válido foi construído a partir de:

```txt
bf7ce242d083825cc65ee03354b3c638c95e87f0
```

### 3. Nenhum segredo no payload de deploy

O deploy MCP não oferece gerenciamento de Environment Variables do projeto.

Enquanto essa limitação existir, somente valores **não secretos** podem acompanhar o pacote de build.

Valores usados no primeiro Preview:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
DND_LEGACY_ORIGIN
DND_LEGACY_EDIT_ORIGIN
```

Neste caso:

- URL do Supabase é pública;
- publishable key é pública por definição;
- origins legadas são hostnames de infraestrutura, não credenciais.

É proibido transportar dessa forma:

- service role;
- senha do banco;
- Discord bot token;
- OpenAI secret;
- R2 secret;
- cron secret;
- qualquer credential operacional.

Se uma feature futura exigir segredo no projeto Next antes do cutover, o gerenciamento nativo de env da Vercel passa a ser pré-requisito.

### 4. O domínio principal continua intocado

Este ADR não autoriza mover:

```txt
dnd.faysk.dev
```

O hostname principal continua no projeto legado até a Fase 13.

### 5. Git Integration continua desejável, não bloqueadora

Ligar `dnd-scribe-web-next` ao GitHub com `Root Directory = apps/web` continua sendo a topologia operacional preferida porque fornece Preview automático por PR e env management normal.

Porém, a ausência desse vínculo não bloqueia:

- bootstrap;
- build real da aplicação;
- validação de framework;
- homologação por release candidate;
- inspeção de logs;
- testes manuais em deployment identificado.

Ela permanece como melhoria de operação enquanto o candidato puder ser reproduzido por SHA.

## Evidência da execução

Primeira tentativa de deploy falhou durante `npm install` por conflito de peer dependency entre `@supabase/ssr@0.12.5` e a versão pinada de `@supabase/supabase-js`.

O deploy MCP, por não receber o `pnpm-lock.yaml` do monorepo, havia selecionado npm. O bootstrap foi repetido com resolução equivalente ao comportamento já validado pelo lockfile do projeto, sem alterar o código-fonte da aplicação.

Deployment válido:

```txt
Deployment ID: dpl_Ha9etK6sk3e96qmqVxJTCmz6fLoQ
URL: https://dnd-scribe-web-next-q2fsoielw-dndscribe.vercel.app
State: READY
Framework: Next.js 16.3.3
Source commit: bf7ce242d083825cc65ee03354b3c638c95e87f0
Region: iad1
```

O build confirmou as rotas modernas:

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

## Limite operacional observado

Após atingir o limite diário do plano Hobby para deployments via API, uma tentativa adicional de promover um deployment estável recebeu HTTP 402 com:

```txt
api-deployments-free-per-day
remaining: 0
reset: 2026-09-05T21:12:30.716Z
```

Isso é limitação operacional da API, não falha do app.

Portanto:

- não gerar deploys MCP desnecessários;
- preferir um release candidate identificado;
- reutilizar deployments READY para inspeção;
- quando Git Integration estiver disponível, preferi-la para fluxo normal de PRs.

## Relação com ADR 009

ADR 009 continua válido quanto ao requisito central:

> o novo app Next deve usar um segundo projeto Vercel e não ampliar o blast radius do projeto legado.

Este ADR relaxa somente o mecanismo de publicação durante a modernização:

```txt
Git Integration + Root Directory
OU
MCP deploy reproduzível por commit SHA
```

## Gate

O mecanismo MCP é aceitável quando:

```txt
projeto separado ✅
framework Next ✅
commit imutável verificado ✅
sem segredo no payload ✅
build READY ✅
dnd.faysk.dev intocado ✅
deployment identificado ✅
rollback = continuar no legado ✅
```
