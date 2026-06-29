# 143 - Monitoring Roll20 bridge and storage batch

Data: 2026-06-29

## Objetivo

Primeiro lote de codigo do hardening de producao: deixar a central de
monitoramento enxergar a ponte Roll20 e destacar riscos de storage/limpeza.

## Implementado

- Novo grupo de ambiente `roll20-bridge` em `lib/monitoring.js`.
- Novo check `roll20-bridge` para indicar token ausente, presente ou fraco.
- Nova metrica `roll20-bridge-events` baseada em `roll20_events`.
- Prontidao operacional agora inclui:
  - Roll20 automatico;
  - limpeza de storage.
- Recomendacoes agora avisam:
  - token configurado mas nenhum evento real da ponte;
  - objetos prontos para limpeza;
  - objetos bloqueados para limpeza.
- UI do monitor agora mostra no resumo:
  - eventos da ponte Roll20;
  - bytes prontos para limpeza;
  - objetos de limpeza bloqueados.

## Criterio de validacao

- `npm run check:api`
- `npm run check:web`
- `npm run build`
- abrir Monitor no site e rodar verificacao profunda.

## Proxima etapa

Adicionar detalhes clicaveis melhores para limpeza por sessao e um endpoint de
controle operacional para retry/continue/pause em jobs recuperaveis.
