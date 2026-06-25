# 38 — Resultado: Deploy Vercel Operador

## Objetivo

Publicar o front real na Vercel com API serverless protegida por token de operador, sem expor segredos no navegador.

URL de producao:

```txt
https://dnd-scribe-amber.vercel.app
```

## Decisoes tomadas

- O app publicado usa `web/` como fonte da interface.
- O build copia `web/` para `public/` com `npm run build`.
- `public/` e gerado, ignorado pelo Git.
- A API da Vercel fica em `api/[...path].js`.
- Rotas privadas exigem `DND_OPERATOR_TOKEN`.
- `GET /api/health` fica aberto para smoke check.
- O front pede o token no navegador quando recebe `401`.

## Arquivos criados/alterados

- `api/[...path].js`
- `scripts/sync-public.js`
- `package.json`
- `package-lock.json`
- `vercel.json`
- `.vercelignore`
- `.gitignore`
- `.env.example`
- `web/app.js`

## Env organizado

O `.env.local` foi normalizado com:

```txt
VERCEL_TOKEN
VERCEL_PROJECT_ID
VERCEL_ORG_ID
DND_OPERATOR_TOKEN
```

O bloco cru colado do painel da Vercel foi removido do `.env.local` depois de extrair os valores necessarios.

Backup criado:

```txt
.env.local.backup-20260626-001056-before-vercel-normalize
```

## Comandos usados

Checks:

```bash
npm run check:web
npm run check:api
npm run build
```

Build/deploy usado:

```bash
vercel build --prod --yes
vercel deploy --prebuilt --prod --yes
```

Observacao operacional:

- gerar o prebuilt em `/tmp/dnd-vercel-src`;
- no drive montado `/mnt/d`, alguns arquivos de `node_modules` e `.vercel/output` ficaram truncados/corrompidos;
- em `/tmp`, o build saiu integro.

## Validacao

Deploy:

```txt
alias=https://dnd-scribe-amber.vercel.app
```

Smoke publico:

```txt
page 200
health 200
sessions sem token 401
sessions com token 200, sessoes=1
session com token 200, segmentos=41, decisoes_salvas=2
```

## Como acessar

1. Abrir `https://dnd-scribe-amber.vercel.app`.
2. Quando o app pedir, colar o valor de `DND_OPERATOR_TOKEN` do `.env.local`.
3. O token fica salvo apenas no navegador local em `localStorage`.

## Riscos e residuos

- Isto ainda nao substitui Auth/RLS.
- `DND_OPERATOR_TOKEN` e uma trava operacional temporaria para ambiente de operador.
- A etapa Auth/RLS continua sendo necessaria antes de abrir acesso para jogadores.
- Deploy normal por source falhou com `public` vazio; por enquanto usar prebuilt gerado em `/tmp`.

## Proximo passo recomendado

Etapa 12 continua sendo Auth/RLS:

- Supabase Auth com Google;
- policies por campanha/role;
- DM com acesso completo;
- jogadores vendo apenas o permitido;
- remover dependencia de token compartilhado para uso cotidiano.
