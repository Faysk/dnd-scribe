# 193 - Transcription Worker Output Guardrail

## Objetivo

Evitar que lotes grandes de transcricao quebrem no fechamento do job depois de ja terem gravado transcricoes no banco.

## Incidente validado em producao

Sessao: `manual-2026-07-01-20260701-sessao-235100`

Run GitHub Actions: `28557748353`

O lote de `300` unidades processou as work units, gravou cache/transcript no Supabase, mas falhou ao finalizar `processing_jobs`:

```text
OSError: [Errno 7] Argument list too long: 'psql'
```

A causa foi o `tools/run_transcription_job.py` enviar um JSON grande demais para `psql -c` ao atualizar `processing_jobs.output`.

## Correcao

- `execute()` agora envia SQL para `psql` via stdin, evitando limite de tamanho de argumento do sistema operacional.
- `processing_jobs.output` recebe um resumo compacto em `resultSummary`.
- O artifact do workflow continua podendo guardar o JSON completo do run.

## Recuperacao aplicada

Job recuperado:

`959e9d74-8e9c-4f78-8f90-2dee26d5beaa`

Ele foi marcado como `succeeded` com:

- `workerStatus=recovered_after_argument_list_too_long`;
- `processed=300`;
- `plannedAudioMinutes=134.532`;
- `plannedEstimatedCostUsd=0.403597`.

## Estado apos recuperacao

```text
transcriptionStatus=pending:294/143.6m, transcribed:330/150.794m
transcript=330 segments 329 non_empty chars=52425 words=10282 tracks=3
```

## Proximo uso operacional

Executar o lote restante somente depois desta correcao estar em `main`, para o worker novo finalizar o job sem repetir o erro.
