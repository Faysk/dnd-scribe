# Etapa 076 — Oportunidades de integracao com Discord

Data: 2026-06-27

## Contexto

A mesa usa um canal de Discord onde so entra quem vai jogar, alem de Roll20 e Craig. Como muita coisa importante nasce no chat do Discord e no Roll20, o Discord pode virar um ponto oficial de captura, identidade, agenda e operacao da mesa.

O projeto ja tem `lib/discord.js` para enviar notificacoes por webhook. Esta etapa mapeia como evoluir isso sem pedir permissao demais cedo demais.

## Principio de projeto

Comecar por interacoes explicitas:

- slash commands;
- botoes;
- modais;
- comandos de contexto em mensagens;
- OAuth para vincular Discord ao perfil da mesa;
- webhooks para notificacoes.

Evitar, no primeiro momento, um bot lendo passivamente todo o chat. Isso exigiria Message Content Intent para acesso completo a conteudo, embeds, anexos, componentes e polls em mensagens recebidas. A documentacao do Discord recomenda avaliar se o app realmente precisa de intents privilegiadas e usar alternativas como slash commands, message context commands, componentes e modais quando possivel.

## O que podemos usar no Discord

### 1. Webhooks de notificacao

Ja existe base no projeto. Podemos melhorar para avisar no canal da mesa:

- upload Craig recebido;
- job de ingestao criado;
- transcricao pronta;
- custo estimado antes de IA paga;
- review pronto para DM;
- publicacao de recap aprovada;
- falha de worker ou API.

Baixo risco, baixo custo, nenhuma permissao de bot alem do webhook que ja existe.

### 2. Slash commands

Criar comandos de mesa, por exemplo:

- `/dnd sessao iniciar` — cria/abre sessao planejada;
- `/dnd sessao status` — mostra estado dos jobs;
- `/dnd nota` — salva nota timestampada como bastidor ou pista;
- `/dnd canon` — envia proposta para fila de canon;
- `/dnd npc` — cadastra nome/apelido citado no chat;
- `/dnd personagem` — jogador declara ou atualiza personagem;
- `/dnd vincular` — inicia fluxo de vinculo Discord + perfil;
- `/dnd recap` — mostra recap aprovado;
- `/dnd custos` — mostra estimativa de custo da sessao.

Para testar rapido, usar comandos de guild, porque atualizam imediatamente no servidor. Comandos globais fazem sentido depois.

### 3. Message context commands

Isso e particularmente bom para a nossa mesa: o jogador ou DM clica com botao direito numa mensagem do Discord e escolhe uma acao.

Possiveis acoes:

- `Salvar como nota da sessao`;
- `Propor canon`;
- `Marcar como bastidor`;
- `Criar NPC/local/item`;
- `Enviar para review do DM`;
- `Vincular fala ao personagem`.

Vantagem: o bot recebe a mensagem especifica escolhida, sem precisar ler o canal inteiro passivamente.

### 4. Botoes e modais

Depois de uma nota ou proposta, o bot pode responder com botoes:

- Aprovar;
- Rejeitar;
- Marcar privado;
- Pedir contexto;
- Vincular personagem;
- Abrir no site.

Modais servem para texto livre:

- descricao de canon;
- nota privada para DM;
- personagem falante;
- nome real / nick / Discord handle;
- comentario de review.

### 5. OAuth e vinculo de conta

O fluxo ideal fica:

1. Usuario entra no site com Google.
2. Usuario clica para vincular Discord.
3. Discord OAuth retorna `discord_user_id`, username/avatar e dados permitidos.
4. O site compara com o perfil da mesa ou cria claim.
5. DM aprova o vinculo final.

Escopos uteis:

- `identify`: obter ID e nome basico do usuario;
- `email`: opcional, se quisermos comparar email;
- `guilds.members.read`: confirmar membro no servidor da mesa;
- `role_connections.write`: futuro, para Linked Roles;
- `applications.commands`: instalar comandos;
- `bot`: se usarmos bot com Gateway/REST;
- `webhook.incoming`: gerar webhook via OAuth, caso um dia queiramos install self-service.

### 6. Linked Roles

Futuro interessante: o site vira fonte de verdade para papeis como `DM`, `Player`, `Guest`, `Reviewer`, `Dandelion`, `Astel`, etc. O Discord pode refletir alguns metadados via Linked Roles.

Nao e prioridade para MVP, mas combina muito bem com a hierarquia que ja estamos criando.

### 7. Guild Scheduled Events

