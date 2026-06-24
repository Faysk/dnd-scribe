# DnD Scribe — Demo Visual v2

Demo estática em HTML, CSS e JavaScript puro para validar visualmente o projeto **DnD Scribe**.

Esta versão adiciona como feature central:

- segredos por player/personagem;
- diário privado que pode ficar oculto até do DM;
- segredo com DM, elegível a canon;
- segredo compartilhado entre players;
- segredo só do DM;
- separação entre **quem vê no sistema** e **quem sabe dentro da ficção**;
- quadro de canonização com candidatos públicos e privados;
- revisão de transcrição com trechos ocultos conforme permissão;
- tela “Quem sabe o quê”.

## Como abrir

Abra `index.html` no navegador.

Também há um pitch visual em `pitch.html`.

## Como publicar rápido

Pode subir a pasta inteira em Vercel, Netlify, GitHub Pages ou Cloudflare Pages.

## Estrutura

```txt
index.html
pitch.html
styles.css
data.js
app.js
docs/
examples/
```

## Conceito principal

> Nem toda verdade pertence a todos.

O sistema precisa registrar três dimensões de cada informação:

1. **Conteúdo** — o que aconteceu ou foi pensado.
2. **Fonte** — sessão, timestamp, áudio, Roll20, nota ou diário.
3. **Audiência** — quem pode ver no app e quem sabe dentro da ficção.

## Regra de ouro dos segredos

> Todo segredo que quer mudar o mundo precisa passar pelo DM.  
> Todo segredo que só muda o coração do personagem pode ficar privado.

Na demo:

- Diário privado: jogador vê, DM não vê, não é canon.
- Segredo de personagem: jogador + DM, pode virar canon privado.
- Segredo compartilhado: players específicos + DM.
- Segredo do DM: só DM.
- Canon público: mesa toda.
- Bastidor: não canon, publicado só se aprovado.
