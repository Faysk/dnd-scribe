# 071 - Prod cloud Craig track extractor

Data: 2026-06-27

## Objetivo

Adicionar a segunda etapa cloud do pipeline de audio em producao: depois do ZIP Craig ser enviado para o R2 e o manifest-only ingest identificar as faixas, o worker `cloud_extract_craig_tracks` separa as faixas `.flac` do ZIP e grava cada uma como objeto individual no R2.

Esta etapa nao transcreve audio, nao chama OpenAI e nao tem custo pago de IA.

## Endpoint criado

`POST /api/jobs/run-cloud-extract`

`GET /api/jobs/run-cloud-extract` retorna metadados operacionais do endpoint, incluindo limite padrao por execucao e custo de IA zero.

## Comportamento

- Busca um job `cloud_extract_craig_tracks` com status `queued` ou `retrying`.
- Le o central directory do ZIP no R2 por `Range`, sem baixar o arquivo inteiro para memoria.
- Processa por padrao 1 faixa por execucao, com limite maximo de 3 faixas por chamada.
- Extrai a entrada `.flac` selecionada e grava em `campaigns/<campaign>/sessions/<source_session_id>/tracks/craig/<track>.flac`.
- Faz upsert em `recording_files` usando o indice unico `(session_id, storage_bucket, storage_path)`.
- Associa `participant_id` quando a etapa anterior ja criou `participants.source_track_key`.
- Recoloca o job como `queued` se ainda houver faixas pendentes.
- Marca o job como `succeeded` quando todas as faixas foram extraidas.
- Cria o proximo job `cloud_plan_audio_chunks` ao finalizar todas as faixas.

## Idempotencia

A etapa foi desenhada para poder rodar novamente sem duplicar arquivos logicos no banco:

- O caminho de destino por faixa e deterministico.
- `recording_files` usa upsert no indice existente.
- Se uma faixa ja aparece no banco para o caminho alvo, ela e considerada extraida.
- Se uma execucao falhar depois de gravar no R2 mas antes de gravar no banco, a proxima chamada pode sobrescrever o mesmo objeto e concluir o upsert.

## Limites conservadores

O limite padrao de 1 faixa por execucao e intencional. As faixas Craig podem ser grandes, entao a estrategia inicial evita prender uma funcao Vercel em um processamento longo demais. Se os primeiros testes reais ficarem estaveis, podemos subir para 2 ou 3 faixas por chamada.

## Validacao feita

- Deploy automatico Vercel para o commit `36b75da9394410adb4f4cfeddf535e90983dab28` ficou `READY`.
- `GET https://dnd.faysk.dev/api/jobs/run-cloud-extract` retornou 200.
- Resposta confirmou `mode: cloud_extract_craig_tracks`, `defaultTracksPerRun: 1`, `maxTracksPerRun: 3`, `paidAiCostUsd: 0`.
- Build Vercel executou `node scripts/sync-public.js` e sincronizou `web -> public` com 5 arquivos.

## Estado atual da fila

No momento da validacao, producao ainda nao tinha job `cloud_ingest_craig` ou `cloud_extract_craig_tracks` criado por upload real. Portanto a execucao com POST ainda depende do primeiro upload ZIP feito pelo site em producao.

## Riscos conhecidos

- ZIP64 ainda nao esta suportado nestes workers. Se Craig gerar ZIP64 em uma sessao muito grande, a etapa vai falhar de forma explicita.
- Entradas ZIP criptografadas nao sao suportadas.
- Deflate e store sao suportados; Craig tende a armazenar audio ja comprimido, mas isso precisa ser confirmado com o primeiro ZIP real em producao.
- A Vercel pode ter limite de duracao para faixas muito grandes; por isso a execucao e fatiada por faixa.
- RLS continua aberta nesta fase de teste. Antes de expor para jogadores, precisamos fechar politicas de leitura/escrita.

## Proximo passo

Implementar `cloud_plan_audio_chunks`, ainda sem IA paga:

1. Ler as faixas individuais no R2.
2. Definir chunks por faixa de forma deterministica.
3. Criar registros em `audio_chunks` com status inicial.
4. Preparar a etapa seguinte de deteccao/slices de fala.
5. Somente depois disso liberar uma etapa de transcricao com teto explicito de custo.
