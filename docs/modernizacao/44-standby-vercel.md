# 44 — Standby Vercel — gate externo restante

Status: **STANDBY**  
Data: **2026-09-04**

## Objetivo

Concentrar em um único lugar tudo que ainda depende de um release candidate real na Vercel e do movimento posterior do domínio.

Todo item que não depende disso deve ser resolvido antes de acrescentar novos blockers a esta lista.

## Estado preparado

```txt
app Next implementado                    ✅
design system                            ✅
auth SSR                                 ✅
Home / arquivo / resumo / transcrição    ✅
qualidade/security/a11y automatizadas    ✅
performance técnica                      ✅
matriz multi-browser                     ✅
corpus real                              ✅
gateway em código                        ✅
namespace /api/web                       ✅
cutover runbook                          ✅
rollback runbook                         ✅
estabilização runbook                    ✅
relatório final draft                    ✅
produção antiga preservada               ✅
```

## Gate A — novo RC

Quando a quota/plataforma permitir:

```txt
[ ] publicar SHA verde mais recente
[ ] registrar deployment ID
[ ] registrar URL
[ ] confirmar Next 16 / Node 24
[ ] confirmar envs públicas do Supabase
[ ] confirmar DND_LEGACY_ORIGIN
[ ] configurar/confirmar redirects permitidos para a URL do RC
[ ] smoke sem sessão
```

## Gate B — sessão real

```txt
[ ] Google OAuth
[ ] Discord OAuth
[ ] refresh/restauração
[ ] authorized membership
[ ] pending membership quando disponível
[ ] profile/avatar/capabilities
[ ] cookies HTTPS
```

## Gate C — paridade real

Usar `39-fase-11-corpus-homologacao.md`:

```txt
[ ] Home real
[ ] /sessoes real
[ ] resumo recente
[ ] resumo longo
[ ] transcrição longa
[ ] busca
[ ] speaker filter
[ ] combinação
[ ] clear
[ ] cursor/progressive load
[ ] fallback carregar mais
[ ] download .md
[ ] hash bridge
[ ] erro/retry
```

## Gate D — visual/a11y/performance

```txt
[ ] dark desktop
[ ] light desktop
[ ] dark mobile
[ ] light mobile
[ ] zoom 200%
[ ] mobile real quando disponível
[ ] benchmark legado x Next — 3 runs/mediana
[ ] nenhuma regressão crítica não justificada
```

## Gate E — gateway real

```txt
[ ] /api/web/* continua local
[ ] /api/* legado chega ao upstream
[ ] /edit funciona
[ ] /central-local funciona
[ ] Permissions-Policy local-network preservada
[ ] /terms
[ ] /privacy
[ ] /linked-role
[ ] /docs/api
[ ] nenhum self-loop
[ ] cookies/Authorization/Set-Cookie corretos
```

## Gate F — aprovação da homologação

```txt
[ ] critical = 0
[ ] high = 0
[ ] medium aceitos/corrigidos
[ ] owner aprova RC
```

## Gate G — cutover

```txt
[ ] preparar callback do domínio final
[ ] registrar estado do legado
[ ] abrir logs Next + legado
[ ] mover dnd.faysk.dev
[ ] executar smoke matrix imediata
[ ] manter ou rollback
```

## Gate H — estabilização

Após cutover:

```txt
[ ] iniciar janela mínima
[ ] registrar uso real
[ ] monitorar auth/BFF/gateway/legado
[ ] confirmar crons/jobs
[ ] confirmar integrações
[ ] critical/high = 0 ao encerrar
```

## Gate I — encerramento

```txt
[ ] preencher campos de produção do doc 43
[ ] decidir destino do frontend legado
[ ] registrar gateway restante
[ ] fechar dívidas
[ ] revisar ADRs/docs
[ ] publicar relatório final
[ ] marcar MODERNIZAÇÃO: COMPLETA
```

## Regra

Não marcar nenhum item acima por inferência. A automação e os runbooks já preparados reduzem o trabalho futuro, mas os checks de plataforma/uso real exigem evidência real.

Este arquivo é o ponto de retomada quando o standby da Vercel terminar.
