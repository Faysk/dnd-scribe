# 200 - Roll20 silent DOM capture

Data: 2026-07-02

## Problema observado

O DM recebeu mensagens tecnicas longas no chat do Roll20, por exemplo
`DND_SCRIBE_EVENT:%7B...`. Isso aconteceu porque o fluxo legado usava o proprio
chat do Roll20 como transporte entre Mod/API e navegador do GM.

Esse transporte era funcional, mas fragil para producao: se a extensao nao
estivesse carregada, estivesse atrasada ou houvesse script antigo duplicado, o
pacote tecnico ficava visivel para o DM.

## Decisao

O fluxo normal passa a ser:

1. Extensao Chrome observa novas mensagens/rolagens no DOM do Roll20.
2. Extensao monta eventos compativeis com `/api/roll20-bridge`.
3. Extensao envia lotes com `ROLL20_BRIDGE_TOKEN`.
4. API grava em `roll20_events` para a timeline.

O Mod/API continua disponivel, mas o transporte por chat fica desligado por
padrao. Para liga-lo manualmente:

```text
!dndscribe transport on
```

Use isso somente em diagnostico controlado.

## Mudancas implementadas

- Extensao `1.1.0`:
  - captura direta por DOM;
  - painel mostra `Captura: DOM direto`;
  - so captura DOM quando `sourceSessionId` e token estao configurados;
  - mantem fila local e retry;
  - continua escondendo pacotes legados `DND_SCRIBE_EVENT` quando eles
    aparecem.
- Mod/API `1.1.0`:
  - `chatTransport` desligado por padrao;
  - `!dndscribe on` nao envia mais pacotes pelo chat sozinho;
  - `!dndscribe off` tambem desliga transporte legado;
  - `!dndscribe transport off` e o comando de emergencia.
- Tutoriais:
  - fluxo normal nao pede mais `!dndscribe on`;
  - emergencia orienta remover scripts antigos duplicados.

## Operacao recomendada

Antes da sessao:

```text
!dndscribe transport off
!dndscribe off
```

Durante a sessao:

- manter a extensao carregada no navegador do GM;
- confirmar `Captura: DOM direto`;
- enviar um comando pequeno de teste;
- acompanhar fila e resultado no painel.

Se aparecer `DND_SCRIBE_EVENT`:

1. rode `!dndscribe transport off`;
2. rode `!dndscribe off`;
3. remova scripts antigos duplicados em Roll20 Mod/API Scripts;
4. cole novamente o Mod `1.1.0+`;
5. recarregue a extensao e o editor Roll20.
