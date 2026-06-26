# 39 — Resultado da Etapa 12: Login Google em Modo Aberto

## Objetivo

Adicionar login Google via Supabase Auth sem fechar a API ainda, mantendo o ambiente aberto para teste como decidido.

## Decisoes tomadas

- Login Google fica visivel no painel lateral do app.
- A API continua aberta temporariamente.
- O front mostra claramente `API aberta` para nao confundir teste com seguranca final.
- O segredo do Google nao vai para o navegador.
- O front busca apenas config publica em `/api/auth-config`:
  - Supabase URL;
  - publishable/anon key;
  - modo `open_test`.

## Env organizado

O bloco cru do Google no `.env.local` foi normalizado para:

```txt
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
```

Backup criado:

```txt
.env.local.backup-20260626-011948-before-google-normalize
```

## Arquivos alterados

- `.env.example`
- `api/[...path].js`
- `schemas/20260626_005_auth_profiles_extensions.sql`
- `tools/apply_supabase_schema.py`
- `tools/serve_frontend.py`
- `web/index.html`
- `web/app.js`
- `web/styles.css`

## Validacao

Checks locais:

```bash
npm run check:web
npm run check:api
python3 -m py_compile tools/serve_frontend.py
npm run build
```

API local:

```txt
/api/auth-config -> 200, supabaseUrl=true, publishableKey=true, mode=open_test
/api/sessions -> 200, sessoes=1
```

Migration Auth/profile aplicada:

```txt
profiles.auth_user_id=true
profiles.email=true
app.current_profile_id=true
app.is_campaign_member=true
app.is_campaign_dm=true
auth.users=0
```

OAuth Google/Supabase:

```txt
/auth/v1/authorize?provider=google&redirect_to=https://dnd.faysk.dev
status=302
redirect_para_google=true
```

## Como testar

1. Abrir `https://dnd.faysk.dev`.
2. Clicar em `Entrar Google`.
3. Voltar ao app e conferir se o painel lateral mostra o usuario Google.

## Riscos e residuos

- A API segue aberta nesta fase.
- Login ainda nao restringe leitura/escrita.
- Falta alguem fazer o primeiro login para existir registro em `auth.users`.
- Depois do primeiro login, mapear `auth.users` para `profiles`/`campaign_members`.
- Falta aplicar RLS e policies por role.

## Proximo passo recomendado

Fechar a Etapa 12 de verdade:

- adicionar `auth_user_id`/email em `profiles`;
- criar funcoes SQL `current_profile_id`, `is_campaign_member`, `is_campaign_dm`;
- habilitar RLS com policies iniciais;
- exigir JWT nas rotas sensiveis;
- manter DM com acesso completo.
