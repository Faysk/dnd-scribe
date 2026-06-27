# 073 - Discord webhook, Craig commands, and CI

Data: 2026-06-27

## Resumo

Foi adicionado webhook do Discord ao ambiente local. Isso e util para notificacoes do DnD Scribe, mas nao permite controlar Craig via slash commands.

Tambem foi criado um workflow de CI especifico para este projeto, em vez dos templates genericos sugeridos pelo GitHub.

## Discord webhook

Webhooks do Discord servem para enviar mensagens para um canal. Eles podem avisar coisas como:

- Upload Craig confirmado.
- Job de ingestao criado.
- Job de extracao finalizado ou falhou.
- Custo estimado antes de uma rodada paga.
- Lembrete para rodar `/join` ou `/stop` manualmente.

Variaveis documentadas:

- `DISCORD_WEBHOOK_URL`
- `DND_DISCORD_WEBHOOK_URL`

Podemos aceitar uma ou ambas; a preferencia futura deve ser `DND_DISCORD_WEBHOOK_URL` para deixar claro que e do projeto.

## Limite importante

Webhook nao executa comandos slash. Portanto ele nao consegue rodar diretamente:

- `/join`
- `/stop`
- `/recordings`
- `/note`
- `/webapp`
- `/server-settings`

Esses comandos sao interacoes do Discord/Craig, nao mensagens comuns de canal. Enviar o texto `/join` por webhook apenas postaria uma mensagem; nao acionaria o Craig.

## Caminhos possiveis para Craig

### Caminho recomendado agora

Manter Craig manual no Discord:

1. DM ou jogador autorizado entra no canal de voz.
2. Roda `/join` pelo proprio Discord.
3. Durante a sessao, usa `/note` quando necessario.
4. Ao fim, roda `/stop`.
5. Baixa o ZIP Craig.
6. Faz upload no DnD Scribe.
7. O site roda ingest/extract em producao.

Esse caminho e simples, seguro e nao exige criar outro bot agora.

### Automacao futura

Para automatizar start/stop de gravacao, as opcoes reais sao:

1. Ver se Craig possui API oficial ou mecanismo suportado para iniciar gravacoes fora do cliente Discord.
2. Criar um bot proprio para coordenar lembretes, botoes e estado da sessao, sem tentar fingir usuario.
3. Criar um gravador proprio no futuro, substituindo Craig, se controle total virar prioridade.

Nao devemos usar user token/self-bot para acionar slash commands. Alem de fragil, isso tende a violar regras da plataforma.

## CI criado

Arquivo criado:

- `.github/workflows/ci.yml`

O workflow roda em `push`, `pull_request` e manualmente via `workflow_dispatch`.

Checks:

- Node 24 com `npm ci`.
- `npm run check:api`.
- `npm run check:workers`.
- `npm run check:web`.
- `npm run build`.
- Verificacao de arquivos em `public`.
- `python -m compileall -q tools` com Python 3.12.

## Por que nao usar os templates sugeridos pelo GitHub

Os templates `Python Package`, `Python Package using Anaconda` e `Python application` sao genericos. O projeto atual e misto:

- Front/API Node em Vercel.
- Scripts Python auxiliares.
- Banco Supabase.
- Storage R2.

Por isso, um CI customizado e menor, mais direto e mais barato de manter.

## Proximo passo

Quando quisermos usar o webhook em runtime, adicionar um helper interno de notificacao em uma function ja existente, sem criar nova Serverless Function. Isso evita bater de novo no limite de 12 functions do Vercel Hobby.
