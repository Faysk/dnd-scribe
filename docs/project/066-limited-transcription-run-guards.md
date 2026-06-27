# Etapa 066 - Guardas para rodadas limitadas de transcricao

Data: 2026-06-27

## Objetivo

Permitir testes reais de transcricao em lotes pequenos sem que a validacao bloqueie a rodada por causa do tamanho total da sessao.

Antes desta etapa, o executor podia rodar com `--limit 3`, mas o validador avaliava todos os candidatos restantes da sessao. Agora o executor passa `--planned-limit` para o validador, e os limites de rodada usam apenas o lote planejado.

## Mudancas

Arquivos alterados:

- `tools/validate_ai_cost_pipeline.py`
- `tools/run_transcription_job.py`

Novos comportamentos:

- `validate_ai_cost_pipeline.py` aceita `--planned-limit`.
- `run_transcription_job.py` passa automaticamente `--planned-limit` igual ao `--limit`.
- O dry-run mostra `planned_audio_minutes`.
- O dry-run mostra `planned_estimated_cost_usd` quando `DND_COST_TRANSCRIPTION_AUDIO_MINUTE_USD` esta configurado.
- O executor aceita `--max-estimated-cost-usd` para abortar a rodada se passar do teto definido.
- O executor aceita `--approve-cost-usd` para confirmacao explicita quando o custo estimado passa do limite de aprovacao da politica.

## Comandos seguros

Atualizar repo local:

```bash
git pull --rebase origin main
```

Validar lote pequeno sem OpenAI:

```bash
python3 tools/run_transcription_job.py craig-AdabEqbzngmT-stage1-full --limit 3 --max-estimated-cost-usd 0.01
```

Executar lote pequeno real, depois de revisar o dry-run:

```bash
python3 tools/run_transcription_job.py craig-AdabEqbzngmT-stage1-full --limit 3 --max-estimated-cost-usd 0.01 --execute
```

## Observacao

`--execute` continua sendo obrigatorio para chamar OpenAI. Sem esse flag, o comando apenas consulta banco, cache e arquivos locais.
