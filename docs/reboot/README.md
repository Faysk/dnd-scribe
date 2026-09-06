# Reboot TDA — documentação e roadmap

> Status: fundação web implementada; migração e publicação integrada pendentes. Responsável: proprietário e implementador do TDA. Revisão: 2026-09-06.

Este é o ponto de entrada vigente para o reboot. Consolida as decisões do proprietário e substitui a sequência dos planos antigos, preservados como histórico. Não declara migração, backup, configuração de ambientes ou deploy concluídos.

**Direção:** site e Edit em cloud; transcrição pesada no PC, modernizando o fluxo que funciona; dados preservados; tecnologias na última versão estável verificada, com exceção Node 24 aprovada para hosting gratuito; main = Production; Preview = homologação; outras branches temporárias; Home/sessões/resumos antes do Edit integrado; novas funcionalidades depois da base completa.

## Comece por aqui

1. [Produto e escopo](01-produto-e-escopo.md).
2. [Roadmap e critérios de aceite](10-roadmap-e-aceite.md).
3. [Estado, riscos e decisões abertas](11-estado-riscos-e-decisoes.md).

## Índice de módulos

| Documento | Conteúdo |
| --- | --- |
| 01 | [Produto e escopo do reboot](01-produto-e-escopo.md) |
| 02 | [Arquitetura alvo e transcrição](02-arquitetura-e-transcricao.md) |
| 03 | [Stack e política de versões mais recentes](03-stack-e-atualizacoes.md) |
| 04 | [Git, ambientes e publicação](04-git-ambientes-e-publicacao.md) |
| 05 | [Preservação dos dados, migração e recuperação](05-dados-migracao-e-recuperacao.md) |
| 06 | [Identidade e primeira entrega pública](06-identidade-e-site-publico.md) |
| 07 | [Edit integrado e inventário de paridade](07-edit-e-paridade.md) |
| 08 | [Qualidade, segurança e operação](08-qualidade-seguranca-e-operacao.md) |
| 09 | [Lore temporária e expansão futura](09-lore-temporaria-e-expansao.md) |
| 10 | [Roadmap de execução e critérios de aceite](10-roadmap-e-aceite.md) |
| 11 | [Estado, riscos e decisões abertas](11-estado-riscos-e-decisoes.md) |
| 12 | [Governança documental e substituição dos planos antigos](12-governanca-documental.md) |

## Registros e referências

- [Registro de versões](registros/versoes.md).
- [Inventário e paridade](registros/inventario.md).
- [Evidência da entrega documental](registros/entrega-documental.md).
- [Fundação web e hospedagem gratuita](registros/fundacao-web.md).
- [Exceção Node 24 para hospedagem gratuita](registros/node24-gratuito.md).
- [Site em cloud, transcrição pesada no PC](registros/operacao-cloud.md).
- [Template de evidência](templates/evidencia.md).
- [Template de decisão](templates/decisao.md).
- [Pacotes oficiais e referências visuais](referencias/README.md).
- [Índice geral da documentação](../README.md).

## Próxima execução

Concluir R0: inventário de dados e fluxos, baseline da transcrição local, consulta de versões oficiais, backup/restauração isolada e isolamento dos dados de Preview. A localização de lore/pipipi permanece pendente para sua publicação auxiliar.

## Manutenção

Índice gerado de catalogo.json por node tools/reboot_docs.mjs --write. Verificar com node tools/reboot_docs.mjs --check e git diff --check. Editar os módulos e o catálogo; não editar este índice manualmente.
