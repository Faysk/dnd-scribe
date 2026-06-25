# 22 — Env e Serviços

## Estado atual

`.env.local` está organizado e ignorado pelo Git.

Backups locais também estão ignorados:

```txt
.env.local.raw
.env.local.pre-normalize
.env.local.before-r2-restore
.env.local.before-pooler-normalize
.env.local.backup-*
```

## OpenAI

Configurado:

```txt
OPENAI_API_KEY
OPENAI_TRANSCRIPTION_MODEL
OPENAI_TEXT_MODEL
```

Teste feito:

```txt
OpenAI transcription: 200
```

## Supabase

Configurado:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_PUBLISHABLE_KEY
SUPABASE_PROJECT_REF
SUPABASE_JWKS_URL
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_PASSWORD
DATABASE_URL
DATABASE_POOLER_URL
SUPABASE_POOLER_URL
DATABASE_DIRECT_URL
```

`SUPABASE_SERVICE_ROLE_KEY` foi configurada como alias da `SUPABASE_SECRET_KEY` para compatibilidade com tooling/server-side.

Testes feitos:

```txt
Supabase REST com service/secret key: 200
Supabase JWKS URL: 200
Supabase Pooler psql: ok
```

`DATABASE_URL` agora aponta para o Pooler/Supavisor. `DATABASE_DIRECT_URL` mantém o host direto separado.

## Cloudflare R2

Configurado:

```txt
R2_ACCOUNT_ID
R2_ENDPOINT
R2_S3_ENDPOINT
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
CLOUDFLARE_API_TOKEN
CLOUDFLARE_R2_ACCOUNT_TOKEN
```

Bucket definido em `R2_BUCKET` foi confirmado/criado. A tentativa de criação retornou o código Cloudflare `10004`, indicando que o bucket já existia e pertence à conta.

Healthcheck atual:

```txt
cloudflare_api=200 bucket_present=True
s3_put=200 s3_head=200 s3_delete=204
```

Script reutilizável:

```bash
python3 tools/check_r2.py
```

## Observação de segurança

Não imprimir `.env.local` inteiro no terminal/chat. Usar scripts de checagem mascarada quando precisar validar presença de variáveis.
