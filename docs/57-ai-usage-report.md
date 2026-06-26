# Etapa 57 - Relatorio de uso e custo IA

## Objetivo

Dar visibilidade de custo antes de liberar transcricao real em volume.

## Implementado

Criado `tools/report_ai_usage.py`.

Ele consulta:

- `ai_usage_session_summary`;
- `ai_usage_ledger`.

E agrupa custos por:

- sessao;
- provider;
- modelo;
- tipo de operacao;
- status.

## Uso

```bash
python3 tools/report_ai_usage.py
```

JSON:

```bash
python3 tools/report_ai_usage.py --json
```

## Como isso ajuda a economizar

Antes de rodar uma nova transcricao, o operador consegue ver:

- quantos chunks foram estimados;
- quanto foi pulado por silencio;
- quanto veio de cache;
- custo estimado;
- custo real quando existir.

## Proximo passo

Criar o executor economy-first de transcricao, mantendo este fluxo obrigatorio:

```text
manifest importado -> planner -> ledger -> executor somente nos chunks estimated
```
