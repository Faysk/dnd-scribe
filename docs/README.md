# Documentação do DnD Scribe

## Direção vigente — reboot TDA

O plano ativo está em [Reboot TDA](reboot/README.md). Ele consolida as decisões do proprietário sobre dados preservados, tecnologias nas versões mais recentes, main/Production, Preview, site público primeiro e Edit integrado depois.

O destino final é [operação 100% cloud](reboot/registros/operacao-cloud.md). PC/WSL/companion só podem apoiar tarefas temporárias; o plano local-first abaixo é histórico.

Comece pelo [roadmap](reboot/10-roadmap-e-aceite.md), pela [política de versões](reboot/03-stack-e-atualizacoes.md) e pelo [estado atual](reboot/11-estado-riscos-e-decisoes.md).

**As seções seguintes são o índice histórico anterior. Seus estados de execução não definem o reboot.** A modernização pública 0–15 e a modernização total anterior tinham escopos diferentes; nenhum encerramento anterior representa conclusão do plano novo.

Este índice aponta para o que deve ser lido agora. Documentos antigos continuam no repositório como histórico, mas não definem automaticamente a arquitetura atual.

## Histórico — modernização do app público

Estado atual: **blocos não-Vercel preparados até a Fase 15; release candidate/homologação/cutover permanecem em standby de plataforma**.

| Documento | Status | Uso |
| --- | --- | --- |
| [Modernização — Roadmap mestre](modernizacao/README.md) | execução avançada | estado real, fases, gates e Definition of Done |
| [00 — Escopo e princípios](modernizacao/00-escopo-e-principios.md) | aprovado | feature freeze e limites |
| [01 — Baseline atual](modernizacao/01-baseline-atual.md) | congelado | comportamento que não pode regredir |
| [02 — Arquitetura alvo](modernizacao/02-arquitetura-alvo.md) | implementada em grande parte | stack e fronteiras |
| [03 — Roadmap por fases](modernizacao/03-roadmap-fases.md) | execução | sequência e gates |
| [04 — Design system e UX](modernizacao/04-design-system-e-ux.md) | implementado | identidade dark/light |
| [05 — Plano de migração](modernizacao/05-plano-de-migracao.md) | execução | coexistência incremental |
| [06 — Matriz de paridade](modernizacao/06-matriz-de-paridade.md) | automação consolidada | legado x novo + pendências reais |
| [07 — Qualidade, segurança e a11y](modernizacao/07-qualidade-seguranca-a11y.md) | bloco técnico concluído | testes, auth, RLS e a11y |
| [08 — Cutover e estabilização](modernizacao/08-cutover-estabilizacao.md) | preparação | mudança reversível |
| [09 — Relatório final](modernizacao/09-relatorio-final-template.md) | template | encerramento formal |
| [37 — Execução da Fase 11](modernizacao/37-fase-11-paridade-execucao.md) | automação verde | matriz multi-browser e blockers honestos |
| [38 — Performance](modernizacao/38-fase-10-performance-execucao.md) | técnico concluído | otimizações e benchmark pendente |
| [39 — Corpus real](modernizacao/39-fase-11-corpus-homologacao.md) | congelado | sessões reais para homologação |
| [40 — Homologação preparada](modernizacao/40-fase-12-homologacao-preparada.md) | pronta para RC | roteiro humano/autenticado |
| [41 — Cutover readiness](modernizacao/41-fase-13-cutover-readiness.md) | preparado | gateway, rotas, smoke e rollback |
| [42 — Runbook de estabilização](modernizacao/42-fase-14-estabilizacao-runbook.md) | pronto | operação pós-cutover |
| [43 — Relatório final draft](modernizacao/43-fase-15-relatorio-final-draft.md) | pré-preenchido | fatos já provados + campos de produção |
| [44 — Standby Vercel](modernizacao/44-standby-vercel.md) | ponto de retomada | único ledger dos gates externos restantes |
| [ADRs da modernização](modernizacao/adr/README.md) | accepted | decisões arquiteturais formais |

### Feature freeze

Enquanto este roadmap estiver ativo, não entram personagens, NPCs, lore editável, galerias, coleções, timeline, relações ou grafo. A expansão funcional terá roadmap próprio somente após a modernização ser marcada como concluída.

## Histórico — fundação preservada para migração

| Documento | Status | Uso |
| --- | --- | --- |
| [64 — Arquitetura local-first](64-arquitetura-local-first.md) | substituída | referência histórica de fluxos/dados |
| [65 — Plano de migração](65-plano-migracao-local-first.md) | substituído | fases do escopo anterior |
| [66 — Resultado da Fase 1](66-resultado-fase-1-local-first.md) | concluída | fundação local validada |
| [67 — Resultado da Fase 2A](67-resultado-fase-2a-central-local.md) | concluída | catálogo/fila/revisão local |
| [68 — Central Local em produção](68-deploy-central-local-producao.md) | publicada | interface Vercel conectada ao PC |
| [69 — Artes das sessões](69-session-artwork-library.md) | implementada | originais/otimização/URLs |
| [70 — Importação nativa do ZIP](70-importacao-zip-craig.md) | implementada | seletor/cópia/amostra |
| [71 — Upload de imagens](71-upload-imagens-sessao.md) | implementada | seleção/otimização/upload |
| [72 — Companion Windows e permissões](72-companion-windows-e-permissoes.md) | implementada | instalador/GPU/acessos |
| [00 — Visão geral](00_visao_geral.md) | válida | propósito do produto |

## Componentes em revisão

| Documento | Status |
| --- | --- |
| [03 — Arquitetura geral](03_arquitetura_geral.md) | cloud-first histórico |
| [07 — Transcrição e IA](07_transcricao_e_ia.md) | transcrição OpenAI sendo substituída |
| [10 — Storage, queues e workers](10_storage_queues_workers.md) | R2/queues deixando de ser requisito |
| [35 — Roadmap anterior](35_roadmap_proximas_10_etapas.md) | expansão pausada |

## Regra para novos documentos

Cada etapa nova deve registrar:

- objetivo;
- decisão;
- arquivos alterados;
- validação com dado real quando disponível;
- medidas de tempo, bytes e custo quando aplicável;
- riscos restantes;
- próximo passo.

Se um documento perder validade, deve receber aviso e apontar para o substituto. Não apagar histórico técnico útil.
