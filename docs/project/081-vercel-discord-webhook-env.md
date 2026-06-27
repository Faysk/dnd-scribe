# Etapa 081 - Vercel Discord webhook env

Data: 2026-06-27

## Entrega

O webhook do Discord que estava em `.env.local` foi sincronizado para Vercel Production usando variaveis server-side:

- `DND_DISCORD_WEBHOOK_URL`
- `DND_DISCORD_WEBHOOK_NAME`

Os valores nao foram impressos no terminal nem registrados no repositorio.

## Por que isso importa

O comando `/dnd nota` salva a nota no Supabase e, quando o webhook esta configurado, tambem avisa o canal da mesa em modo best effort. Se o Discord falhar, o fluxo principal nao quebra.

## Estado atual

Webhook de notificacao:

- Production env: configurado.
- Proximo deploy: necessario para a Function receber a env nova.

Interactions bot:

- `DISCORD_PUBLIC_KEY`: pendente na Vercel.
- `DISCORD_APPLICATION_ID`: pendente local/operacao.
- `DISCORD_BOT_TOKEN`: pendente local/operacao.
- `DISCORD_GUILD_ID`: pendente local/operacao.

Enquanto `DISCORD_PUBLIC_KEY` nao existir na Vercel, o health de `/api/discord/interactions` continuara mostrando `configured:false`, e o Discord Developer Portal nao conseguira validar o endpoint para POST assinado.
