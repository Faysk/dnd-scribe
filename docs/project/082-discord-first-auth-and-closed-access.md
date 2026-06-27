# Etapa 082 - Discord-first auth and closed access

Data: 2026-06-27

## Entrega

O modo aberto foi removido do fluxo principal de producao.

Agora:

- `Discord` e o login principal no front;
- `Google` permanece como alternativa;
- endpoints de dados da campanha exigem login Supabase e perfil aprovado na campanha;
- endpoints operacionais/escrita exigem `owner` ou `master`;
- login Discord tenta auto-vincular `profiles.auth_user_id` quando `profiles.discord_id` ja esta mapeado;
- a aba `Acesso` preenche Discord ID/handle quando o provedor devolve esses dados;
- usuarios logados mas ainda nao aprovados veem tela de acesso pendente, nao dados da campanha.

## Permissoes de API

Publico:

- `GET /api/health`
- `GET /api/auth-config`
- `GET /api/auth/me` retorna estado de login, sem abrir dados da campanha.

Membro aprovado (`owner`, `master`, `reviewer`, `player`, `viewer`):

- `GET /api/sessions`
- `GET /api/session`
- `GET /api/jobs`
- `GET /api/craig-map`
- `GET /api/review-template`
- `GET /api/audio-url`

Owner/DM (`owner`, `master`):

- `POST /api/uploads/craig-url`
- `POST /api/uploads/craig-complete`
- `POST /api/sessions/create`
- `POST /api/sessions/update`
- `POST /api/review-decisions/apply`
- `POST /api/publications/rebuild`

## Banco

Aplicado no Supabase:

- `access_directory(text)` agora limita dados para login autenticado sem role aprovada;
- Discord ID/handle de outros perfis nao sao expostos para usuario ainda nao aprovado;
- `anon` segue sem `EXECUTE` no RPC.

Arquivo registrado:

- `schemas/20260627_016_tighten_access_directory_visibility.sql`

## Verificacao

Checks:

```bash
npm run check:web
npm run check:api
npm run check:workers
```

Banco:

```txt
anon access_directory EXECUTE=false
authenticated access_directory EXECUTE=true
usuario autenticado sem role: discordId oculto
membro aprovado: role preservada
```

## Env local

`.env.local` foi reorganizado para nomes oficiais:

- `DISCORD_CLIENT_ID`
- `DISCORD_APPLICATION_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`

Ainda faltam valores para `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN` e `DISCORD_GUILD_ID` para validar Interactions e registrar slash commands.
