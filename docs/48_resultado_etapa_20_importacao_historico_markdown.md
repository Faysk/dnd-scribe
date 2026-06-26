# 48 — Resultado da Etapa 20: Importacao de Historico Markdown

## Objetivo

Permitir importar arquivos Markdown antigos de forma conservadora, sem transformar conteudo historico em canon aprovado automaticamente.

## Decisoes tomadas

- Historico entra em tabela propria: `historical_documents`.
- Status inicial sempre e `historical_import`.
- Importador calcula `content_hash` para auditoria.
- Importacao e idempotente por `campaign_id + source_path`.
- O conteudo fica pesquisavel por índice full-text em portugues.
- Nada alimenta canon/publicacao sem revisao posterior.

## Arquivos alterados

- `schemas/20260626_007_historical_import.sql`
- `tools/apply_supabase_schema.py`
- `tools/import_markdown_history.py`
- `docs/23_plano_de_execucao_por_etapas.md`
- `docs/35_roadmap_proximas_10_etapas.md`
- `docs/48_resultado_etapa_20_importacao_historico_markdown.md`

## Migration aplicada

```txt
schemas/20260626_007_historical_import.sql
```

## Comandos principais

```bash
python3 tools/import_markdown_history.py caminho/do/historico --dry-run
python3 tools/import_markdown_history.py caminho/do/historico
```

## Validacao

```bash
python3 tools/apply_supabase_schema.py --schema schemas/20260626_007_historical_import.sql
python3 -m py_compile tools/import_markdown_history.py tools/apply_supabase_schema.py
python3 tools/import_markdown_history.py /tmp/dnd-history-sample --dry-run
```

Resultado:

```txt
migration=ok
documents=1
bytes=47
first=memoria.md
dry_run=ok
```

## Riscos e residuos

- Nao importei historico real porque ainda nao recebemos a pasta final de Markdown antigo.
- Falta tela de busca/revisao de documentos historicos.
- Falta vincular documentos a entidades/canon candidates.
- Falta relatorio de conflitos entre historico antigo e canon atual.

## Proximo passo recomendado

Criar entidades/canon consolidado e uma tela de memoria para revisar historico, candidatos e publicacoes aprovadas.
