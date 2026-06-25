# 29 — Resultado da Etapa 6: Review Board MVP

## Objetivo

Criar uma primeira tela real de revisão para navegar pelos segmentos transcritos, corrigir informações e marcar decisões antes de entrar na etapa de IA de canon.

## Entregas

- Exportador local de dados do Supabase:
  - `tools/export_review_board_data.py`
- Payload local gerado:
  - `data/review_session.generated.js`
- Tela `Review Board` integrada ao `index.html`.
- Estilos responsivos para desktop e mobile em `css/styles.css`.
- Decisões locais salvas no navegador via `localStorage`.

## Comando de export

```bash
python3 tools/export_review_board_data.py
```

Resultado:

```txt
out=data/review_session.generated.js
session=craig-AdabEqbzngmT-stage1-full
segments=41
participants=5
recording_files=15
words=6691
```

O arquivo gerado fica ignorado pelo Git porque contém transcrição real da mesa.

## Funcionalidades

- Busca por texto, speaker, personagem e tags.
- Filtro por speaker/faixa.
- Filtro por status de revisão.
- Timeline por timestamp.
- Lista de segmentos com speaker, personagem, chunk e contagem de palavras.
- Painel de decisão com fonte e caminhos R2.
- Correção local de personagem/speaker.
- Correção local de texto transcrito.
- Nota local de revisão.
- Ações:
  - aprovar;
  - marcar como canon candidato;
  - marcar como fala;
  - marcar como bastidor;
  - marcar como privado;
  - rejeitar.

## Validação

Servidor seguro usado para teste:

```txt
tmp/review-board-public
```

A pasta servida contém apenas HTML/CSS/JS e o export gerado, sem `.env`.

Smoke test desktop:

```txt
title=Review Board
segments=41
timeline=41
detail=true
hero=true
localStorage_save=true
console_errors=0
```

Smoke test mobile:

```txt
width=390
scrollWidth=390
overflow=false
segments=41
title=Review Board
console_errors=0
```

Screenshots locais:

```txt
tmp/review-board-desktop.png
tmp/review-board-mobile.png
```

## Limites conscientes

- As decisões ainda não são persistidas em `review_decisions`.
- O board não toca áudio ainda.
- URLs assinadas do R2 não aparecem direto na UI por segurança.
- A classificação por IA ainda não roda; status é decisão humana/local.

## Proximo passo recomendado

Etapa 7: IA de classificacao e candidatos.

O ideal é gerar candidatos iniciais a partir dos 41 segmentos e jogar tudo de volta para revisão humana, sem publicar nada automaticamente.
