# 38 — Resultado: Deploy Vercel Operador

## Objetivo

Publicar o front real na Vercel com API serverless. Para a fase atual de teste, as rotas da API ficam abertas.

URL de producao:

```txt
https://dnd.faysk.dev
https://dnd-scribe-amber.vercel.app
```

## Decisoes tomadas

- O app publicado usa `web/` como fonte da interface.
- O build copia `web/` para `public/` com `npm run build`.
- `public/` e gerado, ignorado pelo Git.
- A API da Vercel fica em `api/[...path].js`.
- Rotas da API ficam abertas temporariamente para teste.
- Segredos de banco continuam apenas em variaveis de ambiente da Vercel, nunca no navegador.

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
sessions sem token 200, sessoes=1
session sem token 200, segmentos=41, decisoes_salvas=2
```

Dominios validados:

```txt
https://dnd.faysk.dev
https://dnd-scribe-amber.vercel.app
```

## Como acessar

1. Abrir `https://dnd.faysk.dev`.
2. Usar normalmente durante a fase de teste aberta.

## Riscos e residuos

- Isto ainda nao substitui Auth/RLS.
- As rotas estao abertas por decisao temporaria de teste.
- Qualquer pessoa com a URL pode ler dados e acionar operacoes expostas enquanto este modo estiver ativo.
- A etapa Auth/RLS continua sendo necessaria antes de abrir acesso para jogadores.
- Deploy normal por source falhou com `public` vazio; por enquanto usar prebuilt gerado em `/tmp`.

## Proximo passo recomendado

Etapa 12 continua sendo Auth/RLS:

- Supabase Auth com Google;
- policies por campanha/role;
- DM com acesso completo;
- jogadores vendo apenas o permitido;
- remover dependencia de token compartilhado para uso cotidiano.
