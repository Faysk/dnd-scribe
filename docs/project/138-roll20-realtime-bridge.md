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

## Decisao inicial

Nao vamos guardar cookie/senha Roll20 no servidor nem depender de scraping server-side.

O caminho inicial escolhido foi uma ponte em duas camadas:

1. Roll20 Mod/API captura `chat:message` e gera pacotes tecnicos.
2. Browser bridge no tab do GM le esses pacotes e faz `POST /api/roll20-bridge`.

Isso usa a captura mais rica do Roll20 sem colocar credenciais Roll20 em Vercel.

## Revisao de producao

Em teste real, o transporte por chat gerou mensagens visiveis para o DM quando
o navegador nao escondia os pacotes a tempo. A decisao revisada e:

1. A extensao Chrome faz a captura principal diretamente pelo DOM do chat do
   Roll20.
2. O Mod/API continua instalado apenas como fallback/debug.
3. O transporte legado `DND_SCRIBE_EVENT` fica desligado por padrao e so deve
   ser ligado com `!dndscribe transport on` quando houver diagnostico
   controlado.

## Implementado

- `integrations/roll20/dnd-scribe-mod.js`
  - script para instalar em Roll20 Mod/API;
  - observa `chat:message`;
  - gera `sourceEventId` idempotente por sequencia persistida em `state.DndScribeBridge`;
  - mantem o transporte por whisper tecnico desligado por padrao.
- `integrations/roll20/chrome-extension`
  - extensao local para rodar no tab Roll20 do GM;
  - observa novas mensagens do chat/rolagens pelo DOM;
  - ainda esconde pacotes `DND_SCRIBE_EVENT` legados quando aparecerem;
  - mantem fila local com retry;
  - envia lotes para producao com `Authorization: Bearer <ROLL20_BRIDGE_TOKEN>`.
- `web/roll20-bridge.js`
  - bookmarklet/userscript legado para leitura de pacotes `DND_SCRIBE_EVENT`.
- `web/roll20-bridge.html`
  - pagina operacional com token, sessao alvo, extensao e procedimento de uso.
- `POST /api/roll20-bridge`
  - rota CORS restrita ao Roll20/site/localhost;
  - exige `ROLL20_BRIDGE_TOKEN`;
  - persiste em `roll20_events` usando o mesmo caminho idempotente do import Roll20;
  - calcula `approxStartMs` por `created_at_roll20 - sessions.started_at` quando possivel.

## Operacao

No Roll20:

- instalar o Mod script;
- usar `!dndscribe transport off` para garantir legado quieto;
- usar `!dndscribe off` para pausar;
- usar `!dndscribe status` apenas para verificar estado do Mod.

No navegador do GM:

- abrir a campanha no editor;
- carregar a extensao Chrome local;
- informar `sourceSessionId` da sessao atual e token;
- deixar o painel pequeno ligado durante a sessao com `Captura: DOM direto`.

## Seguranca

- A rota nao usa sessao Supabase porque roda a partir de `app.roll20.net`.
- A rota exige token dedicado, revogavel em ambiente.
- O token tem escopo pratico restrito a ingestao Roll20.
- Sem token correto, retorna 401; sem token configurado, retorna 409.

## Limites

- A ponte depende do tab Roll20 do GM aberto.
- Se o navegador fechar antes de enviar a fila, a fila fica no `localStorage` daquele navegador.
- Se Roll20 mudar radicalmente o DOM do chat, a extensao pode precisar ajuste de leitura.
- O fallback por `DND_SCRIBE_EVENT` ainda existe, mas deve ser usado apenas em
  debug porque pode aparecer no chat do GM.
- O fallback manual `/roll20.html` continua disponivel.

## Proximas melhorias

1. Criar token por sessao no banco em vez de token unico de ambiente.
2. Status da ponte na tela de monitoramento: ultimo pacote, fila, ultima falha.
3. Conversao direta de evento Roll20 em nota/canon pelo inspector da timeline.
4. Teste guiado em producao com uma sessao pequena e rollback de eventos se necessario.
