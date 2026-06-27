# 072 - Prod cloud audio chunk planner

Data: 2026-06-27
Status: planejado/prototipado, pausado no deploy ativo por limite de functions do Vercel Hobby.

## Objetivo

Adicionar a etapa `cloud_plan_audio_chunks` para producao. Depois que as faixas Craig forem extraidas para objetos individuais no R2, esta etapa deve ler metadados FLAC e criar um plano deterministico de chunks no Supabase.

Esta etapa nao corta audio fisicamente, nao detecta fala e nao transcreve. O objetivo e preparar o banco para as proximas etapas sem custo de IA.

## Resultado da tentativa

O endpoint foi prototipado como `api/jobs/run-cloud-plan-chunks.js`, mas ao adicionar mais uma Serverless Function o deploy bateu no limite do plano Vercel Hobby:

`exceeded_serverless_functions_per_deployment`

A producao foi corrigida removendo a function nova do deploy ativo e restaurando os wrappers de upload Craig, que sao necessarios porque o catch-all atual nao atende rotas profundas como `/api/uploads/craig-url`.

## Comportamento planejado

- Buscar job `cloud_plan_audio_chunks` com status `queued` ou `retrying`.
- Ler `trackFiles` do input do job ou, como fallback, buscar `recording_files.file_type = 'craig_track'` da sessao.
- Ler somente o inicio de cada FLAC no R2 por range request.
- Parsear `STREAMINFO` do FLAC para descobrir duracao, sample rate, canais e bits por sample.
- Gerar chunks de 600 segundos por padrao, ajustavel entre 60 e 1800 segundos.
- Fazer upsert em `audio_chunks` usando o indice existente `(session_id, track_key, chunk_index)`.
- Marcar chunks como `transcription_status = 'planned_cloud_chunk'`.
- Manter `sha256` nulo e `metadata.planned_only = true`, bloqueando transcricao paga ate uma etapa posterior renderizar audio real e preencher hash.
- Criar o proximo job `cloud_detect_speech_slices` ao concluir.

## Por que planejar sem renderizar audio

Este passo e barato e seguro. Ele permite estimar duracao e quantidade de chunks no banco, mas ainda evita colocar qualquer unidade como pronta para OpenAI. No dashboard de custos, chunks sem `sha256` aparecem como bloqueados por `missing_hash`, que e a trava desejada.

## Decisao tomada

Nao vamos subir Vercel Pro so para resolver contagem de functions neste momento. O melhor caminho e consolidar runners cloud em menos endpoints, por exemplo um unico `/api/jobs/run-cloud` que despacha por `job_type`:

- `cloud_ingest_craig`
- `cloud_extract_craig_tracks`
- `cloud_plan_audio_chunks`
- futuros jobs de audio

Isso preserva o plano Hobby, reduz superficie de deploy e evita custo fixo antes de termos volume real.

## Estado ativo em producao

Ativos em producao agora:

- Upload Craig direto para R2.
- Confirmacao de upload.
- `cloud_ingest_craig`.
- `cloud_extract_craig_tracks`.
- Controles de Operacao para ingest/extract.

Pausado:

- Endpoint ativo de `cloud_plan_audio_chunks`.

## Custo

- OpenAI: USD 0.
- R2/Supabase/Vercel: apenas operacoes pequenas nas etapas ativas.
- Nenhum upgrade de Vercel foi feito.

## Proximo passo

Consolidar os workers cloud para caber no limite Hobby e entao reativar o planner de chunks sem criar uma function extra.
