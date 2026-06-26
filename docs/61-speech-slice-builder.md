# Etapa 61 - Gerador de slices com fala

## Objetivo

Diminuir drasticamente minutos enviados para OpenAI em gravacoes Craig multitrack.

Sem essa etapa, cada track pode ser transcrita por inteiro. Em uma mesa com 5 pessoas, uma sessao de 100 minutos pode virar perto de 500 minutos de audio cobrado. O certo e recortar apenas trechos com fala em cada track.

## Implementado

Criado `tools/build_speech_slices.py`.

Criado tambem o schema `audio_speech_slices` e a view `audio_transcription_work_units`.

A ferramenta usa `ffmpeg silencedetect` para detectar silencio dentro de cada chunk local e criar WAVs menores com fala:

```text
chunk longo -> detectar silencio -> intervalos com fala -> slice_000.wav, slice_001.wav, ...
```

## Uso seguro

Dry-run, sem criar arquivo e sem gravar no banco:

```bash
python3 tools/build_speech_slices.py craig-AdabEqbzngmT-stage1-full --limit 3
```

Gerar slices e gravar no Supabase:

```bash
python3 tools/build_speech_slices.py craig-AdabEqbzngmT-stage1-full --limit 3 --write
```

Recriar slices de chunks ja processados:

```bash
python3 tools/build_speech_slices.py craig-AdabEqbzngmT-stage1-full --limit 3 --replace --write
```

Depois de conferir uma amostra, aumentar o limite:

```bash
python3 tools/build_speech_slices.py craig-AdabEqbzngmT-stage1-full --limit 50 --write
```

## Parametros importantes

- `--noise-db -45`: volume abaixo disso conta como silencio;
- `--min-silence-seconds 1.0`: silencio minimo para separar fala;
- `--min-speech-seconds 2.0`: descarta ruidos curtos;
- `--padding-ms 250`: adiciona margem antes/depois de cada trecho de fala.

## Ordem recomendada

```bash
python3 tools/backfill_audio_metadata.py --source-session-id craig-AdabEqbzngmT-stage1-full --write
python3 tools/build_speech_slices.py craig-AdabEqbzngmT-stage1-full --limit 3
python3 tools/build_speech_slices.py craig-AdabEqbzngmT-stage1-full --limit 3 --write
python3 tools/plan_transcription_job.py craig-AdabEqbzngmT-stage1-full
```

## Proximo passo

Ajustar planner e executor para lerem `audio_transcription_work_units`, preferindo `speech_slice` quando existir e usando chunk inteiro apenas como fallback.
