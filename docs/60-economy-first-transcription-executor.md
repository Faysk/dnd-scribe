# Etapa 60 - Executor de transcricao economy-first

## Objetivo

Criar o primeiro executor real de transcricao com OpenAI, mas travado por padrao para evitar custo acidental.

O comando so chama OpenAI quando recebe `--execute`. Sem essa flag ele faz dry-run.

## Implementado

Criado `tools/run_transcription_job.py`.

Ele faz:

- validacao da pipeline antes de executar;
- bloqueio se faltar `sha256`;
- bloqueio se faltar preco local quando `--execute` for usado;
- limite pequeno por rodada, padrao de 3 chunks;
- checagem de cache imediatamente antes de chamar OpenAI;
- chamada de transcricao apenas para chunks sem cache, sem silencio e com hash;
- grava `transcription_cache`;
- materializa texto em `transcript_segments`;
- atualiza `audio_chunks.transcription_status`;
- grava `ai_usage_ledger`.

## Ordem segura para a sessao atual

A sessao atual precisa de backfill antes:

```bash
python3 tools/backfill_audio_metadata.py --source-session-id craig-AdabEqbzngmT-stage1-full --write
```

Depois validar:

```bash
python3 tools/validate_ai_cost_pipeline.py craig-AdabEqbzngmT-stage1-full --require-prices
```

Planejar e registrar estimativa:

```bash
python3 tools/plan_transcription_job.py craig-AdabEqbzngmT-stage1-full --write-ledger
```

Dry-run do executor:

```bash
python3 tools/run_transcription_job.py craig-AdabEqbzngmT-stage1-full
```

Executar uma rodada pequena:

```bash
python3 tools/run_transcription_job.py craig-AdabEqbzngmT-stage1-full --execute --limit 1
```

Aumentar depois, com calma:

```bash
python3 tools/run_transcription_job.py craig-AdabEqbzngmT-stage1-full --execute --limit 3
```

## Variaveis privadas necessarias

No `.env.local`:

```env
DATABASE_URL=...
OPENAI_API_KEY=...
DND_COST_TRANSCRIPTION_AUDIO_MINUTE_USD=...
```

O preco fica fora do repositorio publico.

## Regra de seguranca

Mesmo em `--execute`, o executor consulta `transcription_cache` novamente antes de cada chamada. Se outro processo ja transcreveu o mesmo hash, ele materializa o cache e registra ledger como `cached`, sem chamar OpenAI.

## Proximo passo

Depois de validar uma rodada pequena, criar uma tela interna de custos no frontend para o DM enxergar:

- estimado vs. usado;
- chunks pulados por silencio;
- chunks reaproveitados do cache;
- quanto falta para terminar a sessao;
- alertas quando aproximar do budget mensal.
