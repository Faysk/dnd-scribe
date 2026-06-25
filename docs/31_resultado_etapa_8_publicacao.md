# 31 — Resultado da Etapa 8: Publicacao

## Objetivo

Criar o pipeline de publicacao sem quebrar a regra principal: nada vira canon ou material publico sem aprovacao humana.

## Entregas

- Migration:
  - `schemas/20260625_003_publication_extensions.sql`
- Gerador:
  - `tools/build_session_publications.py`
- Aba de UI:
  - `Publicacoes`
- Export do Review Board atualizado com publicacoes:
  - `tools/export_review_board_data.py`

## Comando

```bash
python3 tools/build_session_publications.py --update-db
```

Resultado:

```txt
publications=1
review_only=1
approved_publications=0
```

## Publicacao gerada

```txt
publication_type=master_notes
source_publication_id=ai_review_packet
visibility=review_only
status=draft
```

Arquivo local:

```txt
tmp/sessions/craig-AdabEqbzngmT-stage1-full/publications/classify_candidates_v2_gpt-4o/ai_review_packet.md
```

Manifest:

```txt
tmp/sessions/craig-AdabEqbzngmT-stage1-full/publications/classify_candidates_v2_gpt-4o/publication_manifest.json
```

## Trava de seguranca

Como ainda nao existem itens aprovados:

```txt
canon_approved=0
quote_approved=0
outtake_approved_all=0
```

O pipeline nao gerou:

- recap publico;
- recap completo final;
- mudanças de canon final;
- falas publicadas;
- bastidores publicos.

## UI

A aba `Publicacoes` mostra:

- pacote review-only;
- status draft;
- zero publicacoes finais;
- preview do pacote interno.

Smoke test:

```txt
title=Publicacoes
cards=1
reviewOnly=true
finalReady=true
contentPreview=true
console_errors=0
```

Mobile:

```txt
width=390
scrollWidth=390
overflow=false
cards=1
```

Screenshots locais:

```txt
tmp/publications-desktop.png
tmp/publications-mobile.png
```

## Proximo passo recomendado

Agora o ciclo tecnico principal existe:

```txt
Craig ZIP -> chunks -> transcricao -> timeline -> Supabase -> R2 -> Review Board -> IA -> pacote de publicacao review_only
```

O passo seguinte recomendado era fechar a persistencia da decisao humana:

- aprovar/rejeitar candidatos no Review Board;
- salvar em `review_decisions` e nas tabelas de candidatos;
- regenerar publicacoes finais a partir de itens aprovados.

Status: concluido na Etapa 9.

Referencia:

- `docs/32_resultado_etapa_9_decisoes_humanas.md`
