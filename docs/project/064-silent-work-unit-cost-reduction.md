# Etapa 064 - Reducao de custo por silencio e speech slices

Data: 2026-06-27

## Objetivo

Reduzir significativamente o custo de transcricao OpenAI antes de executar qualquer chamada paga, usando tres travas:

1. Hash local obrigatorio por unidade de audio.
2. Deteccao local de fala/silencio com ffmpeg.
3. Exclusao de audio provavelmente silencioso das work units cobraveis.

## Resultado atual

Sessao: `craig-AdabEqbzngmT-stage1-full`

Estado confirmado apos backfill e geracao de speech slices:

- Chunks brutos: 50
- Chunks provavelmente silenciosos: 18
- Chunks nao silenciosos com speech slices: 32
- Audio bruto total: 459.831 min
- Audio nao silencioso antes dos slices: 287.892 min
- Work units cobraveis atuais: 603 speech slices
- Minutos cobraveis atuais: 54.752 min
- Chunks inteiros em fallback: 0
- Work units sem hash: 0

Reducao aproximada contra o audio bruto original: 88.09%.

## Mudanca aplicada

A view `audio_transcription_work_units` foi atualizada para representar apenas audio elegivel para transcricao paga:

- inclui `audio_speech_slices` nao silenciosos;
- inclui chunks inteiros apenas quando ainda nao ha slices e o chunk nao foi marcado como silencioso;
- exclui chunks `probably_silent = true` do caminho pago.

Arquivo de migracao: `schemas/20260627_013_exclude_silent_work_units.sql`.

## Comandos locais usados

```bash
python3 tools/backfill_audio_metadata.py --source-session-id craig-AdabEqbzngmT-stage1-full --write
python3 tools/build_speech_slices.py craig-AdabEqbzngmT-stage1-full --limit 3
python3 tools/build_speech_slices.py craig-AdabEqbzngmT-stage1-full --limit 3 --write
python3 tools/build_speech_slices.py craig-AdabEqbzngmT-stage1-full --limit 50 --write
```

## Proximas 10 etapas

1. Rodar `python3 tools/plan_transcription_job.py craig-AdabEqbzngmT-stage1-full` para gerar o plano sem custo pago.
2. Configurar explicitamente o preco por minuto no `config/ai_cost_policy.json`, se ainda estiver vazio.
3. Criar uma rodada pequena de transcricao real com limite baixo, depois de aprovacao manual.
4. Validar qualidade da transcricao por participante e ajustar parametros de silencio se necessario.
5. Registrar custos estimados e reais em `ai_usage_ledger`.
6. Ativar cache de transcricao por `sha256` como requisito obrigatorio para reprocessamentos.
7. Consolidar slices transcritos em uma timeline por sessao.
8. Criar sumarizacao narrativa separando canon, bastidor e diario DM.
9. Expor no front uma tela de revisao DM para aprovar canon e corrigir nomes/personagens.
10. Automatizar o fluxo de nova sessao: importar Craig, gerar hashes, detectar slices, planejar custo e aguardar aprovacao para transcrever.

## Observacoes

A transcricao paga continua bloqueada por processo: a etapa atual prepara custo e unidades, mas nao executa OpenAI automaticamente.
