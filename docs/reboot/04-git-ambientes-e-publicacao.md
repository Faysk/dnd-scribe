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
4. Integrar e homologar o estado completo de Preview.
5. Abrir PR de promoção Preview -> main.
6. Revalidar o commit resultante em main e aguardar deployment terminal.
7. Fazer smoke no domínio e conferir o SHA publicado.
8. Realinhar Preview com main preservando a ancestralidade; evitar squash recorrente na promoção que deixe as branches divergindo artificialmente.
9. Remover branches temporárias após confirmar integração ou abandono e preservar a referência do PR.

Exceção autorizada em 2026-09-06: o proprietário pediu implementação da fundação diretamente em main durante a pausa de uso. A documentação foi integrada por fast-forward e a base é validada antes do push. Esta autorização vale para o bootstrap; o fluxo normal acima continua sendo a regra depois dele. A existência da branch Preview não comprova ambiente isolado implantado.

Node 24 foi aceito pelo proprietário para manter a hospedagem gratuita. Deploys Vercel por Git voltam a ser permitidos para main e Preview; branches temporárias permanecem sem deploy automático. A configuração não resolve por si só a integração ainda pendente do frontend: ver [decisão vigente](registros/node24-gratuito.md).

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

Não publicar build manual antigo no domínio para marcar etapa como concluída. O aceite requer deployment automático associado ao commit promovido.

## Rollback
Reverter código por PR/commit e aguardar novo deploy verificado. Migrações devem manter compatibilidade com a versão anterior durante a janela de troca. Reverter aplicação não reverte dados: usar o runbook de dados quando necessário. Depois de um rollback, integrar a decisão em Preview.

## Limpeza inicial de branches
Inventariar branches remotas, PRs abertos, commits exclusivos e responsáveis. Classificar em integrada, trabalho útil, abandonada ou desconhecida. Preservar trabalho útil em PR/tag apropriado antes de descartar. Nenhuma branch existente foi apagada pela criação desta documentação.
