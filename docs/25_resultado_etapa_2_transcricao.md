# 25 — Resultado da Etapa 2: Transcricao por Faixa

## Status

Concluida com a sessao real ingerida na Etapa 1.

## Entrada

```txt
tmp/sessions/craig-AdabEqbzngmT-stage1-full/manifest.json
tmp/sessions/craig-AdabEqbzngmT-stage1-full/chunks/
```

## Script

```txt
tools/transcribe_session_chunks.py
```

## Comando principal

```bash
python3 tools/transcribe_session_chunks.py tmp/sessions/craig-AdabEqbzngmT-stage1-full
```

O script suporta retomada:

```txt
chunks ja concluidos sao pulados
falhas ficam registradas no index
rodar novamente continua do estado atual
```

## Saida

```txt
tmp/sessions/craig-AdabEqbzngmT-stage1-full/transcripts/
  raw/
  segments.json
  transcription_index.json
  transcript_tracks.json
  track_summaries.json
```

## Resultado geral

```txt
chunks=50
succeeded=50
failed=0
raw_json_files=50
transcripts_size=184K
```

## Resultado por faixa

```txt
arutorux       chunks=10 empty=0 chars=16721 words=3154
faysk          chunks=10 empty=0 chars=798   words=147
renanyuhara    chunks=10 empty=0 chars=8696  words=1680
sunnrq         chunks=10 empty=0 chars=9049  words=1706
thomaz_17590   chunks=10 empty=9 chars=23    words=4
```

## Observacoes

- A faixa `thomaz_17590` parece majoritariamente silenciosa.
- A transcricao nao foi impressa no terminal para evitar expor conteudo da sessao.
- O texto completo esta salvo apenas em `tmp/`, que e ignorado pelo Git.
- A retomada foi validada: rodar novamente com chunks ja concluidos resultou em `skipped`.

## Proxima etapa

Etapa 3: merge de timeline.

Objetivo:

```txt
juntar segmentos por timestamp
preservar faixa/pessoa/personagem
criar transcript_master.json
preparar base para revisao e classificacao
```
