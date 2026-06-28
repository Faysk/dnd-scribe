# Etapa 121 - Modelo persistente de artefatos de audio

## Objetivo

Criar uma camada de controle para cada arquivo/objeto relevante da esteira Craig, separando claramente:

- o que e arquivo bruto temporario;
- o que e copia de trabalho;
- o que e referencia permanente compacta;
- o que pode ser apagado depois de sucesso;
- o que esta em hold por revisao ou auditoria.

Sem esse modelo, o R2 vira apenas um balde de objetos. Com esse modelo, cada objeto ganha dono, origem, finalidade e politica de retencao.

## Entrega versionada

- Migracao base: `schemas/20260628_014_audio_artifacts_retention.sql`.
- Migracao corretiva: `schemas/20260628_015_audio_artifact_reclassify.sql`.
- `tools/apply_supabase_schema.py` aplica as migracoes 014 e 015 por padrao.
- Novas tabelas:
  - `audio_artifacts`;
  - `audio_artifact_events`;
  - `audio_retention_policies`.
- Nova view:
  - `audio_artifact_inventory`.
- Backfill inicial a partir de `recording_files`.
- Reclassificacao de artefatos conhecidos que entraram como `other`, como ZIP Craig e transcript markdown/json.

## Status em producao

As migracoes 014 e 015 foram aplicadas com sucesso no Supabase.

Snapshot apos a 015:

| Artefato | Retencao | Objetos | Bytes |
| --- | --- | ---: | ---: |
| `craig_zip` | `delete_after_success` | 2 | 889141420 |
| `raw_track_flac` | `work_temp` | 5 | 122839777 |
| `transcript_source` | `permanent` | 8 | 308686 |
| `craig_info` | `permanent` | 1 | 371 |

A esteira agora enxerga aproximadamente 1.01 GB rastreados, sendo cerca de 889 MB em ZIP Craig temporario. Nada foi apagado ou movido em producao.

## Tabela `audio_artifacts`

Cada linha representa um objeto ou artefato logico de audio/dados:

- sessao;
- arquivo fonte;
- chunk fonte, quando existir;
- job criador;
- objeto pai, quando for derivado de outro;
- bucket/path;
- tipo de artefato;
- classe de retencao;
- status de lifecycle;
- codec, tamanho, duracao, hash e metadados.

A chave `unique (storage_bucket, storage_path)` impede duplicidade para o mesmo objeto.

## Classes de retencao

- `permanent`: dado leve ou essencial, como manifest/transcricao/export.
- `permanent_compact`: audio permanente ja compactado, preferencialmente Opus.
- `review_hold`: precisa de decisao humana antes de apagar.
- `work_temp`: copia de trabalho que deve sumir quando o derivado permanente existir.
- `delete_after_success`: descartavel depois que o job dependente valida sucesso.
- `delete_candidate`: ja pode aparecer na fila de limpeza, ainda sem apagar automaticamente.
- `legal_hold`: bloqueado contra remocao.

## Status de lifecycle

- `planned`: artefato esperado, ainda nao confirmado.
- `active`: existe e esta em uso.
- `superseded`: substituido por outro melhor/compacto.
- `delete_ready`: seguro para entrar em limpeza.
- `delete_queued`: job de limpeza criado.
- `deleted`: objeto removido e auditado.
- `missing`: banco espera o objeto, mas storage nao encontrou.
- `failed`: falhou criacao, compactacao ou verificacao.

## Politicas iniciais

- ZIP Craig: temporario por 7 dias depois de manifest/extracao/compactacao ok.
- FLAC bruto: temporario por 7 dias; alvo e Opus compacto.
- WAV chunk/slice: temporario por 2 dias depois da transcricao validada.
- Opus compacto: permanente.
- Manifest/transcricao/Roll20/Discord: permanentes e leves.
- Desconhecido: `review_hold` por 30 dias.

## Seguranca operacional

Esta etapa nao apaga nada. Ela cria inventario, classificacao e trilha de auditoria.

Delecao real deve ficar para a etapa 129 e precisa passar por:

1. classificacao;
2. validacao de derivado permanente;
3. marcacao `delete_ready`;
4. job de limpeza com log;
5. atualizacao `deleted` apenas depois da confirmacao do storage.

## Consulta de conferencia

```sql
select artifact_type, retention_class, lifecycle_status,
       count(*)::int objects,
       coalesce(sum(size_bytes), 0)::bigint bytes
from audio_artifacts
group by artifact_type, retention_class, lifecycle_status
order by bytes desc;
```

## Proximo passo

Etapa 122: melhorar estados de job e retry por etapa, para que upload, manifest, extracao, compactacao e transcricao possam ser retomados sem repetir tudo.
