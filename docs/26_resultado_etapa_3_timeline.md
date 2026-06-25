# 26 — Resultado da Etapa 3: Merge de Timeline

## Status

Concluida com a sessao real transcrita na Etapa 2.

## Entrada

```txt
tmp/sessions/craig-AdabEqbzngmT-stage1-full/manifest.json
tmp/sessions/craig-AdabEqbzngmT-stage1-full/transcripts/segments.json
```

## Script

```txt
tools/build_transcript_master.py
```

## Comando

```bash
python3 tools/build_transcript_master.py tmp/sessions/craig-AdabEqbzngmT-stage1-full
```

## Saida

```txt
tmp/sessions/craig-AdabEqbzngmT-stage1-full/transcripts/transcript_master.json
tmp/sessions/craig-AdabEqbzngmT-stage1-full/transcripts/transcript_master.md
```

## Resultado geral

```txt
segments_total=50
segments_exported=41
segments_empty=9
duration=01:32:00
```

Por padrao, chunks vazios nao entram em `transcript_master.json`, mas continuam contabilizados no resumo.

## Validacoes

```txt
ordered=True
unique_ids=True
sequential_ids=True
```

## Resultado por faixa

```txt
arutorux       total=10 with_text=10 empty=0 words=3154 status=known
faysk          total=10 with_text=10 empty=0 words=147  status=known
renanyuhara    total=10 with_text=10 empty=0 words=1680 status=known
sunnrq         total=10 with_text=10 empty=0 words=1706 status=known
thomaz_17590   total=10 with_text=1  empty=9 words=4    status=guest_or_unknown
```

## Campos principais do master

Cada segmento exportado preserva:

```txt
id
source_sequence
timeline_start_ms
timeline_end_ms
timeline_start
timeline_end
track_key
speaker_name
speaker_role
participant_status
default_character
character_name
character_needs_review
source_file
source_chunk
source_chunk_path
response_path
text
review_status
tags
```

## Observacoes

- `character_name` começa como o personagem padrao da faixa.
- A revisao futura pode corrigir personagem por segmento.
- `source_sequence` preserva a posicao original antes de remover segmentos vazios.
- O convidado/desconhecido permanece como `guest_or_unknown`.

## Proxima etapa

Etapa 4: persistencia Supabase.

Objetivo:

```txt
criar schema MVP
salvar sessao
salvar participantes
salvar manifest/transcript master
salvar segmentos
validar leitura basica via banco
```
