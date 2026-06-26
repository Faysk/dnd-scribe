# 40 — Resultado da Etapa 12: Perfil Auth Vinculado

## Objetivo

Vincular o login Google real ao perfil da mesa e expor essa identidade no app sem fechar a API ainda.

## Decisoes tomadas

- O login Google continua opcional durante os testes.
- A API continua em `open_test`.
- O perfil autenticado passa a ser consultado por `/api/auth/me`.
- O endpoint valida o JWT no Supabase Auth usando apenas a chave publica/anon.
- A resposta nao devolve segredo nem chave privada.
- O primeiro usuario Google logado foi vinculado ao perfil `faysk`/Renan/Dandelion.

## Arquivos alterados

- `api/[...path].js`
- `api/auth/me.js`
- `api/review-decisions/apply.js`
- `api/publications/rebuild.js`
- `tools/serve_frontend.py`
- `web/app.js`
- `docs/39_resultado_etapa_12_login_google_aberto.md`
- `docs/40_resultado_etapa_12_perfil_auth_vinculado.md`
- `README.md`
- `docs/23_plano_de_execucao_por_etapas.md`
- `docs/35_roadmap_proximas_10_etapas.md`

## Endpoint novo

```txt
GET /api/auth/me
Authorization: Bearer {supabase_access_token}
```

Sem token, responde em modo aberto:

```txt
authenticated=false
profile=null
campaignRole=null
```

Com token valido, responde:

```txt
authenticated=true
profile.displayName=Renan
profile.roll20Name=faysk
profile.defaultCharacterName=Dandelion
campaignRole=player
```

## Comandos usados

```bash
npm run check:api
npm run check:web
python3 -m py_compile tools/serve_frontend.py
python3 tools/serve_frontend.py --host 127.0.0.1 --port 8791
curl -sS http://127.0.0.1:8791/api/auth/me
```

## Validacao

```txt
auth.users=1
perfil_vinculado=faysk
role_campanha=player
check_api=ok
check_web=ok
py_compile=ok
/api/auth/me_sem_token=200
deploy_vercel=ok
app_js_tem_auth_me=true
/api/auth/me_producao=200
/api/review-decisions/apply_dryRun=200
/api/publications/rebuild_dryRun=200
```

## Observacao de deploy

A Vercel atendeu rotas de um segmento pela catch-all `api/[...path].js`, mas `/api/auth/me` retornou 404 no primeiro deploy. Foram adicionados wrappers explicitos para rotas profundas:

```txt
api/auth/me.js
api/review-decisions/apply.js
api/publications/rebuild.js
```

## Riscos e residuos

- API ainda aberta por decisao de teste.
- RLS ainda nao aplicada.
- Apenas o perfil `faysk` esta vinculado a um login Google real.
- Perfis `renanyuhara`, `sunnrq`, `arutorux` e convidados ainda precisam de login/vinculo quando forem testar.
- `profiles` ainda nao tem `updated_at`; por enquanto usamos `last_sign_in_at` para atividade de login.

## Proximo passo recomendado

Seguir para UX real de revisao enquanto a API esta aberta, e deixar RLS como etapa de endurecimento antes de abrir para jogadores ou dados sensiveis.
