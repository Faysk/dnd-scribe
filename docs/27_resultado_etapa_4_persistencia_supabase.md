# 27 — Resultado da Etapa 4: Persistencia Supabase

## Objetivo

Persistir a primeira sessao real processada no Supabase, mantendo rastreabilidade entre ZIP Craig, faixas, chunks, transcricoes e timeline master.

## Entregas

- Schema base aplicado a partir de `schemas/database_schema.sql`.
- Migration complementar criada em `schemas/20260625_001_local_ingest_extensions.sql`.
- Script de aplicacao criado em `tools/apply_supabase_schema.py`.
- Importador idempotente criado em `tools/import_session_to_supabase.py`.
- Sessao real importada para o banco remoto.

## Comandos usados

```bash
python3 tools/apply_supabase_schema.py
```

```bash
python3 tools/import_session_to_supabase.py \
  tmp/sessions/craig-AdabEqbzngmT-stage1-full \
  --campaign-slug yuhara-main \
  --campaign-name "Mesa DnD Yuhara" \
  --session-title "Sessao Craig AdabEqbzngmT"
```

O comando de importacao foi executado duas vezes para validar idempotencia.

## Resultado local preparado

```txt
participants=5
known_campaign_members=4
recording_files=15
audio_chunks=50
transcript_segments=41
```

## Resultado confirmado no banco

```txt
campaigns=1
profiles=5
campaign_members=4
sessions=1
participants=5
recording_files=15
audio_chunks=50
transcript_segments=41
processing_jobs=1
```

## Segmentos por faixa

```txt
arutorux       segments=10 words=3154 needs_review=false
faysk          segments=10 words=147  needs_review=false
renanyuhara    segments=10 words=1680 needs_review=false
sunnrq         segments=10 words=1706 needs_review=false
thomaz_17590   segments=1  words=4    needs_review=true
```

## Arquivos e artefatos registrados

Foram registrados:

- ZIP original do Craig;
- `info.txt`;
- 5 faixas FLAC originais;
- `manifest.json`;
- `participants.json`;
- `transcription_index.json`;
- `segments.json`;
- `transcript_tracks.json`;
- `track_summaries.json`;
- `transcript_master.json`;
- `transcript_master.md`.

Todos foram salvos com `storage_bucket = local` por enquanto. A etapa seguinte decide o armazenamento real dos objetos.

## Decisoes

- A campanha foi criada como `yuhara-main`.
- A sessao foi criada com `source_system = craig` e `source_session_id = craig-AdabEqbzngmT-stage1-full`.
- IDs foram gerados de forma estavel, permitindo reimportar sem duplicar registros.
- Jogadores conhecidos viraram `campaign_members`.
- `thomaz_17590` ficou como participante convidado/desconhecido e precisa de revisao.
- RLS nao foi ativado nesta etapa; a prioridade foi persistencia auditavel com dado real.

## Proximo passo recomendado

Etapa 5: Storage.

O foco deve ser decidir onde cada classe de arquivo fica:

- bruto pesado: ZIP/FLAC/chunks;
- artefatos processados: manifests/transcricoes;
- arquivos finais revisados/publicaveis.
