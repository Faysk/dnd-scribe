# Etapa 63 - Painel de custos AI no frontend

## Objetivo

Dar ao DM visibilidade de custo antes de qualquer chamada OpenAI paga.

A tela mostra o estado real da sessao no Supabase:

- work units totais;
- slices de fala;
- chunks fallback;
- itens sem `sha256`;
- cache hits;
- candidatos para transcricao;
- minutos cobraveis;
- ledger estimado/real.

## Implementado

Criado endpoint Vercel:

```text
GET /api/ai-cost?sourceSessionId=...
```

Criados assets frontend:

```text
web/costs.js
web/costs.css
```

Atualizado `web/index.html` para carregar esses assets.

A aba `Custos` e injetada pelo `costs.js`, sem alterar o fluxo principal de review/sessoes.

## Validacao feita

A rota foi testada no deploy Vercel mais recente e respondeu `200`.

Estado atual retornado para `craig-AdabEqbzngmT-stage1-full`:

```text
workUnits=50
speechSlices=0
chunkFallbacks=50
missingHash=50
cacheHits=0
transcribeCandidates=0
fallbackAudioMinutes=459.831
billableAudioMinutes=0
```

Isso confirma que a trava esta funcionando: sem hash, nenhum minuto entra como cobravel.

## Observacao sobre Vercel SSO

A pagina e assets estaticos continuam protegidos por Vercel Authentication. A API protegida foi verificada pelo fetch autenticado da ferramenta Vercel. Nao foi criado link publico temporario.

## Proximo passo operacional

Para mudar o estado real da sessao:

```bash
python3 tools/backfill_audio_metadata.py --source-session-id craig-AdabEqbzngmT-stage1-full --write
python3 tools/build_speech_slices.py craig-AdabEqbzngmT-stage1-full --limit 3 --write
```

Depois disso, a aba `Custos` deve passar de fallback chunks para speech slices e mostrar a reducao de minutos.
