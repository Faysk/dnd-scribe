# Etapa 070 - Worker cloud manifest-only Craig

Data: 2026-06-27

## Objetivo

Processar o job `cloud_ingest_craig` em producao sem baixar o ZIP inteiro, sem ffmpeg e sem OpenAI.

Esta etapa cria um worker HTTP na Vercel que le o ZIP direto do R2 usando `Range` requests, extrai apenas metadados do arquivo ZIP e o `info.txt`, descobre as tracks `.flac`, monta os participantes pelo mapa Craig e atualiza o Supabase.

## O que foi implementado

Arquivo novo:

- `api/jobs/run-cloud-ingest.js`

Endpoint:

```txt
POST /api/jobs/run-cloud-ingest
```

Modos:

```txt
GET  /api/jobs/run-cloud-ingest  -> descreve endpoint
POST /api/jobs/run-cloud-ingest  -> processa proximo job elegivel
POST body { "dryRun": true } -> le R2 e monta manifesto sem gravar alteracoes
POST body { "jobId": "..." } -> processa um job especifico
```

## Como funciona

Fluxo:

```txt
processing_jobs.cloud_ingest_craig queued
  -> Vercel Function reclama o job
  -> HEAD/Range no R2
  -> parse do central directory ZIP
  -> Range apenas do info.txt
  -> parse Craig info
  -> mapa config/craig_user_map.json
  -> upsert participants
  -> metadata em recording_files e sessions
  -> job cloud_ingest_craig succeeded
  -> cria cloud_extract_craig_tracks queued
```

## Custo

IA paga: US$ 0.

Custos esperados:

- poucas operacoes R2 (`HEAD` + `GET Range`);
- uma invocacao curta de Vercel Function;
- queries pequenas no Supabase.

Nao ha transcricao, classificacao, embeddings ou resumo nesta etapa.

## O que o worker ainda nao faz

- nao extrai FLACs para objetos individuais no R2;
- nao roda ffmpeg;
- nao cria chunks ou speech slices;
- nao chama OpenAI;
- nao fecha seguranca/RLS.

A etapa seguinte fica explicitamente criada como job:

```txt
cloud_extract_craig_tracks
```

## Comando de teste em producao

Dry-run sem gravar nada:

```bash
curl -sS -X POST https://dnd.faysk.dev/api/jobs/run-cloud-ingest \
  -H 'Content-Type: application/json' \
  -d '{"dryRun":true}' | jq
```

Execucao real do proximo job pendente:

```bash
curl -sS -X POST https://dnd.faysk.dev/api/jobs/run-cloud-ingest \
  -H 'Content-Type: application/json' \
  -d '{}' | jq
```

## Validacao esperada

Depois de uma execucao real:

```sql
select job_type, status, output
from processing_jobs
order by created_at desc
limit 5;
```

Esperado:

- `cloud_ingest_craig` com `status='succeeded'`;
- `output.workerStatus='manifest_succeeded'`;
- `output.manifest.tracks` com a quantidade de tracks do ZIP;
- novo `cloud_extract_craig_tracks` em `queued`;
- participantes atualizados/criados para a sessao.

## Riscos e residuos

- ZIP64 ainda nao e suportado neste worker. O ZIP Craig atual esta abaixo do limite comum, entao deve funcionar.
- Se o ZIP usar metodo de compressao diferente de store/deflate para `info.txt`, o worker falha com erro claro.
- O endpoint ainda esta aberto no modo teste do projeto. Antes de liberar jogadores, mover para auth/RBAC ou secret operacional.

## Proximo passo

Implementar `cloud_extract_craig_tracks` para transformar cada FLAC dentro do ZIP em objeto R2 individual, ainda sem transcricao paga.
