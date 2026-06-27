# Etapa 067 - Primeira amostra controlada de transcricao

Data: 2026-06-27

## Checkpoint atual

Sessao: `craig-AdabEqbzngmT-stage1-full`

Estado confirmado no Supabase:

- Work units: 603
- Speech slices: 603
- Chunk fallbacks: 0
- Work units sem hash: 0
- Cache hits: 0
- Candidatos de transcricao: 603
- Minutos pendentes: 54.752

Estimativa com `gpt-4o-mini-transcribe` a US$ 0.003/min:

- Sessao inteira: aproximadamente US$ 0.164
- Amostra pequena de 3 slices: normalmente bem abaixo de US$ 0.01

## Preparar preco local

O arquivo `.env.local` deve conter, se quiser custo em dolar no dry-run:

```bash
DND_COST_TRANSCRIPTION_AUDIO_MINUTE_USD="0.003"
```

Confirme a pagina oficial antes de rodadas grandes: https://openai.com/api/pricing/

## Rodada sem OpenAI

```bash
git pull --rebase origin main
python3 tools/run_transcription_job.py craig-AdabEqbzngmT-stage1-full --limit 3 --max-estimated-cost-usd 0.01
```

Esperado:

- `execute=false`
- `processed=3`
- `planned_audio_minutes` pequeno
- `planned_estimated_cost_usd` menor que `0.01`, se o preco local estiver configurado
- linhas `would_transcribe`

## Rodada real pequena

Somente depois de revisar o dry-run:

```bash
python3 tools/run_transcription_job.py craig-AdabEqbzngmT-stage1-full --limit 3 --max-estimated-cost-usd 0.01 --execute
```

Esperado:

- `execute=true`
- `processed=3`
- `processing_job_id=...`
- linhas `transcribed` ou `cache_hit`
- novos registros em `transcription_cache`, `transcript_segments` e `ai_usage_ledger`

## Depois da amostra

1. Recarregar o site.
2. Abrir a sessao.
3. Conferir se os 3 segmentos aparecem na timeline.
4. Ouvir trechos pontuais quando houver audio assinado disponivel.
5. Se a qualidade estiver boa, aumentar progressivamente: `--limit 20`, depois `--limit 100`.
