# Documentação do DnD Scribe

Este índice aponta para o que deve ser lido agora. Documentos antigos continuam
no repositório como histórico, mas não definem automaticamente a arquitetura
atual.

## Roadmap ativo — modernização do app público

| Documento | Status | Uso |
| --- | --- | --- |
| [Modernização — Roadmap mestre](modernizacao/README.md) | planejamento aprovado | escopo, fases, gates e Definition of Done |
| [00 — Escopo e princípios](modernizacao/00-escopo-e-principios.md) | aprovado | feature freeze e limites da modernização |
| [01 — Baseline atual](modernizacao/01-baseline-atual.md) | baseline | comportamento que não pode regredir |
| [02 — Arquitetura alvo](modernizacao/02-arquitetura-alvo.md) | proposta para execução | stack e organização do novo app |
| [03 — Roadmap por fases](modernizacao/03-roadmap-fases.md) | execução | sequência, entregas e gates |
| [04 — Design system e UX](modernizacao/04-design-system-e-ux.md) | direção aprovada | identidade dark/light e hierarquia das telas |
| [05 — Plano de migração](modernizacao/05-plano-de-migracao.md) | execução | migração incremental e coexistência com legado |
| [06 — Matriz de paridade](modernizacao/06-matriz-de-paridade.md) | template | checklist legado x novo |
| [07 — Qualidade, segurança e a11y](modernizacao/07-qualidade-seguranca-a11y.md) | requisito transversal | testes, auth, RLS, validação e acessibilidade |
| [08 — Cutover e estabilização](modernizacao/08-cutover-estabilizacao.md) | fase final | deploy reversível e período de estabilidade |
| [09 — Relatório final](modernizacao/09-relatorio-final-template.md) | template | encerramento formal da modernização |
| [ADRs da modernização](modernizacao/adr/README.md) | accepted | decisões arquiteturais formais |

### Feature freeze

Enquanto este roadmap estiver ativo, não entram personagens, NPCs, lore
editável, galerias, coleções, timeline, relações ou grafo. A expansão funcional
terá roadmap próprio somente após a modernização ser marcada como concluída.

## Fundação atual preservada

| Documento | Status | Uso |
| --- | --- | --- |
| [64 — Arquitetura local-first](64-arquitetura-local-first.md) | proposta recomendada | decisão de limites entre PC e nuvem |
| [65 — Plano de migração](65-plano-migracao-local-first.md) | em execução | fases, critérios e ordem |
| [66 — Resultado da Fase 1](66-resultado-fase-1-local-first.md) | concluída | fundação local validada com sessão real |
| [67 — Resultado da Fase 2A](67-resultado-fase-2a-central-local.md) | concluída | catálogo, fila, metadados e revisão local |
| [68 — Central Local em produção](68-deploy-central-local-producao.md) | publicada | interface Vercel conectada ao PC |
| [69 — Artes das sessões](69-session-artwork-library.md) | implementada | originais, otimização e URLs públicas |
| [70 — Importação nativa do ZIP](70-importacao-zip-craig.md) | implementada | seletor do Windows, cópia verificada e amostra automática |
| [71 — Upload de imagens](71-upload-imagens-sessao.md) | implementada | seleção local, otimização WebP e upload autorizado |
| [72 — Companion Windows e permissões](72-companion-windows-e-permissoes.md) | implementada | instalador privado, GPU local e acessos separados |
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
- medidas de tempo, bytes e custo quando aplicável;
- riscos restantes;
- próximo passo.

Se um documento perder validade, ele deve receber um aviso no topo e apontar
para o substituto. Não apagar histórico técnico útil.
