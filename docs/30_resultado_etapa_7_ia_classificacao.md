# 30 — Resultado da Etapa 7: IA de Classificacao e Candidatos

## Objetivo

Usar IA para classificar os 41 segmentos reais e gerar candidatos revisaveis de canon, falas e bastidores.

## Entregas

- Migration para metadados de runs IA:
  - `schemas/20260625_002_ai_candidates_extensions.sql`
- Classificador:
  - `tools/classify_session_segments.py`
- Export do Review Board atualizado:
  - `tools/export_review_board_data.py`
- Review Board exibindo:
  - badges de classificacao IA por segmento;
  - cards de candidatos IA;
  - motivo/confiança da IA no painel de detalhe.

## Runs

### v1

```txt
source_run_id=classify_candidates_v1_gpt-4o
segment_classifications=41
canon_candidates=1
quote_candidates=1
outtake_candidates=1
```

Funcionou tecnicamente, mas os candidatos ficaram amplos demais.

### v2 recomendado

```txt
source_run_id=classify_candidates_v2_gpt-4o
segment_classifications=41
canon_candidates=2
quote_candidates=2
outtake_candidates=1
```

Prompt v2 adicionou:

- resposta em pt-BR;
- candidatos atomicos;
- sem resumo generico;
- canon com poucas fontes;
- outtake individual, sem agrupar a sessao inteira.

## Comando

```bash
python3 tools/classify_session_segments.py \
  tmp/sessions/craig-AdabEqbzngmT-stage1-full \
  --update-db
```

Depois:

```bash
python3 tools/export_review_board_data.py
```

## Resultado v2

Distribuicao:

```txt
in_character=20
ooc_chatter=15
dm_narration=6
```

Relevancia de canon:

```txt
high=5
medium=17
low=4
none=15
```

Candidatos gerados:

```txt
canon_001: O Mago Decapitador
canon_002: Dilemas Morais
quote_001: "A violencia e a solucao?"
quote_002: "Isso vai melhorar as coisas?"
outtake_001: Piadas e Comentarios Aleatorios
```

Todos ficam como `candidate`. Nada vira canon automaticamente.

## Persistencia

Tabelas preenchidas:

```txt
segment_classifications
canon_candidates
quote_candidates
outtake_candidates
processing_jobs
```

Os registros usam `source_run_id`, permitindo comparar runs e regenerar uma versao sem apagar historico de outra.

## Validacao UI

Smoke test:

```txt
title=Review Board
segments=41
timeline=41
ai_candidate_cards=5
ai_badges=41
detail_ai=true
console_errors=0
```

Mobile:

```txt
width=390
scrollWidth=390
overflow=false
candidates=5
```

Screenshots locais:

```txt
tmp/review-board-ai-desktop.png
tmp/review-board-ai-mobile.png
```

## Limites conscientes

- A IA ainda nao escreve decisoes finais de review.
- Os candidatos precisam ser revisados pelo DM.
- O Review Board ainda nao persiste a decisao humana no Supabase.
- O algoritmo ainda nao resolve correcoes finas de nomes proprios.

## Proximo passo recomendado

Etapa 8: Publicacao.

Antes de gerar recap final, o ideal e persistir decisoes humanas do Review Board ou criar um comando/script de aprovacao manual para transformar candidatos revisados em publicacoes.
