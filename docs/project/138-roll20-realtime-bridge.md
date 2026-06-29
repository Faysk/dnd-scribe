# 138 - Roll20 realtime bridge

Data: 2026-06-29

## Pesquisa

Referencias oficiais usadas:

- https://help.roll20.net/hc/en-us/articles/360037256714-API-Objects
- https://help.roll20.net/hc/en-us/articles/360037256754-Chat

Pontos confirmados:

- Mod Scripts/API sao recurso de campanhas criadas por assinante Pro ou jogadas em jogo criado por assinante.
- O evento `chat:message` dispara quando uma mensagem de chat chega ao Roll20.
- O payload do evento tem `who`, `playerid`, `type`, `content`, `origRoll`, `inlinerolls`, `rolltemplate`, `target` e `target_name`.
- Mensagens `rollresult`/`gmrollresult` carregam informacao de rolagem.
- `sendChat` suporta `noarchive`, util para saidas tecnicas que nao devem ir para o chat log.

## Decisao

Nao vamos guardar cookie/senha Roll20 no servidor nem depender de scraping server-side.

O caminho de producao escolhido e uma ponte em duas camadas:

1. Roll20 Mod/API captura `chat:message` e gera pacotes tecnicos.
2. Browser bridge no tab do GM le esses pacotes e faz `POST /api/roll20-bridge`.

Isso usa a captura mais rica do Roll20 sem colocar credenciais Roll20 em Vercel.

## Implementado

- `integrations/roll20/dnd-scribe-mod.js`
  - script para instalar em Roll20 Mod/API;
  - observa `chat:message`;
  - gera `sourceEventId` idempotente por sequencia persistida em `state.DndScribeBridge`;
  - envia pacote para o GM via whisper tecnico com `noarchive`.
- `web/roll20-bridge.js`
  - bookmarklet/userscript para rodar no tab Roll20;
  - observa o DOM por pacotes `DND_SCRIBE_EVENT`;
  - mantem fila local com retry;
  - envia lotes para producao com `Authorization: Bearer <ROLL20_BRIDGE_TOKEN>`.
- `web/roll20-bridge.html`
  - pagina operacional com instalacao do Mod e bookmarklet.
- `POST /api/roll20-bridge`
  - rota CORS restrita ao Roll20/site/localhost;
  - exige `ROLL20_BRIDGE_TOKEN`;
  - persiste em `roll20_events` usando o mesmo caminho idempotente do import Roll20;
  - calcula `approxStartMs` por `created_at_roll20 - sessions.started_at` quando possivel.

## Operacao

No Roll20:

- instalar o Mod script;
- usar `!dndscribe status` para verificar;
- usar `!dndscribe off` para pausar;
- usar `!dndscribe on` para religar.

No navegador do GM:

- abrir a campanha;
- clicar no bookmarklet `DnD Scribe Roll20`;
- informar `sourceSessionId` da sessao atual e token;
- deixar o painel pequeno ligado durante a sessao.

## Seguranca

- A rota nao usa sessao Supabase porque roda a partir de `app.roll20.net`.
- A rota exige token dedicado, revogavel em ambiente.
- O token tem escopo pratico restrito a ingestao Roll20.
- Sem token correto, retorna 401; sem token configurado, retorna 409.

## Limites

- A ponte depende do tab Roll20 do GM aberto.
- Se o navegador fechar antes de enviar a fila, a fila fica no `localStorage` daquele navegador.
- Se Roll20 mudar radicalmente o DOM do chat, o Mod continua gerando pacotes, mas o bridge pode precisar ajuste de leitura.
- O fallback manual `/roll20.html` continua disponivel.

## Proximas melhorias

1. Criar token por sessao no banco em vez de token unico de ambiente.
2. Botao no site para gerar/copiar bookmarklet ja com `sourceSessionId` preenchido.
3. Status da ponte na tela de monitoramento: ultimo pacote, fila, ultima falha.
4. Conversao direta de evento Roll20 em nota/canon pelo inspector da timeline.
5. Teste guiado em producao com uma sessao pequena e rollback de eventos se necessario.
