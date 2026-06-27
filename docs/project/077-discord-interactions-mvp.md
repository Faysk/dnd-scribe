# Etapa 077 — Discord Interactions MVP

Data: 2026-06-27

## Entrega

Primeira integracao funcional do Discord sem Gateway e sem leitura passiva do chat.

Arquivos adicionados/alterados:

- `lib/discord-interactions.js`
- `scripts/register-discord-commands.js`
- `api/ai-cost.js` com roteamento interno para Discord
- `vercel.json` com rewrite de `/api/discord/interactions`

Banco Supabase:

- `discord_interactions`: auditoria das interacoes recebidas;
- `table_notes`: notas da mesa vindas do Discord, com RLS ligado.

## Endpoint

Production URL:

```txt
https://dnd.faysk.dev/api/discord/interactions
```

Usar essa URL no Discord Developer Portal em:

```txt
Application > General Information > Interactions Endpoint URL
```

Observacao de deploy: por causa do limite de 12 Serverless Functions no Vercel Hobby, a URL publica e reescrita internamente para `api/ai-cost.js?discordInteractions=1`. Isso evita criar uma 13a Function e nao muda a URL que o Discord usa.

O endpoint suporta:

- `GET /api/discord/interactions`: health check interno;
- `POST /api/discord/interactions`: payload assinado do Discord.

A assinatura Ed25519 e validada usando `DISCORD_PUBLIC_KEY`.

## Comandos implementados

### `/dnd status`

Mostra a sessao mais recente do DnD Scribe:

- status;
- data;
- segmentos;
- participantes;
- arquivos;
- publicacoes;
- jobs recentes.

Resposta efemera para nao poluir o canal.

### `/dnd nota`

Salva uma nota em `table_notes` para review do DM.

Opcoes:

- `texto` obrigatorio;
- `tipo`: `note`, `canon`, `npc`, `location`, `item`, `backstage`, `quote`, `question`;
- `visibilidade`: `dm_review`, `table_private`, `player_visible`, `public_candidate`;
- `sessao`: source id opcional da sessao.

Tambem envia webhook de aviso usando `lib/discord.js` quando o webhook estiver configurado.

### `/dnd vincular`

Mostra o Discord ID do usuario e instrui o fluxo atual:

1. Abrir o site.
2. Entrar com Google.
3. Ir para aba `Acesso`.
4. Informar Discord ID.
5. Aguardar aprovacao final do DM.

### Message context command: `Salvar no DnD Scribe`

Ao clicar com botao direito numa mensagem do Discord, salva o texto selecionado como nota para review do DM.

Esse caminho evita ler o canal inteiro passivamente e ainda captura o que nasceu no chat.

## Variaveis necessarias

Obrigatorias para Interactions:

```txt
DISCORD_PUBLIC_KEY=
DISCORD_APPLICATION_ID=
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
```

Recomendadas:

```txt
DND_SITE_URL=https://dnd.faysk.dev
DND_DEFAULT_CAMPAIGN_SLUG=yuhara-main
DND_DISCORD_WEBHOOK_URL=
DND_DISCORD_WEBHOOK_NAME=DnD Scribe
```

`DISCORD_PUBLIC_KEY` fica no Developer Portal em `Application > General Information > Public Key`.

`DISCORD_BOT_TOKEN` fica em `Bot > Token`. Nunca publicar esse token.

`DISCORD_GUILD_ID` e o ID do servidor da mesa. Ative Developer Mode no Discord, clique com botao direito no servidor e copie o ID.

## Registrar comandos

Depois de configurar as variaveis localmente ou na maquina com acesso aos secrets:

```bash
npm run discord:register
```

O script registra comandos de guild, que atualizam rapido para testes.

## Configuracao no Discord Developer Portal

1. Criar ou abrir a application do DnD Scribe.
2. Em `General Information`, copiar `Application ID` e `Public Key`.
3. Em `Bot`, criar bot e copiar token.
4. Em `OAuth2 > URL Generator`, marcar:
   - `bot`;
   - `applications.commands`.
5. Em bot permissions, por enquanto precisa apenas permissao basica para comandos/interacoes. Webhook ja e separado.
6. Convidar o app para o servidor da mesa.
7. Configurar `Interactions Endpoint URL` como `https://dnd.faysk.dev/api/discord/interactions`.
8. Rodar `npm run discord:register` com as envs.
9. Testar `/dnd status` no canal da mesa.
10. Testar `/dnd nota texto: ...`.

## Segurança e privacidade

Esta etapa nao usa Message Content Intent e nao le o chat inteiro.

A captura acontece somente quando alguem:

- usa slash command;
- usa comando de contexto em uma mensagem;
- interage com o bot.

Isso e intencional para manter consentimento claro e reduzir permissao do app.

## Proximas etapas

1. Criar tela no site para listar `table_notes` por sessao.
2. Permitir DM converter nota em canon, NPC, local, item ou bastidor.
3. Adicionar botoes do Discord em respostas: `Aprovar`, `Privado`, `Abrir no site`.
4. Adicionar modal para editar nota antes de salvar.
5. Implementar OAuth Discord no site e preencher `profiles.discord_id` automaticamente.
6. Integrar `/dnd vincular` com uma claim pre-preenchida.
7. Criar `/dnd sessao criar` e `/dnd sessao status` mais especificos.
8. Criar thread por sessao quando o DM iniciar a mesa.
9. Avaliar Voice State via Gateway em worker persistente para presenca.
10. Avaliar Message Content Intent somente se o fluxo explicito nao for suficiente.
