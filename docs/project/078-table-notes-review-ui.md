# Etapa 078 — Tela de review de notas da mesa

Data: 2026-06-27

## Entrega

Criada a base para revisar no site as notas vindas do Discord.

## Banco

`table_notes` ganhou campos de review:

- `review_status`: `pending`, `approved`, `rejected`, `private`, `converted`;
- `reviewed_by`;
- `reviewed_at`;
- `review_note`.

Novas RPCs:

- `table_notes_directory(campaign_slug, source_session_id)`;
- `review_table_note(target_note_id, new_note_type, new_visibility, new_review_status, new_content, new_review_note, new_tags)`.

A leitura respeita papel da campanha:

- owner/master/reviewer veem e revisam tudo;
- player/viewer veem somente notas liberadas, publicas candidatas ou criadas por eles.

## Frontend

Arquivos adicionados:

- `web/notes.js`;
- `web/notes.css`.

`web/index.html` passou a carregar esses assets.

A aba `Notas` e injetada no menu principal sem alterar o app base. Ela permite:

- filtrar por status;
- filtrar por tipo;
- ver autor, sessao, origem e tags;
- editar conteudo;
- reclassificar tipo;
- alterar visibilidade;
- aprovar, rejeitar ou marcar como convertida.

## Observacoes

A tela depende de login Google e perfil vinculado na campanha. Isso e intencional, porque notas de Discord podem conter bastidor e contexto privado da mesa.

## Proximas etapas

1. Configurar `DISCORD_PUBLIC_KEY` na Vercel.
2. Configurar `DISCORD_APPLICATION_ID`, `DISCORD_BOT_TOKEN` e `DISCORD_GUILD_ID` localmente ou no ambiente de operacao.
3. Registrar comandos com `npm run discord:register`.
4. Testar `/dnd nota` no canal da mesa.
5. Confirmar se a nota aparece na aba `Notas`.
6. Adicionar botoes Discord para aprovar/rejeitar direto no canal, se ficar ergonomico.
7. Criar conversao de nota aprovada para canon/NPC/local/item estruturado.
8. Integrar `/dnd vincular` com claim pre-preenchida.
9. Adicionar OAuth Discord no site.
10. Criar threads por sessao quando o DM iniciar uma partida.
