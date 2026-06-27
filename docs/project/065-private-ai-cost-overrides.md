# Etapa 065 - Precos privados para estimativa AI

Data: 2026-06-27

## Objetivo

Permitir estimativa de custo local sem publicar valores de preco no repositorio.

O arquivo `config/ai_cost_policy.json` continua com `unitCostsUsd` nulo por seguranca. Os valores atuais devem ficar em `.env.local`, que e ignorado pelo Git.

## Variaveis suportadas

```bash
DND_COST_TRANSCRIPTION_AUDIO_MINUTE_USD=""
DND_COST_CLASSIFICATION_INPUT_MTOK_USD=""
DND_COST_CLASSIFICATION_OUTPUT_MTOK_USD=""
DND_COST_SUMMARY_INPUT_MTOK_USD=""
DND_COST_SUMMARY_OUTPUT_MTOK_USD=""
```

## Preco de referencia da etapa

Na pagina oficial de precos da OpenAI consultada em 2026-06-27:

- `gpt-4o-mini-transcribe`: estimado em US$ 0.003/min
- `gpt-4o-transcribe`: estimado em US$ 0.006/min

Fonte: https://openai.com/api/pricing/

Como precos podem mudar, confirme a pagina oficial antes de rodadas pagas grandes.

## Proximo comando seguro

Depois de atualizar o repo local e, se desejado, preencher `DND_COST_TRANSCRIPTION_AUDIO_MINUTE_USD`, rode:

```bash
python3 tools/validate_ai_cost_pipeline.py craig-AdabEqbzngmT-stage1-full
python3 tools/plan_transcription_job.py craig-AdabEqbzngmT-stage1-full
```

Esses comandos nao chamam OpenAI. Eles apenas validam o pipeline e mostram o plano de custo.
