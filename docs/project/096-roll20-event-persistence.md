# 096 - Roll20 event persistence

## Objetivo

Permitir que o DM/Owner grave eventos Roll20 normalizados em producao, sem IA paga e sem abrir permissao para jogadores ou visitantes.

## Decisoes

- `dryRun` continua sendo o padrao seguro.
- Gravar eventos exige `dryRun:false`, login valido e role `owner` ou `master`.
- Gravar eventos tambem exige `sourceSessionId` explicito para evitar importar chat na sessao errada.
- O endpoint faz upsert em `roll20_events` usando `session_id + source_system + source_event_id`.
- Comandos invalidos sao ignorados na persistencia por padrao; podem ser incluidos depois com `includeInvalid:true` se precisarmos auditar erro de macro.
- Cada import gravado registra um `processing_jobs` com custo pago `0`.

## Implementado

- `api/[...path].js` agora persiste eventos Roll20 em `roll20_events` quando `dryRun:false`.
- `roll20SourceEventId` cria ids deterministicos por linha/comando para evitar duplicacao simples.
- `persistRoll20Events` resolve a sessao, grava os eventos e retorna resumo de ids persistidos.
- `web/roll20.html` ganhou o botao `Gravar eventos`.
- `web/roll20.js` separa `Validar API` de `Gravar eventos`, exige sessao explicita e confirma antes de escrever.

## Validacao feita

- `npm run check:web`
- `npm run check:api`
- Consulta somente leitura confirmou colunas e indices de `roll20_events` no Postgres de producao.
- Transacao de teste com rollback validou o SQL `INSERT ... ON CONFLICT` sem deixar dados gravados.
- Teste publico sem login em `POST /api/roll20-ingest` retornou `401 Login Discord ou Google obrigatorio.`

## Proximas 10 etapas

1. Testar `Gravar eventos` em producao com login do DM e um trecho pequeno real do Roll20.
2. Exibir eventos Roll20 persistidos em uma aba dedicada ou dentro do review da sessao.
3. Adicionar filtros por tipo: sessao, acao, canon, DM e audio.
4. Permitir converter evento `canon_candidate` em candidato de canon estruturado.
5. Permitir converter `dm_backstage_note` em nota privada de DM/publicacao interna.
6. Ligar `audio_processing_hint` a fila de processamento de audio/cortes.
7. Melhorar `source_event_id` com data/hora real quando tivermos export bruto melhor do Roll20.
8. Criar smoke test autenticado automatizado para dry-run e persistencia com rollback.
9. Adicionar auditoria visual: ator que importou, horario, origem e sessao.
10. Criar rotina de deduplicacao/merge caso um chat seja colado com linhas deslocadas.
