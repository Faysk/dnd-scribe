# Estado, riscos e decisões abertas

> Status: plano documentado; implementação pendente. Responsável: proprietário e implementador do TDA. Revisão: 2026-09-06.

## Registro de referência em 2026-09-06
Base documental: main remota `68e974c0eb240e1658772f8ae64da36530f9452e`.
A cópia original `D:/Projects/dnd` estava em `74ecc35`, 319 commits atrás. O trabalho documental usa checkout separado na branch temporária `codex/reboot-documentation`.

Na auditoria anterior desta conversa:
- domínio público respondeu e mostrou 11 sessões;
- resumo real foi aberto no navegador;
- endpoints privados de transcrição/download negaram requisições anônimas com 401;
- health público respondeu sem SHA, diferente da implementação em main;
- CI de main registrou 51 testes unitários web, 91 E2E aprovados/4 ignorados e 20 testes do companion;
- PRs 69/70 tinham CI aprovado e status Vercel falho por limite de builds;
- issue 48 registrava bloqueio de topologia/publicação.

Esses são resultados pontuais da auditoria, não monitoramento atual nem validação do reboot. Consultar estado vivo antes de agir. CI citado: https://github.com/Faysk/dnd-scribe/actions/runs/34039778879 .

## Estado desta entrega
| Item | Estado |
| --- | --- |
| Direção do proprietário | Registrada |
| Documentação/roadmap | Produzidos; validação registrada na entrega |
| Referências visuais e pacotes | Cópias preservadas com manifesto |
| Stack mais recente | Consulta e escolha pendentes |
| Preview | Configuração não executada |
| Backup/restore | Não executados |
| Reboot de código | Não iniciado |
| Publicação pipipi | Fonte não localizada |
| Limpeza de branches | Não executada |
| Publicação/merge desta documentação | Não executados nesta entrega |

## Riscos priorizados
| ID | Risco | Resposta | Gate |
| --- | --- | --- | --- |
| RSK-01 | Perda ou exposição de dados ao reconstruir | Inventário, isolamento, restore e reconciliação | R0/R2/R4 |
| RSK-02 | Código aprovado não chegar ao domínio | Git integration e SHA de deploy verificável | R1/R2 |
| RSK-03 | Últimas versões incompatíveis com hosting/GPU | Registro oficial e prova da combinação | Todas |
| RSK-04 | Recriar monólito/segundo Edit | Contratos por domínio e remoção por fluxo | R3/R4 |
| RSK-05 | Escopo histórico voltar por inércia | Inventário e decisão manter/retirar/adiar | R0 |
| RSK-06 | Preview alterar produção | Dados, credenciais e integrações isolados | R1 |
| RSK-07 | Regressão de acesso/segredos | Matriz de autorização e cache por visibilidade | Todas |
| RSK-08 | Custos/egress crescerem | Payloads, paginação, medição e limites | R1–R4 |
| RSK-09 | Documentos contraditórios | Índice ativo e avisos de substituição | Toda entrega |
| RSK-10 | Abandonar trabalho útil em branches | Inventário antes de exclusão | R0 |
| RSK-11 | Pacote visual conter propostas ainda não implementadas | Separar base, propostas e aceite visual | R1/R2 |

## Decisões abertas
| ID | Questão | Encaminhamento |
| --- | --- | --- |
| DEC-01 | Localização exata de pipipi | Proprietário informa fonte; investigar caminhos indicados |
| DEC-02 | Versões e combinação final da stack | Levantamento oficial e compatibilidade em R0 |
| DEC-03 | Recursos/custos de Preview e isolamento de dados | Inventário de infraestrutura em R0 |
| DEC-04 | RPO/RTO e retenção de backups | Proposta após medir volume/restore |
| DEC-05 | Fluxos atuais realmente necessários | Validar matriz de paridade com operador |
| DEC-06 | Marca/composição final da primeira Home | Revisar composição com os assets fornecidos |
| DEC-07 | Destino dos PRs/épico antigos | Classificar trabalho reaproveitável; não fechar automaticamente |

## Como atualizar
Mudou código, ambiente, versão, escopo ou dado? Atualizar o módulo correspondente e este registro, incluindo data/evidência. Uma validação pendente permanece pendente até existir resultado. Nunca transportar “100% concluído” de um roadmap anterior para este reboot.
