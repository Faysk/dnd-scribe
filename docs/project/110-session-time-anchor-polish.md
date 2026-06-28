# Etapa 110 — Ancora temporal da sessao

Data: 2026-06-28

## Objetivo

Preparar o projeto para testes reais sincronizando fala, Discord, Roll20 e futuros anexos no mesmo relogio da sessao.

## Entrega

A tela `Sessoes` agora permite definir `started_at`:

- ao criar uma sessao;
- ao editar uma sessao existente;
- com botao `Usar agora`;
- com botao para limpar a ancora.

A API de sessoes aceita `startedAt`/`started_at` e normaliza a data/hora para timestamp ISO antes de persistir em `sessions.started_at`.

## Impacto na timeline

A timeline agora informa se a sessao esta ancorada:

- com ancora: Discord pode calcular `startMs` real a partir de `started_at`;
- sem ancora: eventos externos ficam menos confiaveis e o site avisa o operador.

O payload de `/api/timeline` tambem inclui `session.startedAt`.

## Impacto na sincronizacao Discord

A sincronizacao do Discord passa a ignorar mensagens anteriores ao inicio real da sessao por padrao. Isso evita que historico antigo caia em `00:00:00` e polua a timeline.

Quem estiver operando pode marcar `Incluir antes do inicio` para importar mensagens anteriores quando fizer sentido.

## Custo

Sem custo de OpenAI.

O ajuste e apenas metadado operacional e consulta/gravacao normal no banco.

## Proximas etapas

1. Testar criando uma nova sessao real e clicar `Usar agora` no inicio da partida.
2. Sincronizar Discord durante/depois da sessao e validar se os itens caem no tempo correto.
3. Adicionar ancoras equivalentes para Roll20 quando o chat importado tiver horario absoluto.
4. Mostrar um trilho visual de "marcadores de sessao" na timeline.
5. Permitir ajustar offset manual por fonte se Craig, Discord e Roll20 ficarem alguns segundos desalinhados.
