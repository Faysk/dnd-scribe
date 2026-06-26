# DnD Scribe

Projeto para capturar, transcrever, revisar e publicar memoria de campanha de DnD com auditoria.

## App local real

O front funcional atual roda localmente com backend Python, usando Supabase real sem expor chave sensivel no navegador.

```bash
python3 tools/serve_frontend.py --port 8787
```

Abra:

```txt
http://127.0.0.1:8787
```

Esse app permite:

- listar sessoes reais;
- criar e editar sessoes planejadas;
- enviar ZIP Craig pelo front local para ingestao inicial;
- acompanhar jobs locais de ingestao na aba Operacao;
- revisar o mapa Craig/Discord pela UI local;
- importar eventos `[DND_EVENT]` do Roll20 por parser local;
- importar historico Markdown antigo de forma conservadora;
- preparar canon consolidado a partir de candidatos aprovados pelo DM;
- abrir Review Board com dados do Supabase;
- revisar segmentos;
- manter rascunho local por sessao;
- ouvir a faixa original no timestamp do segmento via URL assinada R2;
- decidir candidatos de canon/fala/bastidor;
- aplicar decisoes pelo backend local;
- regenerar publicacoes;
- baixar template de revisao do DM.
- ouvir a playlist publica do Dandelion em um mini-player flutuante, via embed oficial do YouTube.

## App Vercel operador

URL de producao:

```txt
https://dnd.faysk.dev
https://dnd-scribe-amber.vercel.app
```

A API publicada esta aberta temporariamente para teste. Antes de abrir para jogadores ou dados mais sensiveis, voltar para Auth/RLS ou outra trava de acesso.

Login Google via Supabase Auth ja aparece no painel lateral. O app consulta `/api/auth/me` para mostrar o perfil da mesa vinculado; por enquanto esse login e opcional e nao fecha as rotas da API.

Deploy:

```bash
npm run build
vercel build --prod --yes
vercel deploy --prebuilt --prod --yes
```

No ambiente atual, prefira gerar o prebuilt em `/tmp` para evitar arquivos truncados no drive montado.

## Demo visual v3

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

## Como abrir a demo estática

Abra `index.html` no navegador.

Ou suba a pasta em qualquer hosting estático:

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

## Arquivos principais

```txt
web/                App local real
tools/serve_frontend.py Backend local seguro
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
