# Etapa 111 — Polimento de inspecao da timeline

Data: 2026-06-28

## Objetivo

Deixar a timeline mais util para teste real durante/depois da sessao, reduzindo tempo de procura e dando contexto tecnico dos eventos externos.

## Entrega

A timeline ganhou:

- busca textual por fala, jogador, personagem, Roll20, Discord e IDs de origem;
- seletor de canal para sincronizacao Discord:
  - Mesa DnD;
  - Gravacoes;
  - Logs/Ops;
- controle para incluir ou ignorar mensagens anteriores ao inicio real;
- detalhes de origem no inspector;
- links de anexos Discord quando a API retorna arquivos.

## Custo

Sem custo de OpenAI.

Tudo usa dados ja retornados por `/api/timeline` e pela sincronizacao Discord existente.

## Uso esperado no teste real

1. Criar/abrir a sessao.
2. Definir `Inicio real`.
3. Sincronizar Discord no canal correto.
4. Usar busca para localizar falas, mensagens ou eventos.
5. Abrir itens no inspector para copiar texto, tocar audio ou abrir anexos.

## Proximas etapas

1. Adicionar paginação Discord por `before`/`after` para importar historico antigo em blocos.
2. Criar marcadores manuais na timeline.
3. Mostrar anexos/imagens em preview seguro no inspector.
4. Adicionar ajuste fino de offset por fonte.
5. Criar atalhos para converter evento selecionado em nota/canon/review.
