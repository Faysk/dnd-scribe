# 47 — Resultado da Etapa 19: Discord/Craig Operacional

## Objetivo

Reduzir risco de nick/faixa errada antes da proxima sessao, permitindo revisar o mapa Craig pela UI local.

## Decisoes tomadas

- O mapa Craig continua em `config/craig_user_map.json`.
- A edicao do mapa e local-only.
- O backend local cria backup antes de salvar alteracoes.
- A Vercel responde erro controlado para `/api/craig-map`.
- A aba `Sessoes` ganhou painel `Mapa Craig`.
- O painel permite editar faixa, pessoa, personagem padrao, aliases, role e status.

## Arquivos alterados

- `api/[...path].js`
- `tools/serve_frontend.py`
- `web/app.js`
- `web/styles.css`
- `README.md`
- `docs/23_plano_de_execucao_por_etapas.md`
- `docs/35_roadmap_proximas_10_etapas.md`
- `docs/47_resultado_etapa_19_discord_craig_operacional.md`

## Endpoints

```txt
GET /api/craig-map
POST /api/craig-map/update
```

## Validacao

```bash
npm run check:api
npm run check:web
python3 -m py_compile tools/serve_frontend.py
npm run build
python3 tools/serve_frontend.py --host 127.0.0.1 --port 8796
GET http://127.0.0.1:8796/api/craig-map
```

Resultado:

```txt
api_craig_map_local=200
tracks=5
has_faysk=true
build=ok
deploy_vercel=ok
app_js_tem_craig_map_ui=true
/api/craig-map_vercel=501_controlado
```

## Riscos e residuos

- Nao testei `POST /api/craig-map/update` para nao criar alteracao falsa no mapa.
- Falta detectar automaticamente convidados a partir do ZIP real novo e sugerir inclusao.
- Falta checklist pre-sessao no front.
- Falta registro do link/arquivo Craig da sessao.

## Proximo passo recomendado

Adicionar importacao conservadora de historico Markdown sem contaminar canon aprovado.
