# 32 — Resultado da Etapa 9: Decisoes Humanas

## Objetivo

Persistir as decisoes humanas do Review Board sem expor `service_role` ou credencial sensivel no navegador.

## Entregas

- Migration:
  - `schemas/20260625_004_review_decisions_extensions.sql`
- Importador local:
  - `tools/apply_review_decisions.py`
- Review Board:
  - exporta decisoes de segmentos e candidatos em JSON;
  - baixa `review_decisions_{session_id}.json`;
  - copia JSON para clipboard/modal;
  - permite decidir candidatos de canon, fala e bastidor.
- Ignore local:
  - `data/review_decisions.generated.json`

## Fluxo

```txt
Review Board local
  -> JSON de decisoes humanas
  -> tools/apply_review_decisions.py
  -> review_decisions
  -> transcript_segments / canon_candidates / quote_candidates / outtake_candidates
```

O frontend continua estatico e sem chave sensivel. A escrita no banco acontece por script local com `.env.local`.

## Payload

Formato esperado:

```json
{
  "schemaVersion": 1,
  "sourceSessionId": "craig-AdabEqbzngmT-stage1-full",
  "aiRunId": "classify_candidates_v2_gpt-4o",
  "actor": {
    "trackKey": "renanyuhara"
  },
  "segmentDecisions": [],
  "candidateDecisions": []
}
```

## Comandos

Aplicar schema:

```bash
python3 tools/apply_supabase_schema.py
```

Dry-run com SQL salvo:

```bash
python3 tools/apply_review_decisions.py tmp/review_decisions_smoke.json --sql-out tmp/review_decisions_smoke.sql
```

Aplicar decisoes:

```bash
python3 tools/apply_review_decisions.py tmp/review_decisions_smoke.json --update-db
```

## Smoke test aplicado

Payload conservador:

- `seg_0041` marcado como `needs_review`;
- `canon_001` mantido como `candidate`;
- ator resolvido como `renanyuhara` / DM.

Resultado do importador:

```txt
actor_resolved=True
segment_decisions=1
candidate_decisions=1
missing_segments=0
missing_candidates=0
```

Resultado no banco depois de repetir o mesmo payload:

```json
{
  "review_decisions_count": 2,
  "segment_0041": {
    "review_status": "needs_review",
    "character_name": "Convidado / indefinido"
  },
  "canon_001_status": "candidate",
  "approved_publications": 0,
  "job_attempts": 2
}
```

Isso valida que a aplicacao e idempotente: repetir o payload atualiza as mesmas decisoes e incrementa o job, sem duplicar registros logicos.

## Regras de status

Canon:

```txt
approved -> approved_canon
rejected -> rejected
private -> private
interpretation -> interpretation
possible_hook -> possible_hook
retcon_pending -> retcon_pending
```

Falas:

```txt
approved -> approved
rejected -> rejected
private -> private
```

Por seguranca, fala aprovada nao vira publica automaticamente. `approved_for_public` continua separado.

Bastidores:

```txt
approved -> approved_by_speaker
approved_by_speaker -> approved_by_speaker
approved_by_all -> approved_by_all
rejected -> rejected
private -> private
```

Somente `approved_by_all` deve alimentar publicacao final de bastidores.

## UI

Smoke em navegador:

```json
{
  "copyVisible": true,
  "downloadVisible": true,
  "candidateVisible": true,
  "filename": "review_decisions_craig-AdabEqbzngmT-stage1-full.json",
  "segmentDecisions": 1,
  "candidateDecisions": 1,
  "actorTrackKey": "renanyuhara",
  "errors": []
}
```

## Proximo passo recomendado

Rodar um ciclo real de revisao:

1. DM revisa alguns candidatos no Review Board.
2. Baixa o JSON de decisoes.
3. Aplica com `tools/apply_review_decisions.py --update-db`.
4. Regenera publicacoes com `tools/build_session_publications.py --update-db`.

Depois disso, a etapa seguinte pode focar em gerar publicacoes finais a partir de itens realmente aprovados.
