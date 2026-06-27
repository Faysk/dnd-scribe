# 102 - Roll20 synchronized timeline foundation

## Objetivo

Sincronizar capturas da mesa no mesmo eixo temporal da sessao: audio/transcricao, comandos Roll20, conversa comum e rolagens/dados.

## Implementado

- O parser Roll20 compartilhado agora entende horario no inicio da linha, como `[21:04]` ou `21:04`.
- A ferramenta Roll20 ganhou campo `Inicio da sessao` para calcular `approxStartMs` relativo ao audio.
- A ferramenta Roll20 pode capturar conversa comum e rolagens/dados, alem dos comandos `!dnd`.
- Novos tipos normalizados:
  - `roll20_chat_message` para conversa comum;
  - `roll20_dice_roll` para rolagens/dados detectados;
  - tipos anteriores de comandos continuam iguais.
- A API de ingestao Roll20 aceita `includePlain`, `includeRolls` e `syncStartClock`.
- Eventos persistidos em `roll20_events` agora gravam `approx_start_ms` quando calculavel.
- A home ganhou aba `Timeline`, misturando `transcript_segments` e `roll20Events` por tempo.

## Como sincronizar na pratica

1. Anotar a hora real em que a gravacao/sessao começou, por exemplo `21:00`.
2. Colar chat Roll20 com linhas horariadas.
3. Informar `Inicio da sessao` como `21:00`.
4. Validar API e gravar eventos.
5. Abrir a aba `Timeline` para comparar fala transcrita e eventos Roll20.

## Limitacoes atuais

- Se o chat exportado/copiadado nao tiver horario por linha, o evento entra na timeline como `sem hora`.
- A deteccao de rolagem e heuristica. Ela cobre textos com `1d20`, `[[...]]`, `roll`, `rolagem`, `dado/dados`, etc.
- Discord ainda nao entra na timeline. O modelo agora ja comporta essa proxima entrada.

## Custo

- OpenAI: USD 0.
- Apenas parser, UI e gravação de metadados em Supabase.

## Proximas etapas

1. Capturar mensagens do Discord do canal DnD com timestamp.
2. Normalizar eventos Discord para a mesma forma da timeline.
3. Consolidar runner cloud para upload Craig -> manifest -> tracks -> chunks.
4. Adicionar smoke autenticado com rollback para gravacao Roll20 com `approx_start_ms`.
