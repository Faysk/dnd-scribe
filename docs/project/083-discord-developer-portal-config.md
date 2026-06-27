# Etapa 083 - Discord Developer Portal config

Data: 2026-06-27

## Entrega

Configuracao inicial do aplicativo Discord alinhada com producao.

Valores publicos recebidos do Developer Portal:

- Application ID configurado em `.env.local` e Vercel Production como `DISCORD_APPLICATION_ID` / `DISCORD_CLIENT_ID`.
- Public Key configurada em `.env.local` e Vercel Production como `DISCORD_PUBLIC_KEY`.
- Interactions Endpoint URL: `https://dnd.faysk.dev/api/discord/interactions`.

## URLs publicas configuradas no Discord

Foram adicionadas paginas estaticas para evitar 404:

- `/terms`
- `/privacy`
- `/linked-role`

Arquivos:

- `web/terms.html`
- `web/privacy.html`
- `web/linked-role.html`
- `vercel.json` com rewrites limpos para essas rotas.

## Verificacao local

```bash
npm run check:web
npm run check:api
npm run check:workers
npm run build
```

## Pendente

Ainda faltam valores locais para registrar comandos no servidor:

- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`

Depois desses dois, rodar:

```bash
npm run discord:register
```

Tambem sera necessario testar o Developer Portal salvando novamente a Interactions Endpoint URL depois do deploy com `DISCORD_PUBLIC_KEY` em producao.