Podemos usar eventos agendados para sessoes:

- criar evento da proxima sessao no Discord;
- sincronizar data/hora com `sessions` no Supabase;
- avisar quem confirmou interesse;
- marcar evento como iniciado/finalizado;
- guardar link da sessao no DnD Scribe.

Isso ajuda a transformar o site em historico organizado e o Discord em lembrete vivo da mesa.

### 8. Chat capture controlado

Caminho recomendado:

- Fase 1: capturar so conteudo enviado por slash command, modal, botao ou comando de contexto.
- Fase 2: capturar mensagens que mencionam o bot, por exemplo `@DnD Scribe canon: ...`.
- Fase 3: se realmente fizer sentido, pedir Message Content Intent para ler canal inteiro.

A fase 3 deve ser decisao consciente: aumenta privacidade, compliance e responsabilidade de armazenamento.

### 9. Voice state e presenca de mesa

O Discord permite saber quando alguem entra/sai/muda de canal de voz via Gateway Voice State Update. Isso pode ajudar a:

- detectar inicio/fim aproximado da sessao;
- listar quem estava presente;
- cruzar presenca com Craig;
- lembrar DM de iniciar Craig.

Isso nao substitui Craig e nao grava audio por si so. Para audio de qualidade, Craig continua sendo o caminho certo.

### 10. Threads por sessao

Podemos criar ou organizar uma thread por sessao:

- `sessao-2026-06-27`;
- notas durante a partida;
- links de recap;
- propostas de canon;
- bastidores.

Depois o site consome/organiza o que foi explicitamente salvo.

## Arquitetura recomendada

### MVP Discord 1 — sem Gateway

Usar apenas HTTP/Webhooks/Interactions:

- endpoint Vercel: `/api/discord/interactions`;
- validar assinatura Ed25519 do Discord;
- responder PING;
- registrar comandos de guild;
- persistir eventos no Supabase;
- postar respostas efemeras ou no canal.

Isso evita manter WebSocket vivo e combina melhor com Vercel Functions.

### MVP Discord 2 — bot com Gateway opcional

Adicionar bot processando eventos em worker separado somente se precisarmos de:

- detectar entrada/saida no canal de voz em tempo real;
- ouvir mensagens mencionando o bot;
- acompanhar reacoes;
- sincronizar thread/channel events.

Gateway nao deve rodar em Serverless comum da Vercel. Melhor usar worker separado, Fly.io, Railway, Render, VPS ou outro processo persistente.

## Dados novos sugeridos

Tabelas futuras:

- `discord_accounts`: perfil, discord user id, username, avatar, scopes, linked_at;
- `discord_guilds`: servidor da mesa, nome, config;
- `discord_channels`: canal DnD, canal logs, canal ops;
- `discord_events`: interacoes brutas auditaveis;
- `table_notes`: notas vindas de Discord/Roll20/site;
- `session_discord_threads`: relacao sessao/thread/canal;
- `discord_command_audit`: quem executou comando e resultado.

Extensoes em tabelas existentes:

- `profiles.discord_id` ja existe;
- `profiles.discord_handle` ja foi adicionado;
- `profile_claims` pode receber origem `discord_interaction` no futuro.

## Variaveis de ambiente esperadas

- `DISCORD_APPLICATION_ID`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_GUILD_ID`
- `DISCORD_DND_CHANNEL_ID`
- `DISCORD_OPS_CHANNEL_ID`
- `DND_DISCORD_WEBHOOK_URL` ou `DISCORD_WEBHOOK_URL`

## Ordem recomendada

1. Melhorar mensagens do webhook atual para status de sessao/job/custo.
2. Criar endpoint `/api/discord/interactions` com validacao de assinatura e resposta PING.
3. Criar script de registro de comandos de guild.
4. Implementar `/dnd status` e `/dnd nota`.
5. Persistir notas no Supabase como fonte `discord`.
6. Implementar message context command `Salvar no DnD Scribe`.
7. Implementar modal para classificar mensagem como nota, canon, NPC, local ou bastidor.
8. Integrar `/dnd vincular` com o fluxo de claims ja criado.
9. Adicionar OAuth Discord no site para vinculo de conta completo.
10. Avaliar Gateway somente para voice state e mencoes ao bot, sem pedir Message Content Intent inicialmente.

## Decisao atual

Seguir primeiro com Interactions + Webhooks + OAuth. Isso entrega valor rapido, nao tem custo relevante, evita intents privilegiadas e respeita privacidade da mesa.
