# Destino final: operação integral em cloud

> Status: direção aprovada; implementação e viabilidade de custo pendentes. Responsável: proprietário e implementador. Revisão: 2026-09-06.

## Decisão vigente

O projeto final deve funcionar 100% online, com o PC do proprietário desligado. O PC pode ajudar temporariamente com processos pesados e repetitivos; depois da conclusão, não permanece como dependência operacional. Esta decisão substitui a orientação local-first anterior, inclusive para áudio e transcrição. Ela não autoriza apagar dados nem executar agora upload/migração indiscriminados.

## O que precisa ficar em cloud

| Capacidade | Destino obrigatório |
| --- | --- |
| Home, sessões e resumos | Aplicação web publicada |
| Login, Edit, revisão e publicação | Mesma aplicação e autorização, sem companion obrigatório |
| Áudio original, transcrições, artes e histórico | Storage/banco duráveis, com visibilidade por recurso |
| Transcrição e outros processos longos | Executor cloud, estado de job persistente e retomada |
| Agendamentos, integrações e automações | Execução cloud sem agente pessoal conectado |
| Build e deploy de mudanças | Pipeline cloud; WSL somente auxiliar temporário |
| Backup, restauração e operação | Cópias e configuração recuperáveis sem o PC |

Cloud não significa público: áudio, transcrição e material interno continuam privados conforme as permissões. Um repositório e uma interface canônica podem usar mais de um serviço de infraestrutura. Um worker não é outro site ou outro Edit.

## Uso temporário da máquina

Migração de acervo, conversão, saneamento, geração de derivados ou reprocessamento em lote podem usar o PC. Registrar responsável, tarefa delimitada, checkpoint, hashes de entradas/saídas, destino cloud e condição de encerramento. Resultados só contam como entregues após upload autorizado, reconciliação e leitura pelo sistema cloud.

O plano de retirada inclui remover a dependência de caminhos locais, localhost, rede doméstica, túneis e runners pessoais. O processamento de novas sessões e retries deve funcionar em cloud, mesmo depois que o lote histórico terminar. Não usar o PC como fallback silencioso quando uma franquia cloud acabar.

Fontes locais não são apagadas por esta decisão. Preservá-las até confirmar cópia, restauração e operação cloud; qualquer limpeza posterior é uma ação separada. Cópias opcionais de segurança/desenvolvimento locais não podem ser necessárias para operar ou recuperar o produto.

## Gratuidade e viabilidade

A meta de custo zero continua. Node 24 é uma [exceção já aceita](node24-gratuito.md). Não presumir que hospedagem web gratuita também cubra horas de transcrição, memória/GPU, storage, tráfego e retenção de backups.

R0 precisa medir o corpus, frequência de sessões, tempo de processamento e armazenamento, e consultar ofertas/limites vigentes antes de escolher o executor. Créditos promocionais que expiram não comprovam operação gratuita sustentável. Não foi escolhido nem provisionado um novo serviço de transcrição por esta documentação.

Se o volume necessário não couber gratuitamente em cloud, registrar o bloqueio concreto e opções de quota, fila, desempenho ou custo para decisão do proprietário. Não assumir plano pago, excluir recursos essenciais ou transformar execução local em arquitetura definitiva. O planejamento de viabilidade vem agora; a implementação integral segue a sequência pública -> Edit -> operação.

## Aceite obrigatório de R4

Com PC/WSL/companion do proprietário desligados e sem acesso à rede doméstica:

1. De outro dispositivo, importar uma nova sessão autorizada para storage privado.
2. Iniciar transcrição, acompanhar progresso real e receber o resultado em cloud.
3. Interromper/reiniciar um executor e verificar recuperação sem perda nem publicação duplicada.
4. Revisar texto/falantes, ouvir a fonte permitida, gerar os derivados previstos e publicar pelo Edit.
5. Conferir acesso público e privado, revogação e integridade de IDs/hashes/proveniência.
6. Executar integrações/agendamentos obrigatórios e um build/deploy sem runner pessoal.
7. Restaurar dados em ambiente cloud isolado e verificar conteúdo recuperado.
8. Registrar uso/custos, limites e comportamento quando a franquia é atingida; nenhum gasto ou fallback local automático.

Aprovação desse conjunto é necessária para dizer que o reboot funciona 100% em cloud. Site acessível, contêiner aprovado ou importação de resultados feitos no PC não fecham o gate isoladamente.
