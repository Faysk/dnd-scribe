# Etapa 132 - Transcricao cloud e evidencia de limpeza

## Objetivo

Fechar o primeiro ciclo real em producao:

1. detectar speech slices no R2;
2. transcrever com OpenAI com teto de custo;
3. gravar cache, segmentos e ledger;
4. liberar artefatos temporarios de fala para limpeza segura.

## Entregas

- Workflow GitHub Actions `Transcription Worker`.
- Executor `tools/run_transcription_job.py` com:
  - validacao de custo antes de qualquer chamada paga;
  - download de audio do R2 quando o arquivo nao existe localmente;
  - cache por `audio_sha256 + provider + model + prompt_version`;
  - recuperacao de cache hit quando uma execucao cai depois da chamada OpenAI;
  - ledger por work unit.
- Validador `tools/validate_ai_cost_pipeline.py` agora aceita custo obrigatorio por chave, sem exigir precos futuros de classificacao/resumo.
- Migracao `schemas/20260628_022_audio_cleanup_transcription_evidence.sql`.

## Validacao real

Sessao piloto: `craig-BIRq3nIWB4v9`.

- Speech slices transcritos/cacheados: 20.
- Segmentos materializados: 20.
- Cache de transcricao: 20 entradas `succeeded`.
- Candidato pago restante: 0.
- Lote final: 19 slices, 6.66 minutos, estimativa `US$ 0.019979`.

## Cleanup

Antes desta etapa, `speech_slice_wav` ficava bloqueado por `transcript_source_missing`, porque a policy esperava um artefato `transcript_source`.

Agora a view `audio_storage_cleanup_candidates` tambem aceita evidencia operacional real:

- `audio_speech_slices.transcription_status in ('transcribed', 'cached')` para `speech_slice_wav`;
- `audio_chunks.transcription_status in ('transcribed', 'cached')` para `chunk_wav`.

Isso permite apagar do R2 apenas os WAVs temporarios ja transcritos, sem apagar transcricao, cache, timeline ou audio compacto permanente.

## Proximos passos

1. Aplicar a migracao 022 em producao.
2. Rodar dry-run de `/api/storage-cleanup-run`.
3. Executar limpeza real apenas para `delete_ready`.
4. Criar compactacao Opus permanente por faixa para destravar `raw_track_flac`.
