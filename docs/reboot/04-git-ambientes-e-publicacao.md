# Git, ambientes e publicação

> Status: plano documentado; implementação pendente. Responsável: proprietário e implementador do TDA. Revisão: 2026-09-06.

## Política aprovada
| Branch | Ambiente | Duração |
| --- | --- | --- |
| `main` | Production | Permanente |
| `Preview` | Homologação integrada | Permanente |
| `codex/<assunto>` ou nome explícito aprovado | Mudança isolada | Temporária |

O nome `Preview` é sensível a maiúsculas. Não criar outra branch `preview`, `develop` ou um segundo tronco permanente por conveniência.

## Fluxo normal
1. Criar branch temporária a partir de Preview atualizada.
2. Implementar um recorte e abrir PR para Preview.
3. Executar checks e revisar o resultado.
4. Integrar o estado completo de Preview; publicar para homologação somente após fechar e validar a entrega candidata.
5. Abrir PR de promoção Preview -> main.
6. Revalidar o commit resultante em main; iniciar publicação deliberada da release pronta e aguardar deployment terminal.
7. Fazer smoke no domínio e conferir o SHA publicado.
8. Realinhar Preview com main preservando a ancestralidade; evitar squash recorrente na promoção que deixe as branches divergindo artificialmente.
9. Remover branches temporárias após confirmar integração ou abandono e preservar a referência do PR.

Exceção autorizada em 2026-09-06: o proprietário pediu implementação da fundação diretamente em main durante a pausa de uso. A documentação foi integrada por fast-forward e a base é validada antes do push. Esta autorização vale para o bootstrap; o fluxo normal acima continua sendo a regra depois dele. A existência da branch Preview não comprova ambiente isolado implantado.

Node 24 foi aceito pelo proprietário para manter a hospedagem gratuita. Por decisão posterior em 2026-09-06, deployments automáticos por Git ficam desativados em todas as branches e nos dois projetos DnD. Commit, push, merge e CI não são pedidos de publicação.

## Publicar somente uma entrega pronta
Trabalhar e validar o máximo possível antes de consumir uma publicação. “100%” significa cumprir o escopo e os critérios de aceite da entrega, não concluir todas as fases futuras do reboot.

- Agrupar mudanças; não publicar commits intermediários, documentação isolada ou cada ajuste de dependência.
- Antes de publicar: escopo fechado, revisão concluída, checks pertinentes aprovados no SHA candidato, build de produção, navegação e visual verificados localmente, dados/permissões preservados e rollback definido.
- Manter CI automático para detectar regressões, sem etapa de deploy. PC/WSL podem compilar/testar, mas enviar um artefato precompilado ainda consome deployment.
- Só iniciar deployment deliberado quando todos os itens verificáveis antes da publicação estiverem aprovados e houver autorização para a entrega. A solicitação anterior da Home fica adiada até esse gate; liberar cota não dispara nova tentativa.
- Validar em cloud o que depende do hosting, promover o artefato validado quando compatível e conferir domínio/SHA. Falha exige diagnóstico e correção antes de outra tentativa; não usar deployments sucessivos como ciclo de desenvolvimento.

Configuração versionada: `git.deploymentEnabled: false` nos dois `vercel.json`, conforme a [documentação Vercel](https://vercel.com/docs/project-configuration/git-configuration). O vínculo Git do projeto operacional também é desconectado para impedir gatilhos vindos de branches antigas. Isso preserva repositório, projetos, domínio e deployment servido. Reativação requer decisão explícita, não faz parte de atualizações de runtime.

## Hotfix
Branch temporária nasce de main, recebe validação adequada e é promovida para produção. O mesmo ajuste é integrado imediatamente em Preview. Não manter correções exclusivas de um ambiente.

## Proteções a configurar em R0
PR obrigatório, checks obrigatórios, impedimento de force-push/eliminação de main e Preview, identificação do commit e restrição de quem promove produção. Confirmar quais recursos o plano atual oferece antes de declarar configurado. Não criar exigência de revisor externo impossível para um projeto individual.

## Paridade dos ambientes
| Aspecto | Production | Preview |
| --- | --- | --- |
| Código/configuração estrutural | Build de produção da main | Build de produção da Preview |
| Aplicação web | Projeto canônico único | Ambiente do mesmo projeto web |
| Dados | Campanha real | Base isolada ou conjunto autorizado de homologação |
| Credenciais | Escopo de produção | Escopo de teste |
| OAuth | URLs reais | Callbacks próprios de Preview |
| Jobs/webhooks | Integrações operacionais | Destinos de teste, sem efeitos na campanha real |
| Visibilidade | Pública conforme conteúdo | Acesso controlado se contiver material privado |
| Identificação | SHA, ref, ambiente | SHA, ref, ambiente |

Mesma estrutura não significa mesmas credenciais ou mesmo banco. Copiar produção inteira para testes não é requisito; preferir fixtures sintéticas e amostras autorizadas com conteúdo privado controlado.

## Aplicação única
Home, sessões, resumos, login, Edit e API HTTP convergem para um projeto web. Ambientes e um serviço local especializado não são sites concorrentes. Recursos de dados isolados para Preview são infraestrutura de teste, não uma segunda aplicação pública.

## Transição e deploy
O roteamento operacional antigo só permanece durante janela documentada. A fase pública pode ser promovida antes do Edit novo desde que o acesso operacional existente seja preservado e testado. Depois da migração do Edit, retirar suas rotas e assets antigos.

Não publicar build manual antigo no domínio para marcar etapa como concluída. O aceite requer publicação deliberada rastreável ao commit validado; não exige deploy automático por push.

## Rollback
Reverter código por PR/commit e aguardar novo deploy verificado. Migrações devem manter compatibilidade com a versão anterior durante a janela de troca. Reverter aplicação não reverte dados: usar o runbook de dados quando necessário. Depois de um rollback, integrar a decisão em Preview.

## Limpeza inicial de branches
Inventariar branches remotas, PRs abertos, commits exclusivos e responsáveis. Classificar em integrada, trabalho útil, abandonada ou desconhecida. Preservar trabalho útil em PR/tag apropriado antes de descartar. Nenhuma branch existente foi apagada pela criação desta documentação.
