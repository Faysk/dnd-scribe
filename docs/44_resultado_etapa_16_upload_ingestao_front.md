# 44 — Resultado da Etapa 16: Upload e Ingestao Craig pelo Front

## Objetivo

Permitir que um ZIP do Craig seja enviado pela interface local e processado pelo pipeline de ingestao ja existente.

## Decisoes tomadas

- Upload/ingestao e local-first.
- A Vercel responde `/api/ingest/craig` com erro controlado, sem tentar processar ZIP grande.
- O backend local salva uploads em `tmp/uploads/craig/`.
- O backend local chama `tools/ingest_craig_session.py`.
- A UI permite selecionar sessao alvo, `chunkSeconds`, `sampleSeconds` e modo `Somente manifest`.
- A etapa ainda nao importa automaticamente para Supabase nem transcreve audio.

## Arquivos alterados

- `api/[...path].js`
- `api/ingest/craig.js`
- `tools/serve_frontend.py`
- `web/app.js`
- `web/styles.css`
- `docs/23_plano_de_execucao_por_etapas.md`
- `docs/35_roadmap_proximas_10_etapas.md`
- `docs/44_resultado_etapa_16_upload_ingestao_front.md`

## Endpoint novo

```txt
POST /api/ingest/craig
Content-Type: multipart/form-data
```

Campos:

```txt
zip
sourceSessionId
chunkSeconds
sampleSeconds
skipChunks
```

## Validacao

```bash
npm run check:api
npm run check:web
python3 -m py_compile tools/serve_frontend.py
npm run build
python3 tools/serve_frontend.py --host 127.0.0.1 --port 8794
curl -F zip=@/tmp/craig-mini-etapa16.zip -F sourceSessionId=smoke-etapa-16-parser -F chunkSeconds=600 -F skipChunks=true http://127.0.0.1:8794/api/ingest/craig
```

Resultado:

```txt
upload_local=200
savedPath=tmp/uploads/craig/...
sessionDir=tmp/sessions/smoke-etapa-16-parser
tracks=0
participants=0
chunks=0
parser_multipart=email.parser
build=ok
deploy_vercel=ok
app_js_tem_ingest_panel=true
/api/ingest/craig_vercel=501_controlado
```

## Riscos e residuos

- Upload real de ZIP grande ainda deve ser testado com a proxima sessao Craig.
- O endpoint local e sincronico; para arquivos grandes a proxima etapa deve virar job/worker.
- O parser multipart atual le o body em memoria; para ZIPs muito maiores, trocar para parser streaming.
- Ingestao ainda nao roda transcricao, import Supabase, R2 ou classificacao.

## Proximo passo recomendado

Criar worker/queue local para transformar upload, ingestao, transcricao, classificacao e publicacao em jobs acompanhaveis pelo front.
