# 24 — Resultado da Etapa 1: Ingestao Craig

## Status

Concluida com ZIP real do Craig.

## Comando executado

```bash
python3 tools/ingest_craig_session.py audio/craig-AdabEqbzngmT-lbYiTJMUk5ScJGyv2x-5bSv0W566uc.flac.zip --session-id craig-AdabEqbzngmT-stage1-full --chunk-seconds 600
```

## Saida

```txt
tmp/sessions/craig-AdabEqbzngmT-stage1-full/
  raw/
  chunks/
  manifest.json
  participants.json
```

## Resultado

```txt
tracks=5
participants=5
chunks=50
chunk_seconds=600
session_size=1006M
```

## Participantes mapeados

```txt
sunnrq        -> Fernanda -> Screacky
renanyuhara   -> Yuhara   -> DM
faysk         -> Renan    -> Dandelion
arutorux      -> Arthur   -> Astel
thomaz_17590  -> Random   -> Convidado / indefinido
```

## Validacao

Cada faixa foi convertida para chunks WAV mono 16 kHz.

```txt
sunnrq        chunks=10  chunked_min=92.00  needs_review=False
renanyuhara   chunks=10  chunked_min=91.98  needs_review=False
faysk         chunks=10  chunked_min=91.94  needs_review=False
arutorux      chunks=10  chunked_min=91.91  needs_review=False
thomaz_17590  chunks=10  chunked_min=92.00  needs_review=True
```

## Arquivos importantes

```txt
tmp/sessions/craig-AdabEqbzngmT-stage1-full/manifest.json
tmp/sessions/craig-AdabEqbzngmT-stage1-full/participants.json
```

## Observacao

O convidado `thomaz_17590` foi preservado como faixa valida, mas marcado para revisao humana.

Isso confirma a regra do projeto:

```txt
faixa desconhecida entra como guest_or_unknown
nao bloquear pipeline
revisar depois
```

## Proxima etapa

Etapa 2: transcricao real por faixa.

Objetivo imediato:

```txt
transcrever chunks
salvar JSON por chunk
preservar track/person/personagem/source/start/end
permitir retomada se uma chamada falhar
```
