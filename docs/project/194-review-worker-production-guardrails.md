# 194 - Review worker production guardrails

## Contexto

A transcricao da sessao `manual-2026-07-01-20260701-sessao-235100` terminou em producao, deixando `620` segmentos uteis para classificacao e review.

Antes de chamar OpenAI para review, revisamos a etapa seguinte e encontramos o mesmo risco operacional que ja havia aparecido no worker de transcricao:

- SQL grande passando por argumento de linha de comando;
- erro transitorio do pool Supabase sem retry;
- risco de URL de banco aparecer em traceback de artifact;
- default de modelo antigo no worker de review.

## Decisao

Foi criado `tools/safe_psql.py` para os workers Python que conversam com Postgres:

- envia SQL via stdin ou arquivo, evitando limite de argumento do sistema operacional;
- aplica retry/backoff para erros transitorios de conexao/pool;
- sanitiza `postgres://...` antes de montar excecoes;
- centraliza o comportamento para review, classificacao e publicacoes.

Tambem atualizamos o default do review para:

- `model = gpt-5.4-mini`;
- `source_run_id = classify_candidates_v2_gpt-5.4-mini`.

O modelo ainda pode ser sobrescrito por `OPENAI_TEXT_MODEL`, input do workflow ou argumento de CLI.

## Validacao

Comandos executados:

```bash
python3 -m py_compile tools/safe_psql.py tools/run_review_generation_job.py tools/classify_session_segments.py tools/build_session_publications.py
npm run check:api
python3 tools/run_review_generation_job.py manual-2026-07-01-20260701-sessao-235100 --campaign yuhara-main --batch-size 80 --max-batches 1 --json
```

Resultado da simulacao:

- segmentos uteis: `620`;
- classificados: `0`;
- pendentes: `620`;
- primeiro lote: `80` segmentos;
- texto selecionado: `10767` caracteres;
- sem chamada OpenAI nesta validacao.

## Operacao recomendada

1. Executar um lote pequeno pago primeiro, com `batch_size=40` e `max_batches=1`.
2. Auditar candidatos gerados e qualidade do pacote.
3. Se a qualidade estiver boa, continuar em lotes de `80` ou `100`.
4. Quando `pending=0`, permitir que o worker gere o pacote `review_only`.
5. So depois rodar limpeza real de storage.

## Proximo polimento

- Adicionar estimativa de custo de texto no painel antes do botao `RUN_REVIEW_AI`.
- Compactar artifact de review caso a lista de resultados cresca demais.
- Mostrar progresso de classificacao por lote na tela de pipeline.

## Incidente no primeiro run amplo

Um run amplo com `batch_size=100` falhou no primeiro lote antes de escrever no banco:

- workflow: `review-generation-worker`;
- run: `28560881083`;
- erro: conexao encerrada pela API antes de resposta (`RemoteDisconnected`);
- impacto: nenhum lote novo persistido, os `40` segmentos do lote pequeno anterior continuaram intactos.

Mitigacao aplicada:

- o classificador agora trata `RemoteDisconnected`, `HTTPException` e `ConnectionError` como erros transitorios retentaveis;
- a retomada recomendada passa a usar lotes menores (`60` ou `80`) quando o texto selecionado estiver alto.
