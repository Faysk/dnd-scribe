# 41 — Resultado da Etapa 13: Rascunho Persistente no Review

## Objetivo

Melhorar a UX real de revisao para o DM nao perder decisoes locais ao recarregar ou trocar de aba.

## Decisoes tomadas

- O rascunho fica no `localStorage`, separado por `sourceSessionId` e `runId`.
- O rascunho e restaurado automaticamente ao abrir a sessao.
- Decisoes aplicadas com sucesso limpam o rascunho local.
- O botao `Aplicar decisoes` fica desabilitado quando nao ha rascunho.
- Linhas de segmento e cards de candidato com alteracao local recebem marcador visual.
- A aba de candidatos ganhou filtros por tipo, status e busca textual.

## Arquivos alterados

- `web/app.js`
- `web/styles.css`
- `docs/23_plano_de_execucao_por_etapas.md`
- `docs/35_roadmap_proximas_10_etapas.md`
- `docs/41_resultado_etapa_13_rascunho_review.md`

## Como funciona

Chave local:

```txt
dnd-scribe:draft:{sourceSessionId}:{runId}
```

Conteudo salvo:

```txt
segmentDecisions
candidateDecisions
savedAt
sourceSessionId
runId
```

## Validacao

```bash
npm run check:web
npm run build
```

Resultado:

```txt
check_web=ok
build=ok
sync_public=ok
deploy_vercel=ok
app_js_tem_rascunho=true
app_js_tem_filtros_candidatos=true
```

## Riscos e residuos

- `localStorage` e por navegador/dispositivo; nao substitui persistencia no Supabase.
- Ainda falta indicador de “salvo no banco” por item individual.
- Ainda falta uma tela dedicada de fontes/audio por timestamp.
- A confirmacao de limpar rascunho usa `window.confirm`, suficiente por enquanto, mas pode virar modal proprio depois.

## Proximo passo recomendado

Adicionar player de audio por timestamp para auditar cada trecho transcrito ouvindo a faixa original.
