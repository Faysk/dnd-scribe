# Etapa 114 - Cobertura CI para monitoramento

## Objetivo

Evitar que arquivos criticos da central de monitoramento fiquem fora das checagens automaticas.

## Entregue

- GitHub Actions agora roda:
  - `node --check lib/monitoring.js`
  - `node --check web/monitoring.js`
- Build continua sincronizando `web` para `public`.
- Verificacao de output agora exige:
  - `public/monitoring.js`
  - `public/monitoring.css`

## Motivo

Durante o polimento da Etapa 113, os scripts locais principais nao cobriam a central de monitoramento. Esta etapa adiciona uma rede de seguranca no CI sem mexer no `package.json`, que estava com diferenca de final de linha local.

## Custo

Sem custo operacional. Apenas CI no GitHub Actions.
