# Etapa 079 - Access/Discord RPC hardening

Data: 2026-06-27

## Entrega

A superficie publica dos fluxos de acesso da mesa e notas Discord foi reduzida.

Antes, os RPCs abaixo estavam executaveis por `anon`/`PUBLIC`, e as tabelas tinham grants diretos herdados para `anon`/`authenticated`:

- `access_directory(text)`
- `submit_profile_claim(...)`
- `review_profile_claim(...)`
- `table_notes_directory(text, text)`
- `review_table_note(...)`
- `profile_claims`
- `table_notes`
- `discord_interactions`

Agora:

- `anon` nao executa esses RPCs;
- `authenticated` e `service_role` executam os RPCs;
- as tabelas nao ficam acessiveis direto via Data API;
- o acesso passa pelos RPCs com checagem de login/campanha/role.

Arquivo registrado:

- `schemas/20260627_014_harden_access_discord_grants.sql`

## Verificacao

Checks locais:

```bash
npm run check:web
npm run check:api
npm run check:workers
```

Verificacao no banco:

- `anon` sem `EXECUTE` em `access_directory(text)`;
- `authenticated` com `EXECUTE` em `access_directory(text)`;
- `anon` sem `SELECT` em `table_notes`;
- `authenticated` sem acesso direto a `table_notes`, `profile_claims` e `discord_interactions`.

Smoke HTTP sem login:

```txt
POST /rest/v1/rpc/access_directory -> 401 permission denied for function access_directory
```

## Observacao

As funcoes continuam `SECURITY DEFINER`, mas agora nao estao expostas para chamada anonima. Como elas consultam `auth.uid()` e roles da campanha, o caminho de uso esperado e:

1. Usuario entra com Google.
2. Browser chama RPC como `authenticated`.
3. RPC valida perfil/campanha/role.
4. Tabelas internas permanecem sem Data API direta.

## Proximos passos

1. Adicionar `DISCORD_PUBLIC_KEY` na Vercel.
2. Validar Interactions Endpoint URL no Discord Developer Portal.
3. Registrar comandos com `npm run discord:register`.
4. Testar `/dnd status`, `/dnd nota` e `Salvar no DnD Scribe`.
5. Depois dos testes reais, avaliar OAuth Discord para preencher `profiles.discord_id` automaticamente.
