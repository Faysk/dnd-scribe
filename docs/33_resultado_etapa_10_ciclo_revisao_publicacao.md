# 33 — Resultado da Etapa 10: Ciclo Revisao/Publicacao

## Objetivo

Fechar o fluxo operacional para o DM revisar, aplicar decisoes reais, regenerar publicacoes e atualizar o Review Board com um comando integrado.

Esta etapa nao aprova canon narrativo sozinha. Ela deixa a maquina pronta para quando o DM bater o martelo.

## Entregas

- Template para revisao do DM:
  - `tools/export_review_decision_template.py`
- Orquestrador do ciclo:
  - `tools/run_review_publication_cycle.py`

## Template de decisoes

Comando:

```bash
python3 tools/export_review_decision_template.py --out tmp/review_decisions_template.json
```

Resultado validado:

```txt
out=tmp/review_decisions_template.json
session=craig-AdabEqbzngmT-stage1-full
source_run_id=classify_candidates_v2_gpt-4o
segment_decisions=1
candidate_decisions=5
```

O template inclui:

- segmentos que precisam de revisao;
- candidatos de canon;
- candidatos de fala;
- candidatos de bastidor;
- `actor.trackKey=renanyuhara` como padrao do DM.

Validação do template em dry-run:

```bash
python3 tools/apply_review_decisions.py tmp/review_decisions_template.json --sql-out tmp/review_decisions_template.sql
```

Resultado:

```txt
actor_resolved=True
segment_decisions=1
candidate_decisions=5
missing_segments=0
missing_candidates=0
```

## Ciclo integrado

Comando:

```bash
python3 tools/run_review_publication_cycle.py --decisions-file tmp/review_decisions_smoke.json --update-db
```

O comando executa:

1. `tools/apply_review_decisions.py`
2. `tools/build_session_publications.py`
3. `tools/export_review_board_data.py`
4. consulta final de resumo no Supabase

## Smoke test

Payload usado:

- `seg_0041` continua `needs_review`;
- `canon_001` continua `candidate`;
- nenhuma aprovacao narrativa foi criada.

Resumo final:

```json
{
  "approved_publications": 0,
  "canon_status": {
    "candidate": 2
  },
  "outtake_status": {
    "candidate": 1
  },
  "publication_status": [
    {
      "count": 1,
      "status": "draft",
      "visibility": "review_only"
    }
  ],
  "quote_status": {
    "candidate": 2
  },
  "review_decisions": 2
}
```

## Como usar em revisao real

1. Abrir o Review Board ou gerar template.
2. DM decide candidatos:
   - canon: `approved`, `rejected`, `private`, `interpretation`, `possible_hook`, `retcon_pending`;
   - fala: `approved`, `rejected`, `private`;
   - bastidor: `approved_by_speaker`, `approved_by_all`, `rejected`, `private`.
3. Salvar/baixar o JSON.
4. Rodar:

```bash
python3 tools/run_review_publication_cycle.py --decisions-file caminho/do/review_decisions.json --update-db
```

## Travas mantidas

- Sem decisao do DM, canon continua `candidate`.
- Fala aprovada nao vira publica automaticamente.
- Bastidor so alimenta publicacao final se estiver `approved_by_all`.
- O navegador continua sem `service_role`.
- O arquivo real exportado do Review Board continua ignorado pelo Git.

## Proximo passo recomendado

Implementar Auth/RLS com cuidado:

- mapear `profiles.id` para `auth.users.id`;
- definir funcoes auxiliares de membership;
- ativar leitura por role/campanha;
- proteger fontes, transcricoes e publicacoes;
- manter scripts locais com service role/DB url para operacao administrativa.
