# DnD Scribe Demo v3

Demo visual e clicável do projeto **DnD Scribe**, feita em HTML, CSS e JS puro.

## Objetivo

Validar com a mesa a experiência visual e funcional antes de construir o backend real.

A demo simula:

- Login Google por usuário.
- DM Yuhara.
- Renan como Dandelion.
- Arthur como Astel e dono do Roll20 Pro.
- Fernanda como Screacky.
- Segredos por player/personagem.
- Diário pessoal visível para dono e DM/lore admin, mas não para outros jogadores.
- Segredos com DM, compartilhados e DM-only.
- Separação entre “quem vê no sistema” e “quem sabe na ficção”.
- Revisão de transcrição com canon candidato, bastidor, segredo e fala marcante.
- Matriz “Quem sabe o quê”.
- Pipeline de captura/transcrição/auditoria/publicação.

## Como abrir

Abra `index.html` no navegador.

Ou suba a pasta em qualquer hosting estático:

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

## Arquivos principais

```txt
index.html          Demo clicável
pitch.html          Tela de apresentação para a mesa
css/styles.css      Visual completo
js/data.js          Dados mockados da campanha, usuários e permissões
js/app.js           Renderização e interações
docs/               Documentação do conceito
examples/           Exemplos técnicos para implementação real
```

## Regra central

> Nem toda verdade pertence a todos.

## Regra operacional

> Segredo sem DM é diário. Segredo com DM é munição narrativa.

No MVP alinhado, o DM tem acesso completo como guardião da lore. Diário pessoal não é canon automático, mas fica disponível para organização narrativa.

## Aviso

Esta demo não tem backend nem autenticação real. O “login Google” é simulado via localStorage.
