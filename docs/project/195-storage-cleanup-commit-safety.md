# 195 - Storage cleanup commit safety

## Contexto

A primeira limpeza real da sessao `manual-2026-07-01-20260701-sessao-235100` apagou com sucesso:

- `50` objetos;
- `406011339` bytes;
- `4` `raw_track_flac`;
- `46` `speech_slice_wav`;
- `0` falhas.

Depois disso ainda restavam muitos `speech_slice_wav` pequenos. O worker tinha duas caracteristicas conservadoras:

- limite maximo efetivo de `50` objetos por run;
- commit no banco somente ao fim do lote.

## Decisao

O worker de cleanup agora:

- limita cada run a no maximo `200` objetos;
- faz `commit` apos cada objeto processado em execucao real;
- preserva dry-run com rollback;
- mantem a exigencia `execute=true` + `confirm=DELETE_READY_R2`.

Isso reduz a janela de inconsistencia entre apagar no R2 e registrar `deleted` no banco. Tambem diminui a quantidade de workflows necessarios sem virar um apagamento massivo.

## Auditoria

O `tools/audit_production_session.js` agora mostra no modo humano:

- artifacts por tipo/status;
- cleanup por readiness;
- ledger de IA.

Assim o operador consegue ver storage/custo sem precisar abrir JSON gigante.
