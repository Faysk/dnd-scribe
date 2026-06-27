# 098 - Roll20 events review tab

## Objetivo

Expor no site de producao os eventos Roll20 ja persistidos por sessao, sem depender de ferramenta local e sem custo de IA.

## Implementado

- Aba principal `Roll20` no app em `/`.
- Listagem filtravel por texto e tipo de evento.
- Cards com tipo, speaker, personagem, origem e linha bruta do Roll20 quando disponivel.
- Resumo lateral com contagem total, canon, DM e acoes.
- Contador de eventos Roll20 na lista/catalogo de sessoes.
- Link direto para `/roll20.html` para validar ou gravar novos eventos.

## Decisoes

- Eventos Roll20 continuam sendo materia-prima de review.
- Nada vira canon automaticamente.
- Nenhuma IA paga foi adicionada.
- Nenhum schema novo foi criado; usamos `roll20_events` ja existente.
- A leitura segue o mesmo `GET /api/session` protegido por login e papel aprovado na campanha.

## Validacao feita

- `npm run check:api`
- `npm run check:web`
- `npm run build`

## Proximas 10 etapas

1. Publicar em producao e confirmar deploy `READY`.
2. Confirmar `/` serve o bundle com aba `Roll20`.
3. Testar com DM logado depois de gravar um evento real.
4. Adicionar acoes de review no card: aprovar, rejeitar, converter.
5. Converter `canon_candidate` em `canon_candidates`.
6. Converter `dm_backstage_note` em nota privada/review interno.
7. Converter `character_action_candidate` em entrada de diario ou resumo de personagem.
8. Ligar `audio_processing_hint` a fila de audio sem custo pago automatico.
9. Registrar auditoria visual do import: ator, horario e origem.
10. Criar smoke autenticado com rollback para persistencia Roll20.
