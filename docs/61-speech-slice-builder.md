# Etapa 61 - Gerador de slices com fala

## Objetivo

Diminuir drasticamente minutos enviados para OpenAI em gravacoes Craig multitrack.

Sem essa etapa, cada track pode ser transcrita por inteiro. Em uma mesa com 5 pessoas, uma sessao de 100 minutos pode virar perto de 500 minutos de audio cobrado. O certo e recortar apenas trechos com fala em cada track.

## Implementado

Criado `tools/build_speech_slices.py`.

Criado tambem o schema `audio_speech_slices` e a view `audio_transcription_work_units`.

A ferramenta usa `ffmpeg silencedetect` para detectar silencio dentro de cada chunk local e criar WAVs menores com fala:

```text
chunk longo -> detectar silencio -> intervalos com fala -> agrupar contexto -> slice_000.wav, slice_001.wav, ...
```

Os slices nao devem ser palavra/frase. Eles sao unidades de transcricao com
contexto suficiente para preservar nomes, pontuacao e frases completas.
Palavras/frases sao derivadas depois da transcricao, localmente, para a
timeline.

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
- `--merge-gap-seconds 2.5`: junta falas proximas para reduzir requests;
- `--min-unit-seconds 12`: evita arquivos curtos demais para transcricao;
- `--max-unit-seconds 90`: limita o tamanho maximo de cada unidade.

## Politica de custo

O caminho recomendado e:

```text
audio bruto -> remover silencio -> slices contextuais -> OpenAI -> frases/palavras locais
```

Evitar:

```text
audio bruto -> palavra/frase -> OpenAI
```

Fragmentar antes da OpenAI aumenta chamadas, overhead e risco de contexto ruim.
Fragmentar depois da transcricao e praticamente custo zero de IA.

## Ordem recomendada

```bash
python3 tools/backfill_audio_metadata.py --source-session-id craig-AdabEqbzngmT-stage1-full --write
python3 tools/build_speech_slices.py craig-AdabEqbzngmT-stage1-full --limit 3
python3 tools/build_speech_slices.py craig-AdabEqbzngmT-stage1-full --limit 3 --write
python3 tools/plan_transcription_job.py craig-AdabEqbzngmT-stage1-full
```

## Proximo passo

Usar a timeline para validar se os segmentos contextuais estao gerando frases
com tempo bom o suficiente. Se for preciso precisao por palavra, adicionar
timestamps granulares como recurso opcional e aprovado pelo custo/beneficio.
