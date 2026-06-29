# 159 - Monitoring Route Readiness

## Objetivo

Promover a validacao de rotas criticas de producao para a lista de prontidao operacional do monitoramento tecnico.

## Contexto

Depois do problema em que uma rota protegida retornou 404 em producao, a checagem profunda passou a validar rewrites e endpoints esperados. Esta etapa deixa esse resultado visivel na mesma lista onde acompanhamos login, banco, R2, Discord, Roll20, supervisor Craig, fila e custo.

## Mudanca

- `lib/monitoring.js` agora inclui o item `route-compatibility` em `readiness.items`.
- Em modo normal, o item orienta rodar a verificacao profunda.
- Em modo profundo, o item reflete o status do check real de rotas de producao.
- O check segue sem expor segredo e sem exigir usuario autenticado; endpoints protegidos continuam esperados como `401`, nao `200`.

## Rotas cobertas pelo check profundo

- `/api/auth-config` deve responder `200`.
- `/api/health` deve responder `200`.
- `/api/monitoring` deve responder `401` sem sessao.
- `/api/roll20-bridge/config` deve responder `401` sem sessao.
- `/api/pipeline-control?sourceSessionId=route-smoke` deve responder `401` sem sessao.

## Resultado operacional

A central tecnica passa a mostrar falha de rewrite/protecao como problema de prontidao, antes de depender de teste manual no navegador ou de erro percebido durante uma sessao real.
