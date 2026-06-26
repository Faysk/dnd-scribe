# 45 — Resultado da Etapa 17: Worker e Queue Local

## Objetivo

Tirar tarefas longas do request da interface, com uma fila local simples e monitoravel pelo front.

## Decisoes tomadas

- Jobs locais ficam em `tmp/jobs/{job_id}.json`.
- O servidor local carrega jobs antigos na inicializacao.
- Job que estava `running` durante reinicio vira `failed`.
- Upload Craig passa a criar job assíncrono por padrao.
- A aba `Operacao` mostra jobs locais recentes.
- A Vercel expõe `/api/jobs` como leitura vazia/controlada, pois jobs rodam localmente.

## Arquivos alterados

- `api/[...path].js`
- `tools/serve_frontend.py`
- `web/app.js`
- `web/styles.css`
- `docs/23_plano_de_execucao_por_etapas.md`
- `docs/35_roadmap_proximas_10_etapas.md`
- `docs/45_resultado_etapa_17_worker_queue_local.md`

## Endpoints

```txt
GET /api/jobs
POST /api/ingest/craig
```

Quando `POST /api/ingest/craig` recebe `async=true`, responde:

```txt
202 Accepted
job.status=queued|running
```

## Validacao

```bash
npm run check:api
npm run check:web
python3 -m py_compile tools/serve_frontend.py
npm run build
python3 tools/serve_frontend.py --host 127.0.0.1 --port 8795
curl -F zip=@/tmp/craig-mini-etapa16.zip -F sourceSessionId=smoke-etapa-17-job -F chunkSeconds=600 -F skipChunks=true -F async=true http://127.0.0.1:8795/api/ingest/craig
```

Resultado:

```txt
job_created=202
job_status=succeeded
chunks=0
has_error=false
GET /api/jobs=200
deploy_vercel=ok
/api/jobs_vercel=200_vercel_readonly
/api/ingest/craig_multipart_vercel=501_controlado
app_js_tem_monitor_jobs=true
```

## Riscos e residuos

- Ainda e uma fila local simples, nao um worker separado com processo independente.
- Jobs de transcricao/classificacao/publicacao ainda nao foram plugados.
- Nao ha retry manual pela UI ainda.
- Para ZIPs grandes, o upload ainda passa pelo processo do servidor local antes de entrar no job.

## Proximo passo recomendado

Adicionar jobs para transcrever, importar no Supabase, subir para R2, classificar IA e regenerar publicacoes em cadeia operacional.
