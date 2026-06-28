# Etapa 122 - Steps de jobs e retry por etapa

## Objetivo

Fazer a esteira Craig ser retomavel e legivel em producao. Quando uma sessao para no meio, a tela precisa responder rapidamente:

- em qual etapa parou;
- se a etapa e retryable;
- quantas tentativas ja ocorreram;
- qual erro apareceu;
- qual botao faz sentido agora.

## Entregas

- Nova migracao: `schemas/20260628_016_processing_job_steps.sql`.
- Nova tabela: `processing_job_steps`.
- Nova view: `processing_job_step_summary`.
- Backfill dos jobs existentes em uma etapa inicial por `job_type`.
- Novo helper backend: `lib/job-steps.js`.
- Workers Craig atualizam steps:
  - `cloud_ingest_craig` marca `manifest`;
  - `cloud_extract_craig_tracks` marca `extract_tracks`.
- Novo endpoint dentro do catch-all existente:
  - `POST /api/jobs/retry`.
- A UI de jobs mostra steps, tentativas, erro curto e botao `Tentar novamente`.
- A tela de Upload tambem mostra steps dos jobs relacionados.

## Estados de step

- `pending`: etapa ainda aguardando.
- `running`: worker assumiu a etapa.
- `succeeded`: etapa concluida.
- `failed`: etapa falhou.
- `retrying`: etapa foi reenfileirada ou ficou parcial.
- `skipped`: etapa pulada de forma segura.
- `blocked`: etapa bloqueada por decisao/configuracao.

## Retry

`POST /api/jobs/retry` exige `project.jobs.run` no escopo tecnico do projeto. Em ambientes sem RBAC, o fallback legado ainda aceita `owner`/`master`.

Payload:

```json
{
  "campaignSlug": "yuhara-main",
  "jobId": "uuid",
  "reason": "retry_requested_from_ui"
}
```

Comportamento:

- aceita apenas job `failed` ou `cancelled`;
- troca o job para `retrying`;
- limpa `error`;
- limpa `finished_at`;
- registra quem pediu retry no `output`;
- marca steps `failed`/`blocked` como `retrying`;
- cria/atualiza o step `retry_request`.

## Seguranca

Retry nao apaga objetos, nao move storage e nao executa OpenAI. Ele apenas recoloca o job em estado elegivel para o worker apropriado.

Workers continuam sendo executados por endpoints proprios:

- `/api/jobs/run-cloud-ingest`;
- `/api/jobs/run-cloud-extract`.

## Limite conhecido

Os endpoints de worker ainda existem como Functions separadas. A etapa 122 nao cria nova Function, mas tambem nao consolida os workers existentes. Consolidacao futura so vale se a Vercel voltar a ficar apertada no limite de 12 Functions.

## Proximo passo

Etapa 123: fortalecer o contrato de manifest Craig, incluindo schema versionado, campos obrigatorios, validacao de faixas, data logica Europe/London e rastreio de arquivos esperados.
