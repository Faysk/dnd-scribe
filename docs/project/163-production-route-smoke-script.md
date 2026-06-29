# 163 - Production Route Smoke Script

## Objetivo

Adicionar um smoke test rapido para validar rotas criticas de producao depois de deploys ou mudancas em rewrites.

## Contexto

A central de monitoramento profundo ja valida rotas, mas tambem e util ter um comando terminal simples para confirmar que producao nao esta retornando 404 em endpoints importantes. Isso reduz risco de descobrir problema apenas durante uma sessao real.

## Mudanca

- Novo script `scripts/smoke-production-routes.js`.
- Novo comando `npm run smoke:routes`.
- O comando testa rotas publicas e protegidas sem sessao autenticada.
- Rotas protegidas devem responder `401`; esse e o resultado correto.

## Rotas validadas

- `/api/auth-config` -> `200`
- `/api/health` -> `200`
- `/api/monitoring` -> `401`
- `/api/roll20-bridge/config` -> `401`
- `/api/pipeline-control?sourceSessionId=route-smoke` -> `401`

## Uso

```bash
npm run smoke:routes
node scripts/smoke-production-routes.js https://dnd.faysk.dev
```

## Resultado operacional

O operador consegue validar rapidamente se Vercel, rewrites e protecoes basicas continuam coerentes, sem chamar OpenAI, sem executar jobs e sem alterar dados.
