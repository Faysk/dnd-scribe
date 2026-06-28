# Etapa 124 - Extracao Craig resumivel por faixa

## Objetivo

Tornar a etapa `cloud_extract_craig_tracks` auditavel e retomavel por faixa.

Antes desta etapa, o job ja pulava arquivos existentes em `recording_files`, mas o operador nao tinha uma visao granular de qual faixa estava pendente, rodando, concluida ou com falha. Em ZIPs grandes, isso deixava o retry opaco.

## Entregas

- Nova migracao: `schemas/20260628_019_craig_track_extraction_steps.sql`.
- Nova tabela: `craig_track_extraction_steps`.
- Nova view: `craig_track_extraction_summary`.
- Worker `api/jobs/run-cloud-extract.js` passa a marcar cada faixa como:
  - `pending`;
  - `running`;
  - `succeeded`;
  - `failed`;
  - `skipped`.
- Endpoint `/api/jobs` passa a retornar `trackSummary` quando o job tem progresso por faixa.
- Tela de jobs exibe barra de progresso, contadores e linhas de faixas pendentes/falhas.

## Como o retry funciona

1. O worker le o ZIP Craig e monta o plano de faixas.
2. Cada faixa planejada vira uma linha em `craig_track_extraction_steps`.
3. Antes de extrair, a faixa fica `running`.
4. Ao gravar o FLAC individual no R2 e registrar `recording_files`, a faixa vira `succeeded`.
5. Se uma faixa falhar, ela vira `failed` com erro proprio, e o job inteiro fica `failed`.
6. Ao tentar novamente, o worker pula qualquer faixa que ja tem `recording_files` e processa apenas o que ainda nao concluiu.

Isso evita reprocessar faixas ja extraidas e reduz operacoes R2 desnecessarias.

## Custo

Esta etapa continua com OpenAI `$0`.

O custo e apenas operacional de R2:

- leitura de ranges do ZIP;
- escrita de cada FLAC individual;
- consultas pequenas no banco.

## Limites atuais

- O worker processa no maximo 3 faixas por chamada.
- O padrao da UI continua 1 faixa por chamada para manter execucoes pequenas em Vercel.
- ZIP64 ainda nao e suportado no worker cloud.
- Esta etapa ainda nao apaga ZIP ou FLAC original.

## Importante para producao

Esta etapa e pre-requisito para a politica de limpeza.

So devemos apagar ou compactar artefatos quando houver evidencia por faixa de que:

- todas as faixas esperadas foram extraidas;
- os artefatos permanentes compactos existem;
- transcript/chunks/slices necessarios foram gerados;
- nenhum job critico esta `failed`, `running` ou `retrying`.

## Proximo passo

Etapa 125: definir e implementar a politica de compactacao/retenção dos artefatos de audio permanentes, separando o que e temporario, o que e reprocessavel e o que precisa ficar para timeline/audicao.
