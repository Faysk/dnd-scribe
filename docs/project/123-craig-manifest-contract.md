# Etapa 123 - Contrato robusto de manifest Craig

## Objetivo

Transformar o manifest Craig em um artefato persistente e auditavel, nao apenas um bloco dentro de `sessions.metadata`.

O manifest e a ancora tecnica da sessao gravada:

- identifica ZIP e `info.txt`;
- lista faixas esperadas;
- associa participantes;
- define janela temporal;
- define data logica da sessao;
- informa se a gravacao atravessou meia-noite;
- alimenta extracao, chunks, slices e timeline.

## Entregas

- Nova migracao: `schemas/20260628_017_craig_manifest_contract.sql`.
- Nova migracao corretiva: `schemas/20260628_018_craig_manifest_temporal_quality.sql`.
- Nova tabela: `craig_manifests`.
- Nova view: `craig_manifest_quality`.
- Backfill a partir de `sessions.metadata->cloud_manifest_only`.
- Worker `cloud_ingest_craig` passa a gravar o manifest normalizado nessa tabela.

## Status em producao

As migracoes 017 e 018 foram aplicadas com sucesso no Supabase.

Snapshot atual:

| Sessao | Status | Qualidade | Faixas | Participantes | Pendencias |
| --- | --- | --- | ---: | ---: | --- |
| `craig-BIRq3nIWB4v9` | `warning` | `attention` | 4 | 4 | `missing_start_time`, `missing_logical_date`, `duration_pending` |

Isso indica que o ZIP/manifest tem faixas e participantes, mas ainda nao trouxe uma janela temporal confiavel. A sessao pode continuar na esteira, mas a timeline final precisa dessa ancora antes de ficar 100%.

## Status do manifest

- `parsed`: manifest foi lido, mas ainda sem avaliacao final.
- `valid`: manifest tem faixas e janela temporal suficiente.
- `warning`: manifest e utilizavel, mas tem pendencia, como duracao incompleta.
- `invalid`: manifest nao tem requisitos minimos, como faixas FLAC.
- `superseded`: manifest antigo substituido por nova leitura.

## Data logica

A `logical_date` vem do inicio da gravacao em `Europe/London`.

Exemplo:

- inicio: `2026-06-27 18:00 Europe/London`;
- fim: `2026-06-28 02:00 Europe/London`;
- `logical_date`: `2026-06-27`;
- `crosses_midnight`: `true`.

Isso evita que uma sessao longa vire duas sessoes por atravessar meia-noite.

## Campos principais

- `source_recording_file_id`: arquivo ZIP Craig que originou o manifest.
- `created_by_job_id`: job que gerou a leitura.
- `recording_id`: id Craig quando existe no `info.txt`.
- `started_at` e `ended_at`: janela real inferida.
- `duration_ms` e `duration_source`: duracao e confianca da duracao.
- `zip_object_size`, `zip_entries`, `tracks_count`, `participants_count`.
- `manifest_json`: payload normalizado completo.
- `validation_errors`: pendencias estruturadas.

## Qualidade

`craig_manifest_quality` resume o estado por sessao:

- `critical`: manifest invalido ou sem faixas.
- `attention`: manifest com warning ou sem participantes.
- `ok`: manifest suficiente para seguir.

## Seguranca

Esta etapa tambem nao apaga nada e nao usa OpenAI.

Ela melhora rastreio e valida a base para etapas caras ou destrutivas. Qualquer decisao de apagar ZIP/FLAC so deve acontecer depois que `craig_manifest_quality` estiver `ok` e existir artefato compacto permanente.

## Proximo passo

Etapa 124: tornar a extracao de faixas ainda mais resumivel, registrando progresso por faixa e permitindo retry sem repetir faixa ja extraida.
