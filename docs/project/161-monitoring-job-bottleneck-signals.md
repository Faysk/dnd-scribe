# 161 - Monitoring Job Bottleneck Signals

## Objetivo

Deixar o monitoramento tecnico mais preciso para identificar onde a esteira Craig ficou parada depois de um upload.

## Contexto

A producao precisa mostrar gargalos sem depender de terminal. Antes o monitoramento contava jobs em fila, rodando e falhos, mas nao destacava idade da fila nem jobs rodando por tempo demais.

## Mudanca

- A metrica `jobs` agora inclui `retrying`, `runningOver20m` e `oldestActiveAt`.
- O item de prontidao `Workers e fila` considera:
  - falhas nas ultimas 24h como critico;
  - jobs rodando ha mais de 20 minutos como critico;
  - qualquer job ativo em fila, retry ou execucao como atencao.
- As recomendacoes passam a apontar explicitamente quando ha job ativo e ha quanto tempo o mais antigo esta parado/ativo.

## Resultado operacional

Quando uma sessao subir ZIP mas nao continuar o processamento, a central tecnica deve indicar se o gargalo esta em fila, retry, execucao longa ou falha recente, reduzindo a necessidade de investigar direto no banco ou nos logs.
