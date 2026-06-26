# Etapa 62 - Planner e executor por work units

## Objetivo

Fazer planner e executor usarem a mesma fonte de trabalho economica.

Antes, eles olhavam direto para `audio_chunks`. Agora usam a view `audio_transcription_work_units`.

Essa view funciona assim:

```text
se existem speech slices para um chunk -> usar speech_slice
se nao existem speech slices -> usar chunk como fallback
```

## Implementado

Atualizado `tools/plan_transcription_job.py`:

- planeja `speech_slice` quando existir;
- mostra quantos work units sao slices e quantos sao fallback;
- continua bloqueando item sem `sha256`;
- continua reaproveitando `transcription_cache` por hash.

Atualizado `tools/run_transcription_job.py`:

- executa a partir de `audio_transcription_work_units`;
- atualiza `audio_speech_slices` quando o work unit for slice;
- atualiza `audio_chunks` quando o work unit for fallback;
- cria `transcript_segments` com tempo absoluto da sessao;
- usa `workUnitId` no `source_segment_id`, evitando conflito quando um chunk vira varios slices.

## Estado atual do banco

A sessao `craig-AdabEqbzngmT-stage1-full` ainda esta em fallback:

```text
unit_type=chunk
units=50
missing_hash=50
audio_minutes=459.831
```

Isso esta correto por enquanto: o backfill ainda precisa rodar localmente para preencher `sha256`.

## Ordem segura agora

```bash
python3 tools/backfill_audio_metadata.py --source-session-id craig-AdabEqbzngmT-stage1-full --write
python3 tools/build_speech_slices.py craig-AdabEqbzngmT-stage1-full --limit 3
python3 tools/build_speech_slices.py craig-AdabEqbzngmT-stage1-full --limit 3 --write
python3 tools/plan_transcription_job.py craig-AdabEqbzngmT-stage1-full
python3 tools/run_transcription_job.py craig-AdabEqbzngmT-stage1-full
```

Depois de conferir a reducao, aumentar `--limit` aos poucos.

## Proximo passo

Criar uma tela de custo no frontend consumindo `audio_transcription_work_units` e `ai_usage_session_summary`, para o DM ver antes de executar:

- minutos de fallback;
- minutos em speech slices;
- work units bloqueados;
- cache hits;
- estimativa por sessao.
