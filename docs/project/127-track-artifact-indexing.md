# Etapa 127 - Indexacao de faixas extraidas no inventario

## Objetivo

Garantir que toda faixa Craig extraida para R2 apareca imediatamente em `audio_artifacts`, com politica de retencao e visibilidade no painel de storage.

## Entregas

- `api/jobs/run-cloud-extract.js` agora indexa cada `craig_track` extraido como artefato.
- Faixas `.flac` entram como `raw_track_flac`.
- A classe de retencao vem de `audio_retention_policies`.
- `retention_expires_at` e calculado no insert quando a policy define janela.
- Retencoes manuais fortes (`permanent`, `permanent_compact`, `review_hold`, `legal_hold`) nao sao sobrescritas em reindexacoes.
- A rota tambem reconcilia faixas ja extraidas antes deste ajuste, quando o job Craig roda novamente.

## Por que isso importa

Sem essa indexacao ao vivo, o banco registra a faixa em `recording_files`, mas o painel de custos e cleanup nao enxerga o objeto novo. Isso distorce o total de storage e pode esconder arquivos grandes que precisam virar Opus compacto antes de remover o FLAC bruto.

## Comportamento esperado

1. Faixa e extraida do ZIP para R2.
2. `recording_files` recebe ou atualiza o registro `craig_track`.
3. `audio_artifacts` recebe ou atualiza o artefato correspondente.
4. `audio_artifact_events` registra o evento `created` uma unica vez por artefato.
5. `audio_storage_cleanup_candidates` passa a mostrar a faixa como bloqueada por `compact_audio_missing` ate existir o audio compacto permanente.

## Custo

OpenAI continua em `$0` nesta etapa. O impacto e apenas operacao de banco pequena por faixa extraida ou reconciliada.

## Proximo passo

Concluir a extracao restante da sessao `craig-BIRq3nIWB4v9` e validar se o ZIP fica `delete_ready` apos todas as faixas serem extraidas.
