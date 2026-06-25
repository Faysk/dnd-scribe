# 36 — Resultado da Etapa 11: Palco e Musicas

## Objetivo

Adicionar a playlist publica de musicas do Dandelion no front real local como mini-player flutuante, sem virar uma tela principal e sem baixar/extrair audio do YouTube.

Playlist:

```txt
https://www.youtube.com/watch?v=lMxL4lXlf7E&list=PLu1TRjIhrP64RDxyOvUf1OoCtz2mir86q
```

## Decisao tecnica

Usar embed oficial do YouTube:

```txt
https://www.youtube.com/embed/videoseries?enablejsapi=1&list=PLu1TRjIhrP64RDxyOvUf1OoCtz2mir86q
```

Motivo:

- permite ouvir pelo site;
- mantem a origem publica e o player oficial;
- evita baixar ou extrair audio de video;
- respeita melhor a fonte original;
- funciona sem nova chave/API.
- usa comandos oficiais do iframe para play/pause, volume e faixa anterior/proxima.

Se futuramente existirem arquivos de audio originais/autorizados, eles podem entrar em R2 e ganhar player nativo.

## Entregas

- Mini-player flutuante global no front real local.
- Estado inicial recolhido, sem ocupar a tela.
- Botao para exibir/ocultar informacoes da playlist.
- Iframe oficial carregado sob demanda, apenas quando alguem usa play/anterior/proxima.
- Tela do video escondida no app; a playlist aparece como painel pequeno com link oficial.
- Controles:
  - play/pause;
  - faixa anterior;
  - proxima faixa;
  - baixar volume;
  - subir volume;
  - exibir playlist.
- Link para abrir playlist no YouTube.
- Botao para copiar link.

Arquivos alterados:

- `web/index.html`
- `web/app.js`
- `web/styles.css`

## Validacao

Chrome headless + checks locais:

```json
{
  "musicTab": 0,
  "dockVisible": true,
  "initialState": "collapsed",
  "iframeAtBoot": 0,
  "panelMode": "playlist metadata and official link",
  "controls": ["previous", "play", "next", "volumeDown", "volumeUp", "playlist"]
}
```

Checks:

```bash
node --check web/app.js
python3 -m py_compile tools/serve_frontend.py
```

## Cuidados

- Nao copiar letras completas para o app sem autorizacao.
- Nao extrair audio do YouTube.
- Para audio puro no futuro, preferir arquivos originais/autorizados ou uma fonte que permita embed/audio legalmente.

## Proximo passo recomendado

Quando a parte de entidades/canon estiver mais madura, criar tabela/estrutura para:

- musicas;
- performances;
- vinculo musica -> sessao/cena/personagem;
- status `draft`, `canon_performance`, `outtake`, `private`, `published`.
