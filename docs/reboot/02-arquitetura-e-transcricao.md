# Arquitetura alvo e transcrição

> Status: plano documentado; implementação pendente. Responsável: proprietário e implementador do TDA. Revisão: 2026-09-06.

## Estado desta proposta
A separação de responsabilidades abaixo orienta o reboot. A seleção final de tecnologias e versões passa pelo levantamento da fase R0. Este documento não declara que a arquitetura já foi implementada.

A [divisão vigente](registros/operacao-cloud.md) mantém site/Edit em cloud e transcrição pesada no PC. O companion é parte permanente da capacidade de processamento, a modernizar; não é obrigatório migrá-lo para executor cloud. Preservar o fluxo atual e comparar resultados antes/depois da atualização tecnológica.

## Estrutura pretendida
```text
Um repositório TDA
├── apps/web           Home, sessões, resumos, Edit, sessão web e API HTTP
├── local-companion    processamento pesado local e persistência operacional
├── integrations       adaptadores externos que continuarem necessários
├── supabase           migrações e contratos de dados, se mantido após R0
└── docs/reboot        decisões, plano, evidências e índice vigente

Navegador -> aplicação web única -> conteúdo compartilhado e autorização
Operador  -> companion local     -> áudio e transcrição pesada
Companion -> publicação autorizada de artefatos necessários -> aplicação web
```

O companion é um componente especializado do mesmo produto. Não justifica outro site, outro cadastro ou outro editor concorrente. O local exato das telas de revisão será definido no inventário: o Edit é a interface canônica e o companion fornece capacidades locais.

## Modelo conceitual mínimo
| Conceito | Papel | Informação que deve sobreviver |
| --- | --- | --- |
| Campanha | Escopo de conteúdo/acesso | Identificador e membros |
| Sessão | Unidade narrativa e operacional | ID estável, data, título, arco, referências |
| Gravação/faixa | Fonte original | Hash, localização, duração, vínculo com sessão |
| Execução de transcrição | Proveniência técnica | Modelo/versão, parâmetros, idioma, estado e data |
| Segmento | Fala com contexto temporal | ID, faixa, timestamps, falante e texto original |
| Revisão | Correção explícita | Antes/depois, responsável, data e origem |
| Publicação | Conteúdo aprovado | Revisão de origem, visibilidade, autor e versão |
| Artefato | Imagem/documento exportado | Tipo, hash, origem e vínculo |
| Decisão editorial | Aprovação, rejeição, interpretação | Justificativa, autor e referência à fonte |

Este é um modelo conceitual, não uma ordem para substituir tabelas em produção.

## Ciclo central
Gravação preservada -> transcrição original -> revisão identificável -> aprovação -> publicação versionada.

- Não sobrescrever a transcrição original ao corrigir texto.
- Reprocessamento gera nova execução/revisão, preservando associação com as anteriores.
- Mudança em trecho de origem pode marcar derivados como necessitando revisão. Não reescreve automaticamente conteúdo aprovado.
- Resumos importados sem proveniência completa mantêm seu conteúdo e registram a lacuna; não inventar referências.
- Nomes normalizados, incertezas e decisões de canon ficam explícitos.
- Publicação não equivale a liberar áudio/transcrição: cada artefato tem visibilidade própria.

## Contratos e módulos
A aplicação web separa HTTP, autorização, regras editoriais e acesso a dados. Entradas externas são validadas e respostas têm contratos documentados. Não criar um novo catch-all com todas as regras antigas.

Processamentos longos usam jobs persistentes com ID, progresso real, erro acionável, cancelamento quando suportado, retry e deduplicação. Uma falha de rede ou repetição de clique não pode publicar duas vezes ou perder progresso silenciosamente.

## Fronteira local
Catálogo, áudio e modelos usam diretórios configuráveis. Não embutir `E:/Project/craig-to-text` como requisito universal. O acesso do site ao companion requer contrato explícito de origem, autorização e diagnóstico. CORS e permissões de rede local não serão considerados resolvidos pelo simples uso de localhost.

A leitura pública e o Edit sobre conteúdo sincronizado continuam disponíveis com o companion desligado. Operações dependentes do executor local aguardam sua disponibilidade. Não exigir upload de todo o áudio bruto para viabilizar Home ou resumos. O site não serve dados do disco pessoal; resultados necessários são enviados por integração autenticada e reconciliados antes de serem exibidos como disponíveis.

## Compatibilidade durante a troca
A aplicação nova assume capacidades em etapas. Adaptadores necessários entram no [inventário de paridade](07-edit-e-paridade.md) com consumidores, responsável e condição de retirada. Nenhuma remoção operacional antecede a validação da substituição.
