# 10 — Storage, Queues e Workers

## Objetivo

Definir como lidar com arquivos grandes e processamento demorado.

## Por que não processar na Vercel?

Transcrever seis horas de áudio pode demorar, falhar, precisar retry e consumir recursos.

A Vercel deve cuidar de:

- frontend;
- APIs leves;
- upload inicial;
- autenticação;
- telas;
- pequenas ações.

O worker Docker cuida do trampo pesado. É o peão da obra digital, só que sem reclamar do café.

## Storage

### Decisao atual do MVP

Usar Cloudflare R2 como arquivo duravel dos audios e artefatos processados.

Motivo:

- os arquivos brutos do Craig sao grandes;
- R2 ja foi validado com API + S3;
- a tabela `recording_files` no Supabase consegue guardar bucket/path/metadados;
- o frontend pode receber links assinados temporarios sem deixar o bucket publico.

Supabase Storage pode continuar como alternativa futura para arquivos pequenos gerados pela UI, anexos manuais ou publicacoes revisadas.

Buckets sugeridos:

```txt
dnd-scribe-audio
```

### Futuro

Cloudflare R2 para áudio bruto antigo ou grande volume.

## Organização no Storage

```txt
campaigns/{campaign_id}/sessions/{session_id}/raw/
campaigns/{campaign_id}/sessions/{session_id}/processed/
campaigns/{campaign_id}/sessions/{session_id}/review/
campaigns/{campaign_id}/sessions/{session_id}/public/
```

Layout atual no R2:

```txt
campaigns/{campaign_slug}/sessions/{source_session_id}/raw/source/
campaigns/{campaign_slug}/sessions/{source_session_id}/raw/craig/
campaigns/{campaign_slug}/sessions/{source_session_id}/raw/tracks/
campaigns/{campaign_slug}/sessions/{source_session_id}/processed/
campaigns/{campaign_slug}/sessions/{source_session_id}/processed/transcripts/
campaigns/{campaign_slug}/sessions/{source_session_id}/processed/transcripts/raw/
```

Chunks WAV ficam fora do upload padrao. Eles sao grandes e regeneraveis a partir do ZIP/FLAC. Se o worker futuro precisar buscar chunks diretamente do storage, usar `--include-chunks`.

## Queues

Jobs sugeridos:

```txt
process_session
normalize_audio
split_audio
transcribe_chunk
merge_transcripts
parse_roll20
classify_segments
extract_canon_candidates
extract_quote_candidates
extract_outtake_candidates
apply_review_decisions
build_publications
export_review_board_data
```

## Worker Docker

Responsabilidades:

1. buscar jobs na fila;
2. baixar arquivos necessários;
3. processar;
4. salvar resultados;
5. atualizar status;
6. registrar erros;
7. repetir/retry se necessário.

## Estados de processamento

```txt
queued
running
succeeded
failed
retrying
cancelled
```

## Logs

Cada job deve salvar:

- início;
- fim;
- duração;
- arquivos processados;
- tokens/custo estimado;
- erro, se houver;
- stack trace técnico;
- output gerado.

## Retry

Política sugerida:

```txt
3 tentativas automáticas
backoff exponencial
falha permanente exige ação humana
```

## Worker local no início

Você pode começar rodando no WSL:

```bash
docker compose up worker
```

Ou manualmente:

```bash
npm run worker
```

## Ciclo local atual

Enquanto o worker real ainda nao existe, o ciclo de revisao/publicacao roda por scripts locais:

```bash
python3 tools/export_review_decision_template.py --out tmp/review_decisions_template.json
python3 tools/run_review_publication_cycle.py --decisions-file tmp/review_decisions_template.json --update-db
```

Na pratica, o segundo comando deve receber o JSON revisado pelo DM, nao o template cru.

## Worker futuro

Depois pode migrar para:

- VPS;
- Fly.io;
- Railway;
- Render;
- servidor caseiro;
- máquina dedicada.

## Arquivo exemplo

Veja:

```txt
examples/docker/docker-compose.yml
```
