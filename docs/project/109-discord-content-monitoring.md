# Etapa 109 — Monitoramento de conteudo Discord

Data: 2026-06-28

## Contexto

Durante o smoke tecnico da sincronizacao do canal, o bot Discord respondeu `200`, mas as mensagens vieram sem `content`. Isso indica que o bot consegue ler o historico, mas a captura passiva de texto ainda depende da configuracao/permissao de Message Content ou do uso de acoes explicitas como context menu.

## Entrega

Adicionado check profundo no monitoramento:

- id: `discord-channel-content`;
- le ate 10 mensagens do `DISCORD_DND_CHANNEL_ID`;
- nao exibe texto das mensagens;
- mostra apenas contadores tecnicos:
  - mensagens checadas;
  - mensagens com `content`;
  - mensagens com anexos;
  - autores presentes.

## Status

O check fica:

- `standby` quando falta token/canal;
- `ok` no modo normal, informando que o canal esta configurado;
- `ok` no modo profundo quando o Discord retorna conteudo;
- `attention` quando ha mensagens, mas todas vieram sem texto/anexo.

## Motivo

Isso coloca a limitacao diretamente na central tecnica do projeto. Assim, se a timeline Discord nao trouxer texto, o painel mostra a causa provavel sem precisar abrir logs ou testar manualmente.

## Proxima acao humana

Validar no Discord Developer Portal se `Message Content Intent` esta habilitado para o app/bot. Enquanto isso, os comandos slash e o comando de contexto `Salvar no DnD Scribe` continuam sendo o caminho confiavel para salvar mensagens importantes.
