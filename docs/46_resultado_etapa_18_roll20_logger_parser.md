# 46 — Resultado da Etapa 18: Roll20 Logger e Parser

## Objetivo

Consolidar o fluxo `!dnd` do Roll20 para gerar eventos estruturados e importaveis no DnD Scribe.

## Decisoes tomadas

- O prefixo oficial segue sendo `!dnd`.
- O Mod Script escreve `[DND_EVENT] {json}` no chat do Roll20.
- O importador local le export HTML/texto e extrai eventos.
- Eventos Roll20 ganham `source_event_id` para importacao idempotente.
- O payload da sessao agora inclui `roll20Events`.
- O front mostra eventos Roll20 na aba `Operacao`.

## Arquivos alterados

- `examples/roll20/yuhara_logger_script.js`
- `tools/import_roll20_events.py`
- `tools/export_review_board_data.py`
- `api/[...path].js`
- `web/app.js`
- `schemas/20260626_006_roll20_event_extensions.sql`
- `tools/apply_supabase_schema.py`
- `docs/23_plano_de_execucao_por_etapas.md`
- `docs/35_roadmap_proximas_10_etapas.md`
- `docs/46_resultado_etapa_18_roll20_logger_parser.md`

## Migration aplicada

```txt
schemas/20260626_006_roll20_event_extensions.sql
```

Adiciona:

```txt
roll20_events.source_system
roll20_events.source_event_id
roll20_events.created_at_roll20
idx_roll20_events_session_source_id_unique
```

## Comandos principais

```bash
python3 tools/import_roll20_events.py roll20_export.txt --source-session-id craig-AdabEqbzngmT-stage1-full --dry-run
python3 tools/import_roll20_events.py roll20_export.txt --source-session-id craig-AdabEqbzngmT-stage1-full
```

## Validacao

```bash
python3 tools/apply_supabase_schema.py --schema schemas/20260626_006_roll20_event_extensions.sql
python3 -m py_compile tools/import_roll20_events.py tools/export_review_board_data.py tools/serve_frontend.py tools/apply_supabase_schema.py
npm run check:api
npm run check:web
python3 tools/import_roll20_events.py /tmp/roll20-events-sample.txt --source-session-id craig-AdabEqbzngmT-stage1-full --dry-run
npm run build
```

Resultado:

```txt
migration=ok
dry_run_events=2
first_event_type=scene
quote_character=Dandelion
build=ok
deploy_vercel=ok
app_js_tem_roll20_ui=true
api_session_tem_roll20Events=true
roll20Events_atual=0
```

## Riscos e residuos

- Ainda nao importei eventos fake no banco para nao poluir a campanha.
- Falta testar com export real do Roll20 apos uma sessao.
- Falta job local `parse_roll20` na fila.
- Alinhamento exato com audio ainda depende de marcador `!dnd sync`.

## Proximo passo recomendado

Adicionar upload do export Roll20 e job `parse_roll20`, depois criar alinhamento visual com segmentos/audio.
