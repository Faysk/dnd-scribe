# Etapa 117 - Polimento final do upload Craig em producao

## Objetivo

Deixar o fluxo de upload Craig pronto para uso real em producao, com feedback visual claro, custo OpenAI explicitamente zero nas etapas de upload/manifest/extracao e tratamento correto de sessoes que atravessam meia-noite.

## Decisoes

- `session_date` representa o dia logico da sessao, derivado do inicio da gravacao em `Europe/London`.
- `started_at` vem do `Start time` do `info.txt` Craig.
- `ended_at` e `duration_ms` sao preenchidos quando a duracao das faixas FLAC pode ser lida pelo `STREAMINFO`.
- Se uma sessao comecar em `2026-06-27 18:00` e acabar em `2026-06-28 02:00`, a `session_date` continua `2026-06-27`.
- O fim tambem pode ser corrigido manualmente na tela de sessoes.

## Implementacao

- O worker `cloud_ingest_craig` faz uma leitura pequena do inicio das faixas FLAC para extrair duracao sem transcrever audio.
- A janela da sessao fica registrada em `metadata.cloud_manifest_only.session_window`.
- O job `cloud_extract_craig_tracks` preserva `durationMs` ao criar `recording_files` das faixas individuais.
- A API de sessoes agora aceita e retorna `endedAt`.
- A tela de ingestao Craig ganhou uma esteira visual:
  - sessao/metadados;
  - upload R2;
  - confirmacao banco/fila;
  - manifest Craig;
  - extracao de faixas;
  - chunks/OpenAI.

## Custo

- Upload R2: sem OpenAI.
- Manifest Craig: sem OpenAI.
- Extracao de faixas: sem OpenAI.
- OpenAI so deve entrar depois de speech slicing/chunks, quando a etapa de transcricao for executada.

## Verificacao esperada

- Upload novo cria sessao pelo ZIP por padrao.
- Manifest deve mostrar `sessionWindow`.
- Sessao cruzando meia-noite deve manter o dia logico do inicio.
- Painel deve apontar claramente qual etapa esta aguardando, rodando, pronta ou concluida.
