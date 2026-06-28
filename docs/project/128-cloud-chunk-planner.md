# Etapa 128 - Planner cloud de chunks

## Objetivo

Ativar `cloud_plan_audio_chunks` em producao sem criar uma nova Vercel Function e sem custo de OpenAI.

## Entregas

- Nova rota consolidada no catch-all: `POST /api/run-cloud-plan-chunks`.
- A rota profunda `/api/jobs/run-cloud-plan-chunks` fica aceita no codigo, mas a Vercel Hobby deste projeto nao entrega caminhos profundos ao catch-all atual.
- Permissao exigida: `project.jobs.run`.
- Le faixas `craig_track` ja extraidas em R2.
- Faz range request pequeno no FLAC para ler `STREAMINFO`.
- Calcula duracao, sample rate, canais e bits por sample sem baixar o arquivo inteiro.
- Cria chunks planejados em `audio_chunks` usando `chunkSeconds`, padrao `600`.
- Usa upsert idempotente em lote por `(session_id, track_key, chunk_index)`.
- Marca chunks como `transcription_status = planned_cloud_chunk`.
- Mantem `storage_path` e `sha256` vazios porque o audio do chunk ainda nao foi renderizado.
- Cria o proximo job `cloud_detect_speech_slices`.

## Seguranca de custo

Esta etapa continua com OpenAI `$0`.

Os chunks planejados aparecem como work units, mas ainda nao podem entrar em transcricao paga com seguranca porque nao possuem `sha256` nem arquivo de chunk/slice renderizado. A etapa de custo ja trata isso como bloqueio por hash ausente.

## Motivo tecnico

Planejar antes de renderizar permite saber volume, duracao e quantidade de chunks sem gerar objetos intermediarios. Isso ajuda a estimar custo e preparar a timeline, mantendo storage controlado.

## Proximo passo

Implementar `cloud_detect_speech_slices`/renderizacao economica:

1. Gerar audio compacto permanente por faixa.
2. Renderizar chunks ou slices de fala em formato barato.
3. Preencher `sha256`.
4. So entao liberar transcricao paga controlada.
