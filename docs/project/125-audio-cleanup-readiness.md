# Etapa 125 - Readiness de limpeza dos audios

## Objetivo

Reduzir o risco de crescimento descontrolado do R2 sem apagar nada automaticamente.

Esta etapa cria uma camada de decisao: quais artefatos podem ser liberados, quais estao bloqueados e qual evidencia falta.

## Entregas

- Nova migracao: `schemas/20260628_020_audio_cleanup_readiness.sql`.
- Nova migracao corretiva: `schemas/20260628_021_audio_cleanup_success_policy.sql`.
- Nova view: `audio_storage_cleanup_candidates`.
- Monitoramento passa a retornar a metrica `audio-cleanup`.
- Painel de storage mostra:
  - bytes liberaveis com seguranca;
  - bytes bloqueados por falta de evidencia;
  - bytes protegidos por politica permanente/revisao;
  - maiores objetos e seus bloqueios.

## Regras atuais

### ZIP Craig

Pode virar `delete_ready` quando:

- manifest existe e nao esta critico;
- as faixas esperadas foram extraidas com sucesso.

Motivo: depois disso, o ZIP original e redundante para a esteira. O manifest e as faixas extraidas preservam o que precisamos para reprocessar.

Para artefatos `delete_after_success`, a evidencia de sucesso tem prioridade sobre uma janela fixa de dias. Ou seja: se o ZIP Craig ja tem manifest e extracao completa, ele pode ser marcado `delete_ready` imediatamente. A janela de expiracao continua util para copias de trabalho que ainda dependem de outra etapa.

### FLAC bruto por faixa

Fica bloqueado enquanto nao existir audio compacto permanente por faixa.

Motivo: a timeline precisa permitir audicao posterior. Apagar FLAC bruto antes de criar Opus/MP3 compacto deixaria o projeto sem fonte de audio navegavel.

### Chunks e speech slices

Ficam bloqueados enquanto nao houver fonte de transcricao persistida.

Motivo: sao artefatos intermediarios baratos de recriar, mas so devem sair depois que a transcricao estiver validada.

### Manifest, info, Roll20, Discord e transcricao

Ficam protegidos como permanentes ou revisao.

Motivo: sao leves e essenciais para auditoria, timeline e reconstrucao.

## O que esta etapa nao faz

- Nao chama `DELETE` no R2.
- Nao remove linha de `recording_files`.
- Nao apaga sessao.
- Nao compacta audio ainda.
- Nao usa OpenAI.

Ela apenas marca readiness e, quando seguro, muda `audio_artifacts.lifecycle_status` para `delete_ready`.

## Proximo passo

Etapa 126: gerar artefatos compactos permanentes e preparar uma estrategia de playback/timeline que preserve audicao com custo baixo de storage.
