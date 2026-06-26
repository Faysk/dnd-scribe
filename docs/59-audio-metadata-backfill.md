# Etapa 59 - Backfill de hash e metadados de audio

## Objetivo

Corrigir sessoes ja importadas antes da etapa de economia existir.

O banco real ja tem a sessao `craig-AdabEqbzngmT-stage1-full` com chunks, mas os chunks antigos estao sem `sha256`. Isso bloqueia corretamente a transcricao paga, porque sem hash nao existe cache confiavel.

## Implementado

Criado `tools/backfill_audio_metadata.py`.

Ele busca arquivos locais referenciados no Supabase e calcula:

- `sha256`;
- `audio_rms`;
- `audio_peak`;
- `audio_dbfs`;
- `probably_silent`;
- `silence_dbfs_threshold`.

Para chunks silenciosos, tambem ajusta `transcription_status` para `skipped_silence`.

## Uso seguro

Por padrao o script nao grava nada. Ele apenas mostra o que faria:

```bash
python3 tools/backfill_audio_metadata.py --source-session-id craig-AdabEqbzngmT-stage1-full
```

Para gravar no Supabase:

```bash
python3 tools/backfill_audio_metadata.py --source-session-id craig-AdabEqbzngmT-stage1-full --write
```

Para processar tambem os arquivos originais de gravacao:

```bash
python3 tools/backfill_audio_metadata.py --source-session-id craig-AdabEqbzngmT-stage1-full --record-type all --write
```

## Por que isso reduz custo

Sem `sha256`, cada chunk parece novo para o sistema.

Com `sha256`:

- chunks repetidos podem reutilizar `transcription_cache`;
- o planner pode bloquear apenas o que esta incompleto;
- o executor real consegue consultar cache antes de chamar OpenAI;
- silencio pode ser pulado antes de qualquer chamada paga.

## Ordem recomendada agora

```bash
python3 tools/backfill_audio_metadata.py --source-session-id craig-AdabEqbzngmT-stage1-full --write
python3 tools/validate_ai_cost_pipeline.py craig-AdabEqbzngmT-stage1-full
python3 tools/plan_transcription_job.py craig-AdabEqbzngmT-stage1-full --write-ledger
```

Depois disso a sessao esta pronta para o executor de transcricao economy-first.
