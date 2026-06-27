# 100 - Roll20 note status badge

## Objetivo

Evitar que o DM transforme o mesmo evento Roll20 em nota varias vezes sem perceber.

## Implementado

- O payload de `/api/session` agora anexa `note` em cada item de `roll20Events` quando ja existe `table_notes.source_id='roll20-note:<event_id>'`.
- O card da aba Roll20 mostra badge `nota <status>`.
- Quando a nota ja existe, o botao principal vira `Nota criada` e fica desabilitado.
- Foi adicionada acao `Copiar nota` para copiar o ID da nota gerada.

## Custo

- OpenAI: USD 0.
- Apenas um `left join` no carregamento autenticado da sessao.

## Proximas etapas sugeridas

1. Adicionar filtro `Com nota` / `Sem nota` na aba Roll20.
2. Adicionar link direto para abrir a nota no diretorio de notas.
3. Criar smoke autenticado com rollback para conversao real em producao.
