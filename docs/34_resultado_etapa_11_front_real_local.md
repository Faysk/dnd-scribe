# 34 — Resultado da Etapa 11: Front Real Local

## Objetivo

Criar um front funcional de verdade, rodando localmente, com backend local seguro para falar com Supabase sem expor chaves no navegador.

## Entregas

- App local:
  - `web/index.html`
  - `web/styles.css`
  - `web/app.js`
- Backend local:
  - `tools/serve_frontend.py`

## Como rodar

```bash
python3 tools/serve_frontend.py --port 8787
```

Abrir:

```txt
http://127.0.0.1:8787
```

## O que a app faz

- Lista sessoes reais do Supabase.
- Abre a sessao real `craig-AdabEqbzngmT-stage1-full`.
- Mostra KPIs reais:
  - segmentos;
  - participantes;
  - candidatos IA;
  - decisoes salvas;
  - decisoes locais.
- Review Board real:
  - filtro por texto;
  - filtro por speaker;
  - filtro por status;
  - detalhe de segmento;
  - status local;
  - correcao de personagem/texto/nota.
- Candidatos:
  - canon;
  - falas;
  - bastidores;
  - botoes de decisao por tipo.
- Publicacoes:
  - mostra pacote `review_only`;
  - mostra previews de markdown.
- Musicas:
  - mini-player flutuante global;
  - usa embed oficial do YouTube;
  - permite ouvir pelo site sem extrair audio;
  - tem play/pause, anterior/proxima, volume e exibicao da playlist.
- Operacao:
  - resumo Supabase;
  - log local;
  - pacote de decisoes local.

## Backend local

Rotas principais:

```txt
GET  /api/health
GET  /api/sessions
GET  /api/session
GET  /api/review-template
POST /api/review-decisions/apply
POST /api/publications/rebuild
```

O backend usa:

- `tools/export_review_board_data.py`
- `tools/export_review_decision_template.py`
- `tools/apply_review_decisions.py`
- `tools/build_session_publications.py`

O backend tambem mantem cache local curto para acelerar testes repetidos da mesma sessao:

- `/api/sessions`: 15 segundos;
- `/api/session`: 60 segundos;
- cache invalidado apos aplicar decisoes ou reconstruir publicacoes.

## Validacao

Endpoints:

```txt
/api/sessions -> 1 sessao real
/api/session -> 41 segmentos, 5 candidatos IA
/api/review-template -> 1 segmento, 5 candidatos
```

Navegador/Playwright:

```json
{
  "sessionButtons": 1,
  "metrics": 6,
  "templateSegments": 1,
  "templateCandidates": 5,
  "localDecisionText": "0\\ndecisoes locais",
  "publicationsVisible": true,
  "errors": []
}
```

Resumo final no Supabase:

```json
{
  "reviewDecisions": 2,
  "canonApproved": 0,
  "quoteApproved": 0,
  "outtakeApprovedAll": 0,
  "approvedPublications": 0,
  "publications": [
    {
      "visibility": "review_only",
      "status": "draft",
      "count": 1
    }
  ]
}
```

## Decisao tecnica

Nao usamos Vercel nesta etapa.

Motivo:

- front local precisa evoluir rapido;
- backend local pode usar `.env.local`;
- service role/DB URL ficam no servidor;
- transcricao/worker continuam fora de serverless;
- deploy vem depois, com Auth/RLS planejado.

## Proximo passo recomendado

Auth/RLS:

- Supabase Auth com Google;
- `profiles.id` alinhado a `auth.users.id`;
- policies por campanha/role;
- endpoints publicos separados de operacao administrativa;
- manter pipeline pesado em worker local/VPS.

## Extensoes da etapa

- `docs/36_resultado_etapa_11_palco_musicas.md`
- `docs/37_resultado_etapa_11_performance_local.md`
