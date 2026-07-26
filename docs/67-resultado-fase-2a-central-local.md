# 67 — Resultado da Fase 2A: fundação da Central Local

Data: 26/07/2026.

Status: concluída.

## Objetivo

Transformar `E:\Project\craig-to-text` em uma central operacional persistente
para o PC principal, mantendo áudio e processamento pesado fora de Supabase,
R2 e serviços pagos.

Esta é a fundação da Fase 2. Player FLAC, busca textual, editor de resumo e
publicação assistida permanecem para a Fase 2B.

## Decisões aplicadas

- SQLite local guarda catálogo, metadados e estado dos jobs;
- ZIP, FLAC, transcrição bruta e decisões continuam como arquivos locais;
- a fila sobrevive ao reinício do aplicativo;
- um job interrompido fica visível como falha recuperável;
- não pode existir mais de um job ativo do mesmo tipo para a mesma sessão;
- correções são uma camada de revisão, não uma reescrita de `session.json`;
- os metadados editáveis são título, data jogada, arco e notas;
- o navegador recebe apenas os endpoints locais necessários;
- Docker continua opcional e não faz parte do caminho recomendado.

## Entregas

No `craig-to-text`:

- `app/catalog.py`: catálogo SQLite e fila persistente;
- `app/reviews.py`: decisões e correções em overlay;
- `app/main.py`: APIs de metadados, revisão, jobs e retry;
- `app/health.py`: contagens da fila no diagnóstico;
- `static/index.html`: painel da máquina, editor e diálogo de revisão;
- `static/app.js`: catálogo, jobs, metadados e revisão;
- `static/styles.css`: layout desktop e mobile;
- `tests/test_api.py`: fluxo HTTP local;
- `tests/test_core.py`: persistência, interrupção, retry e preservação do bruto.

Banco local criado:

```txt
data/craig-to-text.sqlite3
tamanho observado=32768 bytes
```

## Contrato de preservação

```txt
session.json
  -> transcrição original, não modificada

review/decisions.json
  -> status, correção e nota do operador

GET /api/sessions/<id>
  -> visão composta para a interface
```

Assim, uma correção pode ser removida ou refeita sem perder o resultado
original do Whisper.

## Validação automatizada

```txt
pytest=9 passed
compileall=ok
javascript_syntax=ok
run_ps1_parse=ok
```

Há um aviso de depreciação entre Starlette TestClient e a versão futura do
HTTPX. Ele não altera o runtime nem os resultados, mas deve ser resolvido em
uma atualização isolada de dependências.

## Validação visual e com dado real

Sessão aberta:

```txt
recording_id=AY2M6WBqKgq9
transcript_segments=3275
review_buttons=3275
raw_transcript_modified=false
```

Verificações:

- painel mostrou CUDA, disco, modelo, caminho, sessões e fila;
- sessão real abriu com metadados, resumo da revisão e transcrição;
- diálogo de revisão abriu com orador e texto corretos;
- nenhuma decisão foi salva durante o smoke test;
- console do navegador ficou sem erros ou avisos;
- a primeira verificação mobile encontrou 6 px de overflow horizontal;
- o CSS foi corrigido e o reteste terminou sem overflow em 375 × 844.

## O que não foi feito

- nenhum áudio foi retranscrito;
- nenhum dado foi enviado à nuvem;
- Supabase, R2 e produção não foram consultados ou alterados;
- nenhum deploy foi realizado;
- o player FLAC com Range ainda não foi incorporado;
- a busca na transcrição ainda não foi incorporada;
- o editor de resumo/publicação ainda não foi incorporado;
- o botão de abrir a pasta da sessão ainda não foi incorporado.

## Próximo passo

Fase 2B, limitada a:

1. busca local sobre a transcrição;
2. player das faixas FLAC locais no timestamp;
3. botão seguro para abrir a pasta da sessão;
4. editor local de resumo e preparação do bundle;
5. novo teste com `AY2M6WBqKgq9`.

Depois disso, a Fase 3 pode introduzir GPT apenas sobre texto, com cache e teto
de custo.
