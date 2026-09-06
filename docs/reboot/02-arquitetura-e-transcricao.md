# Arquitetura alvo e transcrição

> Status: plano documentado; implementação pendente. Responsável: proprietário e implementador do TDA. Revisão: 2026-09-06.

## Estado desta proposta
A separação de responsabilidades abaixo orienta o reboot. A seleção final de tecnologias e versões passa pelo levantamento da fase R0. Este documento não declara que a arquitetura já foi implementada.

A direção vigente é [100% cloud](registros/operacao-cloud.md), incluindo transcrição. Substitui a arquitetura local-first anterior. O companion atual é legado de transição, não parte obrigatória do destino final.

## Estrutura pretendida
```text
Um repositório TDA
├── apps/web           Home, sessões, resumos, Edit, sessão web e API HTTP
├── processamento     módulo/worker cloud de tarefas longas (localização a definir)
├── local-companion   legado temporário até substituir seus fluxos
├── integrations       adaptadores externos que continuarem necessários
├── supabase           migrações e contratos de dados, se mantido após R0
└── docs/reboot        decisões, plano, evidências e índice vigente

Navegador -> aplicação web única -> autorização, leitura, Edit e publicação
Upload autorizado -> storage privado cloud -> job persistente
Executor cloud -> transcrição/derivados -> storage e banco cloud -> revisão no Edit
PC temporário -> lote autorizado -> importação verificada -> retirada do executor local
```

Web, banco, storage e processamento podem usar serviços distintos da mesma aplicação, no mesmo repositório e com contratos integrados. Isso não cria outro site, cadastro ou editor. O Edit é a interface canônica; a execução de tarefas longas não depende da conexão do navegador nem de uma máquina pessoal.

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

## Persistência e execução cloud
Banco guarda estados, permissões e proveniência; storage privado guarda fontes, transcrições, revisões e artefatos. Discos temporários e caches de executores são descartáveis. Backups e credenciais necessários à recuperação não podem existir exclusivamente no PC.

Jobs longos rodam em executor cloud adequado a duração, CPU/GPU, memória e limites do lote. A camada HTTP agenda e acompanha; não precisa manter uma requisição aberta durante a transcrição. O provider e o modelo serão escolhidos após medir um lote representativo, cotas e custo, sem presumir que Functions web ofereçam recursos suficientes.

Uma fila/registro persistente deve permitir retomar trabalho após reinício, expiração ou indisponibilidade do executor, com tentativas limitadas, deduplicação, checkpoint quando suportado e publicação somente de resultados completos. Os arquivos preservados e o estado durável ficam fora da máquina de execução.

## Apoio local temporário
Permitido para migração, saneamento, compilação e reprocessamento de lotes. Cada uso registra tarefa, entradas/saídas com hashes, autorização, responsável e condição de retirada. O resultado é transferido e reconciliado em cloud antes de considerar o lote concluído. Não expor a máquina por túnel nem torná-la um worker permanente para contornar custo.

No estado final, nenhum fluxo obrigatório chama localhost, rede doméstica, companion ou runner WSL. Desenvolvimento local continua possível; operação e recuperação do produto não dependem dele. A primeira fase pública pode usar resumos existentes sem antecipar a migração de todo o áudio, mas R4 exige concluir os fluxos cloud.

## Compatibilidade durante a troca
A aplicação nova assume capacidades em etapas. Adaptadores necessários entram no [inventário de paridade](07-edit-e-paridade.md) com consumidores, responsável e condição de retirada. Nenhuma remoção operacional antecede a validação da substituição.
