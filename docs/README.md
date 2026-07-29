# Documentação do DnD Scribe

Este índice aponta para o que deve ser lido agora. Documentos antigos continuam
no repositório como histórico, mas não definem automaticamente a arquitetura
atual.

## Agora

| Documento | Status | Uso |
| --- | --- | --- |
| [64 — Arquitetura local-first](64-arquitetura-local-first.md) | proposta recomendada | decisão de limites entre PC e nuvem |
| [65 — Plano de migração](65-plano-migracao-local-first.md) | em execução | fases, critérios e ordem |
| [66 — Resultado da Fase 1](66-resultado-fase-1-local-first.md) | concluída | fundação local validada com sessão real |
| [67 — Resultado da Fase 2A](67-resultado-fase-2a-central-local.md) | concluída | catálogo, fila, metadados e revisão local |
| [68 — Central Local em produção](68-deploy-central-local-producao.md) | publicada | interface Vercel conectada ao PC |
| [69 — Artes das sessões](69-session-artwork-library.md) | implementada | originais, otimização e URLs públicas |
| [00 — Visão geral](00_visao_geral.md) | válida | propósito do produto |

## Componentes em revisão

| Documento | Status |
| --- | --- |
| [03 — Arquitetura geral](03_arquitetura_geral.md) | cloud-first histórico |
| [07 — Transcrição e IA](07_transcricao_e_ia.md) | transcrição OpenAI sendo substituída |
| [10 — Storage, queues e workers](10_storage_queues_workers.md) | R2/queues deixando de ser requisito |
| [35 — Roadmap anterior](35_roadmap_proximas_10_etapas.md) | expansão pausada |

## Evidência real mais recente

- transcrição local:
  `E:\Project\craig-to-text\data\sessions\AY2M6WBqKgq9`;
- publicação manual:
  `lore/03_sessoes/25-07-2026`;
- diagnóstico de egress:
  proteções em `web/app.js`, `api/[...path].js` e
  `tools/check_egress_guards.js`.

## Regra para novos documentos

Cada etapa nova deve registrar apenas:

- objetivo;
- decisão;
- arquivos alterados;
- validação com dado real;
- medidas de tempo, bytes e custo;
- riscos restantes;
- próximo passo.

Se um documento perder validade, ele deve receber um aviso no topo e apontar
para o substituto. Não apagar histórico técnico útil.
