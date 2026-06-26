# Etapa 56 - Planejador de transcricao sem custo

## Objetivo

Criar a etapa imediatamente anterior a qualquer chamada OpenAI paga.

O planejador olha os chunks no banco e separa:

```text
silencio provavel -> skip
transcript ja existe no cache -> cache hit
sem hash -> blocked
sem cache, nao silencioso e com hash -> candidato a transcricao
```

## Implementado

Criado `tools/plan_transcription_job.py`.

Uso:

```bash
python3 tools/plan_transcription_job.py craig-session-id
```

Para gerar job e ledger estimado:

```bash
python3 tools/plan_transcription_job.py craig-session-id --write-ledger
```

## Saida esperada

O script informa:

- total de chunks;
- chunks pulados por silencio;
- chunks reaproveitados do cache;
- chunks bloqueados por falta de `sha256`;
- chunks que ainda precisariam de transcricao;
- minutos cobraveis estimados;
- custo estimado quando a tabela de preco local estiver configurada.

## Regra de seguranca

Mesmo com `--write-ledger`, o script nao chama OpenAI. Ele apenas cria um `processing_jobs` de planejamento e linhas em `ai_usage_ledger` com status:

- `skipped` para silencio e chunks bloqueados;
- `cached` para cache hit;
- `estimated` para candidatos reais de transcricao.

Chunk sem `sha256` nunca vira candidato pago. Sem hash nao temos deduplicacao nem reaproveitamento seguro de transcript.

## Proximo passo

Rodar `tools/validate_ai_cost_pipeline.py` antes do executor real de transcricao economy-first. Esse executor deve consumir apenas chunks planejados como `estimated`, consultar o cache novamente antes de chamar OpenAI e gravar custo real quando a API retornar uso.
