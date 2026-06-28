# Etapa 133 - Worker de limpeza segura R2

## Objetivo

Executar limpeza de storage em producao sem depender de comandos locais e sem apagar nada fora da policy.

O worker apaga apenas objetos que a view `audio_storage_cleanup_candidates` ja marcou como:

- `readiness_status = delete_ready`;
- `lifecycle_status = delete_ready`.

## Entregas

- Script: `tools/storage_cleanup_worker.py`.
- Workflow manual: `.github/workflows/storage-cleanup-worker.yml`.
- Dry-run por padrao.
- Execucao real exige:
  - `execute=true`;
  - `confirm=DELETE_READY_R2`.

## Fluxo

1. Atualiza readiness somente em execucao real, usando a policy do banco.
2. Seleciona candidatos por campanha e, opcionalmente, `source_session_id`.
3. Ordena por maior `reclaimable_bytes`.
4. Marca cada artefato como `delete_queued`.
5. Apaga o objeto no R2.
6. Marca como `deleted` e grava evento.
7. Em falha, marca `failed` e grava o erro para revisao.

## Validacao esperada para `craig-BIRq3nIWB4v9`

Apos transcricao da sessao piloto:

- `craig_zip`: `delete_ready`, cerca de 735 MB.
- `speech_slice_wav`: `delete_ready`, cerca de 13.7 MB.
- `raw_track_flac`: continua `blocked` por `compact_audio_missing`.

Isso preserva o audio bruto por faixa ate termos Opus compacto permanente para playback/timeline.

## Proximo passo

Rodar:

1. workflow em dry-run;
2. workflow real para os objetos `delete_ready`;
3. nova consulta de inventory para confirmar reducao do R2 rastreado.
