# 136 - Production review generation worker

## Objetivo

Depois que a transcricao termina, a sessao ainda precisa virar material revisavel:

- classificacao de cada segmento;
- candidatos de canon, falas e bastidores;
- pacote `review_only` para o DM revisar;
- status da sessao em `ready_for_review` quando tudo estiver completo.

Antes desta etapa, esse fluxo existia principalmente como script local. Em producao, sessoes grandes ficavam transcritas mas paradas, porque classificar tudo de uma vez custa contexto, aumenta risco de falha e nao oferece retomada clara.

## Decisao

Criar um worker GitHub Actions dedicado:

- workflow: `.github/workflows/review-generation-worker.yml`;
- script: `tools/run_review_generation_job.py`;
- classificador base: `tools/classify_session_segments.py`.

O worker processa apenas segmentos ainda sem `segment_classifications` para o `source_run_id`. Isso permite continuar em lotes pequenos e retentar uma execucao falha sem apagar lotes concluidos.

## Modos

### Simulacao

Nao chama OpenAI e nao escreve no banco. Serve para validar volume e lote selecionado.

```bash
python3 tools/run_review_generation_job.py craig-BIRq3nIWB4v9 \
  --campaign yuhara-main \
  --batch-size 40 \
  --max-batches 1 \
  --json
```

### Execucao

Chama OpenAI e grava classificacoes/candidatos no banco.

```bash
python3 tools/run_review_generation_job.py craig-BIRq3nIWB4v9 \
  --campaign yuhara-main \
  --batch-size 80 \
  --max-batches 1 \
  --execute \
  --json
```

Quando `pending = 0`, o worker tambem roda `tools/build_session_publications.py --update-db` e atualiza a sessao para `ready_for_review`, preservando sessoes ja `approved`, `published` ou `archived`.

## Painel

O painel de pipeline agora mostra:

- segmentos classificados vs. segmentos uteis;
- total de candidatos gerados;
- pacote de review/publicacoes;
- botao de simulacao;
- botao de execucao com confirmacao explicita `RUN_REVIEW_AI`.

O site dispara o workflow via `GITHUB_WORKFLOW_TOKEN`, igual aos workers de speech, transcricao e cleanup.

## Resumibilidade

O classificador agora aceita:

- `--append-db`: nao apaga resultados anteriores do mesmo `source_run_id`;
- `--candidate-prefix`: evita colisao de IDs como `canon_001` em lotes diferentes;
- upsert por ID estavel para permitir rerun do mesmo lote.

Isso deixa o comportamento esperado:

1. Run falhou antes de gravar: o proximo run pega os mesmos segmentos pendentes.
2. Run falhou depois de gravar parte: o proximo run pula o que ja tem classificacao.
3. Mesmo lote rodou de novo: registros sao atualizados por ID estavel, sem duplicar.

## Validacao inicial

Simulacao read-only em producao para `craig-BIRq3nIWB4v9`:

- segmentos uteis: `1130`;
- classificados: `0`;
- pendentes: `1130`;
- candidatos: `0`;
- publicacoes: `0`;
- lote simulado: `40` segmentos;
- caracteres selecionados: `5691`.

## Proximos cuidados

- Rodar primeiro com lote pequeno para observar qualidade dos candidatos.
- Ajustar `batch_size` se a resposta vier pobre ou se o modelo reclamar de contexto.
- Depois de todos os segmentos classificados, revisar o pacote `review_only` antes de aprovar canon/publicacoes.
- Se o custo de texto crescer, adicionar uma estimativa formal de tokens antes do botao de execucao.
