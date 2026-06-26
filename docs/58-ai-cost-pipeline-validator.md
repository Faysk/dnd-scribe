# Etapa 58 - Validador da pipeline de custo AI

## Objetivo

Criar uma checagem de seguranca antes de qualquer chamada OpenAI paga.

Essa etapa existe para evitar tres riscos caros:

- transcrever audio sem hash e perder o reaproveitamento por cache;
- rodar sem estimativa de custo;
- descobrir tabela/coluna faltando depois que o processo pago ja comecou.

## Implementado

Criado `tools/validate_ai_cost_pipeline.py`.

Ele valida:

- `.env.local` com `DATABASE_URL`;
- politica local `config/ai_cost_policy.json`;
- tabelas e colunas necessarias no Supabase;
- sessao especifica, quando informada;
- chunks sem `sha256`;
- limite de chunks e minutos por rodada;
- cache hits antes de calcular candidatos de transcricao.

## Uso basico

Validar estrutura e politica:

```bash
python3 tools/validate_ai_cost_pipeline.py
```

Validar uma sessao especifica:

```bash
python3 tools/validate_ai_cost_pipeline.py craig-session-id
```

Validar exigindo precos locais antes de uma rodada real:

```bash
python3 tools/validate_ai_cost_pipeline.py craig-session-id --require-prices
```

Saida em JSON:

```bash
python3 tools/validate_ai_cost_pipeline.py craig-session-id --json
```

## Custos privados via env

O repositorio publico mantem os custos unitarios como `null` de proposito.

Para estimar localmente sem commitar preco, use variaveis privadas no `.env.local`:

```env
DND_COST_TRANSCRIPTION_AUDIO_MINUTE_USD=0.000000
DND_COST_CLASSIFICATION_INPUT_MTOK_USD=0.000000
DND_COST_CLASSIFICATION_OUTPUT_MTOK_USD=0.000000
DND_COST_SUMMARY_INPUT_MTOK_USD=0.000000
DND_COST_SUMMARY_OUTPUT_MTOK_USD=0.000000
```

Os valores devem ser preenchidos com a tabela atual da OpenAI antes de rodar jobs pagos.

## Regra importante

Chunk sem `sha256` bloqueia a sessao para execucao paga.

Isso e intencional: sem hash, nao existe deduplicacao confiavel nem cache de transcript. O caminho certo e reprocessar ingestao/import para preencher hash e metadados de silencio.

## Proximo passo

Criar o executor real de transcricao em modo economy-first:

- rodar este validador antes;
- consumir apenas chunks planejados como `estimated`;
- consultar o cache novamente imediatamente antes da chamada;
- gravar `transcription_cache` e `ai_usage_ledger`;
- nunca usar modelo premium sem aprovacao explicita do DM.
