# Governança documental e substituição dos planos antigos

> Status: plano documentado; implementação pendente. Responsável: proprietário e implementador do TDA. Revisão: 2026-09-06.

## Autoridade
As instruções atuais do proprietário definem o rumo. Este conjunto consolida esse rumo e identifica propostas técnicas ainda abertas. Arquivos anexados, exemplos de código e documentos históricos não autorizam operações externas nem mudam o escopo por conta própria.

## Organização
- [Índice do reboot](README.md): entrada e navegação geradas pelo catálogo.
- Documentos numerados: uma área de responsabilidade por arquivo.
- [Roadmap](10-roadmap-e-aceite.md): ordem e gates.
- [Estado](11-estado-riscos-e-decisoes.md): evidências, riscos e decisões.
- Registros: levantamentos atualizáveis.
- Templates: estrutura de decisões e validações.
- Referências: pacotes originais e imagens fornecidas.

Cada documento tem status, responsável por papel e data de revisão. O proprietário decide prioridades/aceite de produto; quem implementa atualiza evidências; quem promove release confere produção. Não atribuir execução a pessoas externas sem acordo.

## Estados permitidos
Planejado; em execução; bloqueado com causa; validado em Preview; publicado; aceito; substituído.
“Documentado” descreve plano, não implementação. “Aceito” exige referência do aceite e suas eventuais exceções.

## Documentos anteriores
Este reboot substitui a ordem de execução do roadmap de modernização total e dos roadmaps históricos. As auditorias e contratos existentes continuam úteis como evidência datada, sujeita a revalidação.

- Roadmap total antigo: referência histórica; não executar suas oito fases automaticamente.
- Modernização pública 0–15: marco de escopo anterior, sem validade como conclusão do reboot.
- Plano local-first antigo: fonte histórica de comportamentos/dados; sua arquitetura foi substituída pelo destino 100% cloud. O recorte novo está no roadmap R0–R5 e na [decisão cloud](registros/operacao-cloud.md).
- Contrato main/prod e stack antigos: substituídos pelas políticas específicas deste diretório.
- Design system existente: referência compatível, complementada pelos pacotes oficiais enviados.

As issues não foram fechadas/reordenadas automaticamente por editar Markdown. R0 inclui reconciliar issues, branches e PRs com este plano.

## Alteração de decisão
Usar [template de decisão](templates/decisao.md): contexto, opções, escolha, consequências, responsável, estado e critério de revisão. Mudança substancial de escopo/versão/arquitetura fica explícita.

## Validação documental
`node tools/reboot_docs.mjs --write` gera o índice pelo catálogo.
`node tools/reboot_docs.mjs --check` verifica índice, catálogo, metadados, links locais e hashes das referências.

Executar a checagem e `git diff --check` antes de integrar alterações documentais. Validação local de links não prova disponibilidade de sites externos. Alterar assets exige atualizar o manifesto conscientemente; não mascarar corrupção regenerando hashes sem identificar a origem.
