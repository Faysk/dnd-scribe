# Etapa 068 - Base de upload Craig em producao via R2

Data: 2026-06-27

## Objetivo

Comecar a remover a dependencia do computador local para sessoes novas.

O foco desta etapa foi permitir que o site em producao receba um ZIP Craig sem mandar o arquivo grande pela Vercel Function. O navegador pede uma URL assinada, envia o arquivo direto para o Cloudflare R2 e confirma o upload no Supabase.

## Decisoes tomadas

- A Vercel continua como painel de operacao, API curta e orquestracao.
- O ZIP grande vai direto para R2 usando presigned `PUT`.
- O Supabase guarda o rastro do upload em `recording_files` e `processing_jobs`.
- Nenhuma chamada paga de IA acontece nesta etapa.
- O job `cloud_ingest_craig` fica criado como fila de producao, mas ainda com `workerStatus=pending_worker_implementation`.
- O mapa Craig passou a abrir em producao em modo leitura, carregando `config/craig_user_map.json` do deploy.

## Arquivos alterados

- `api/[...path].js`
  - adiciona assinatura R2 para `PUT`;
  - adiciona `POST /api/uploads/craig-url`;
  - adiciona `POST /api/uploads/craig-complete`;
  - troca `GET /api/jobs` para ler `processing_jobs` do Supabase;
  - troca `GET /api/craig-map` para retornar o mapa em modo leitura;
  - mantem `POST /api/ingest/craig` bloqueado para evitar upload grande pela Vercel.
- `api/uploads/craig-url.js` e `api/uploads/craig-complete.js`
  - endpoints fisicos finos para a Vercel rotear caminhos aninhados;
  - delegam para o handler principal.
- `web/app.js`
  - troca upload multipart por upload direto R2;
  - mostra jobs de producao;
  - evita polling infinito quando o worker cloud ainda nao existe;
  - mostra mapa Craig em modo leitura.
- `web/index.html`
  - muda a identificacao visual de `Local operator` para `Prod operator`.
- `package.json`
  - atualiza a descricao do projeto.

## Configuracao externa aplicada

Foi aplicada uma regra CORS no bucket R2 pela API oficial da Cloudflare:

```txt
methods=GET,PUT,HEAD
headers=content-type
expose=etag
origins=dnd.faysk.dev + aliases Vercel principais + localhost de teste
```

Isso permite o upload direto do navegador para o R2 sem passar o ZIP pela Vercel Function.

## Fluxo implementado

```txt
Site
  -> POST /api/uploads/craig-url
  -> Supabase cria recording_file + job craig_direct_upload
  -> API devolve signedUrl R2
  -> Browser faz PUT direto no R2
  -> POST /api/uploads/craig-complete
  -> Supabase marca upload como confirmado
  -> Supabase cria job cloud_ingest_craig
```

## Custo desta etapa

IA paga: US$ 0.

Custos possiveis:

- armazenamento R2 do ZIP;
- operacoes R2 de PUT/GET;
- invocacoes curtas da Vercel Function;
- uso normal do Supabase.

No volume da mesa, isso deve ficar muito baixo. A proxima etapa com custo relevante continua sendo transcricao OpenAI, que hoje esta estimada em aproximadamente US$ 0.16 por sessao ja otimizada.

## Validacao feita

```bash
npm run check:api
npm run check:web
npm run build
```

Resultados:

- sintaxe da API OK;
- sintaxe do front OK;
- `web/` sincronizado para `public/` com sucesso.
- rota local `/api/craig-map` testada com mock de `pg`, retornando 5 tracks.
- CORS R2 aplicado com sucesso.
- rota aninhada de upload precisou de endpoints fisicos em `api/uploads/` para evitar 404 da Vercel.
- deploy de producao final: `dpl_CwzDAjkB5FhesZ7bmviqJXb4bWvq`.
- alias final confirmado: `https://dnd.faysk.dev`.
- `GET /api/health`: 200.
- `GET /api/craig-map`: 200, modo `deploy_config_readonly`, 5 tracks.
- `GET /api/jobs`: 200, lendo `processing_jobs` do Supabase.
- `POST /api/uploads/craig-url` com sessao inexistente: 404 JSON da propria API, confirmando roteamento correto.

## Riscos e residuos

- Se aparecer um novo dominio de preview na Vercel, talvez seja necessario adicionar esse origin no CORS do R2.
- O worker cloud ainda nao processa `cloud_ingest_craig`; ele e apenas criado e rastreado.
- O mapa Craig ainda nao e editavel em producao.
- RLS segue aberta por decisao de fase de testes; isso precisa voltar antes de abrir acesso amplo para jogadores.

## Proximo passo recomendado

Implementar o executor cloud do job `cloud_ingest_craig`, com uma primeira versao economica que apenas:

1. baixa o ZIP do R2;
2. extrai manifest e info Craig;
3. registra participantes e arquivos;
4. nao roda transcricao paga ainda.
