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

### MVP

Usar Supabase Storage.

Buckets sugeridos:

```txt
session-raw-private
session-processed-private
session-public
exports
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
build_publications
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
