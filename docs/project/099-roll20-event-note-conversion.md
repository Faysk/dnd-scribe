# 099 - Roll20 event to table note conversion

## Objetivo

Permitir que DM/Owner/Reviewer transforme um evento Roll20 persistido em nota revisavel da mesa, sem aprovar canon automaticamente e sem custo de IA.

## Implementado

- Novo endpoint curto: `POST /api/roll20-event-note`.
- O endpoint exige login aprovado e role `owner`, `master` ou `reviewer`.
- O endpoint busca o evento em `roll20_events` dentro da campanha atual.
- A conversao grava/upserta em `table_notes` com `source_system='roll20'` e `source_id='roll20-note:<event_id>'`.
- Defaults conservadores:
  - `canon_candidate` -> nota tipo `canon`, visibilidade `dm_review`;
  - `dm_backstage_note` -> nota tipo `backstage`, visibilidade `dm_review`;
  - `character_action_candidate` -> nota tipo `note`, visibilidade `table_private`.
- Cards da aba Roll20 agora tem acao `Criar nota` e `Copiar ID`.
- Depois de criar nota, o app recarrega a sessao e invalida a aba Notas.

## Validacao feita

- `npm run check:web`
- `npm run check:api`
- `npm run build`
- Transacao real no Postgres com rollback validou `roll20_events -> table_notes` sem persistir dados.

## Custo

- OpenAI: USD 0.
- Apenas queries Supabase e invocacao curta Vercel.

## Proximas 10 etapas

1. Publicar em producao e confirmar deploy `READY`.
2. Confirmar que `/app.js` contem `convertRoll20EventToNote`.
3. Confirmar que rota sem login retorna `401`.
4. Depois do primeiro evento real, clicar `Criar nota` como DM.
5. Confirmar que a nota aparece na aba `Notas`.
6. Adicionar acao especifica `Converter em canon candidate` quando a nota for canon.
7. Adicionar acao especifica `Converter em bastidor DM`.
8. Mostrar no card se o evento Roll20 ja tem nota criada.
9. Adicionar filtro na aba Notas para `sourceSystem=roll20`.
10. Criar smoke autenticado com rollback para endpoint de conversao.
