# Etapa 56 - Planejador de transcricao sem custo

## Objetivo

Criar a etapa imediatamente anterior a qualquer chamada OpenAI paga.

O planejador olha os chunks no banco e separa:

```text
silencio provavel -> skip
transcript ja existe no cache -> cache hit
sem cache e nao silencioso -> candidato a transcricao
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
- chunks que ainda precisariam de transcricao;
- minutos cobraveis estimados;
- custo estimado quando a tabela de preco local estiver configurada.

## Regra de seguranca

Mesmo com `--write-ledger`, o script nao chama OpenAI. Ele apenas cria um `processing_jobs` de planejamento e linhas em `ai_usage_ledger` com status:

- `skipped`;
- `cached`;
- `estimated`.

## Proximo passo

Criar o executor real de transcricao economy-first. Esse executor deve consumir apenas chunks planejados como `estimated`, consultar o cache novamente antes de chamar OpenAI e gravar custo real quando a API retornar uso.
