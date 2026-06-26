# 49 — Resultado da Etapa 21: Entidades e Canon Consolidado

## Objetivo

Preparar a memoria estruturada da campanha a partir de canon aprovado, sem promover candidatos automaticamente.

## Decisoes tomadas

- Canon consolidado fica em `canon_entries`.
- `canon_entries` aponta para `canon_candidates` aprovados.
- Entidade relacionada e criada/atualizada em `entities` quando houver entidade detectada.
- Apenas `canon_candidates.status='approved_canon'` entra no consolidator.
- Sem canon aprovado, o consolidator deve retornar zero.

## Arquivos alterados

- `schemas/20260626_008_canon_entries.sql`
- `tools/apply_supabase_schema.py`
- `tools/build_canon_entries.py`
- `docs/49_resultado_etapa_21_entidades_canon_consolidado.md`

## Comandos previstos

```bash
python3 tools/apply_supabase_schema.py --schema schemas/20260626_008_canon_entries.sql
python3 tools/build_canon_entries.py --dry-run
python3 tools/build_canon_entries.py
```

## Validacao local

```bash
python3 -m py_compile tools/build_canon_entries.py tools/apply_supabase_schema.py
npm run check:api
npm run check:web
```

Resultado:

```txt
py_compile=ok
check_api=ok
check_web=ok
```

## Bloqueio atual

A aplicacao remota de `schemas/20260626_008_canon_entries.sql` foi bloqueada pelo limite atual de comandos externos do Codex. Nao tentei contornar esse bloqueio.

## Riscos e residuos

- Migration ainda precisa ser aplicada no Supabase.
- Dry-run real do consolidator ainda precisa rodar apos liberar comandos externos.
- Ainda falta UI de memoria/entidades.
- Ainda falta lidar com retcon/superseded visualmente.

## Proximo passo recomendado

Quando comandos externos voltarem, aplicar a migration e rodar:

```bash
python3 tools/build_canon_entries.py --dry-run
```
