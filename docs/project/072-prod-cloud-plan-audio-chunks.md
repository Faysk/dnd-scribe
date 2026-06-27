# 072 - Prod cloud audio chunk planner

Data: 2026-06-27

## Objetivo

Adicionar a etapa `cloud_plan_audio_chunks` para producao. Depois que as faixas Craig foram extraidas para objetos individuais no R2, esta etapa le metadados FLAC e cria um plano deterministico de chunks no Supabase.

Esta etapa ainda nao corta audio fisicamente, nao detecta fala e nao transcreve. O objetivo e preparar o banco para as proximas etapas sem custo de IA.

## Endpoint criado

`POST /api/jobs/run-cloud-plan-chunks`

`GET /api/jobs/run-cloud-plan-chunks` retorna metadados operacionais, incluindo `defaultChunkSeconds: 600` e `paidAiCostUsd: 0`.

## Comportamento

- Busca job `cloud_plan_audio_chunks` com status `queued` ou `retrying`.
- Le `trackFiles` do input do job ou, como fallback, busca `recording_files.file_type = 'craig_track'` da sessao.
- Le somente o inicio de cada FLAC no R2 por range request.
- Parseia `STREAMINFO` do FLAC para descobrir duracao, sample rate, canais e bits por sample.
- Gera chunks de 600 segundos por padrao, ajustavel entre 60 e 1800 segundos.
- Faz upsert em `audio_chunks` usando o indice existente `(session_id, track_key, chunk_index)`.
- Marca os chunks como `transcription_status = 'planned_cloud_chunk'`.
- Mantem `sha256` nulo e `metadata.planned_only = true`, bloqueando transcricao paga ate uma etapa posterior renderizar audio real e preencher hash.
- Cria o proximo job `cloud_detect_speech_slices` ao concluir.

## Por que planejar sem renderizar audio agora

Este passo e barato e seguro. Ele permite estimar duracao e quantidade de chunks no banco, mas ainda evita colocar qualquer unidade como pronta para OpenAI. No dashboard de custos, chunks sem `sha256` aparecem como bloqueados por `missing_hash`, o que e exatamente a trava desejada.

## Frontend

O painel `Operacao` agora conhece tres workers cloud:

- `cloud_ingest_craig` -> `/api/jobs/run-cloud-ingest`
- `cloud_extract_craig_tracks` -> `/api/jobs/run-cloud-extract`
- `cloud_plan_audio_chunks` -> `/api/jobs/run-cloud-plan-chunks`

Cada job elegivel mostra botoes de simulacao e execucao. A execucao confirma antes de rodar e exibe que a etapa nao usa OpenAI paga.

## Custo

- OpenAI: USD 0.
- R2: leituras pequenas por faixa para header FLAC.
- Supabase: inserts/upserts proporcionais ao numero de chunks.
- Vercel: compute curto, sem processamento pesado de audio.

## Riscos conhecidos

- FLAC sem `STREAMINFO` nos primeiros 64 KiB falha explicitamente.
- Chunks planejados ainda nao sao arquivos fisicos no R2.
- A proxima etapa precisa decidir se renderiza chunks com ffmpeg em Vercel, Cloudflare, ou worker dedicado.
- RLS segue aberta em modo teste e precisa ser fechada antes de acesso amplo.

## Proximo passo

Implementar `cloud_render_audio_chunks` ou redesenhar a etapa de speech slices para processar diretamente da faixa original. A decisao tecnica principal agora e onde rodar ffmpeg/corte de audio com menor custo e maior previsibilidade.
