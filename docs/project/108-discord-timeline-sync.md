# Etapa 108 — Sincronizacao Discord na timeline

Data: 2026-06-28

## Objetivo

Trazer mensagens relevantes do Discord para a timeline da sessao sem custo de IA e sem depender de scripts locais.

## Decisao de arquitetura

O caminho escolhido foi usar o bot via REST em producao:

- endpoint do site: `POST /api/discord-sync-channel`;
- origem padrao: `DISCORD_DND_CHANNEL_ID`;
- limite por rodada: ate 100 mensagens;
- persistencia: `table_notes` com `source_system='discord'`;
- timeline: lane `Discord`, junto de falas e eventos Roll20.

Isso evita manter Gateway/WebSocket em serverless e reaproveita a tabela de notas que ja tem review, visibilidade, autor, origem e metadados.

## Custo

Nao ha chamada OpenAI nesta etapa.

O custo operacional e apenas:

- 1 chamada REST para buscar mensagens do Discord;
- inserts/upserts no Postgres;
- leitura normal da timeline.

O processamento de texto continua barato porque o sistema apenas guarda e mostra a mensagem. Se depois uma mensagem virar canon, NPC ou pista, ela entra no fluxo normal de review/IA somente quando o DM decidir.

## Permissoes

Sincronizar canal exige papel de campanha:

- `owner`;
- `master`;
- `reviewer`.

A leitura na timeline segue a mesma regra da tela de Notas:

- `owner`, `master` e `reviewer` veem tudo;
- jogadores veem somente notas deles ou notas com visibilidade `player_visible`/`public_candidate`.

## Sincronizacao temporal

Quando a sessao tem `started_at`, cada mensagem recebe:

- `metadata.timeline.startMs`;
- `metadata.timeline.timingMode='discord_timestamp_from_session_start'`.

Se a sessao ainda nao tem `started_at`, a mensagem fica preservada, mas aparece como evento sem tempo sincronizado ate termos uma ancora confiavel.

## Frontend

A aba Timeline ganhou:

- contador de eventos Discord;
- filtro `Discord`;
- controle para sincronizar as ultimas mensagens do canal;
- lane visual `Discord`;
- tabela de eventos externos separada da transcricao;
- inspector com conteudo e metadados basicos.

## Observacoes Discord

Para importar historico do canal, o bot precisa conseguir ler o canal e o historico. O conteudo completo das mensagens pode depender da configuracao/permissao de Message Content no app Discord. Por isso, os comandos slash/context menu continuam sendo o caminho mais confiavel para notas importantes.

Referencias oficiais:

- https://discord.com/developers/docs/resources/message#get-channel-messages
- https://discord.com/developers/docs/topics/gateway#message-content-intent

## Proximas etapas

1. Testar o bot em producao no canal real `1387538428903690290`.
2. Confirmar se o Discord retorna `content`; se vier vazio, habilitar/validar Message Content Intent ou priorizar context menu.
3. Adicionar campo visual para informar ancora manual de inicio quando `sessions.started_at` estiver vazio.
4. Exibir anexos/imagens Discord na timeline sem baixar/copiar conteudo.
5. Criar botao "converter em nota/canon" diretamente no inspector da timeline.
6. Criar endpoint de paginação por `before`/`after` para puxar blocos antigos.
7. Adicionar auditoria resumida no monitoramento: ultima sincronizacao, canal, mensagens aceitas, falhas.
8. Relacionar mensagens Discord com jogadores por `profiles.discord_id`.
9. Criar thread por sessao e salvar `thread_id` nos metadados da sessao.
10. Evoluir para worker Gateway somente se precisarmos de presenca/voice state em tempo real.
