# Produto e escopo do reboot

> Status: plano documentado; implementação pendente. Responsável: proprietário e implementador do TDA. Revisão: 2026-09-06.

## Objetivo
Reconstruir o TDA — Tem Dado Aqui como uma aplicação coerente para preservar, revisar e compartilhar a memória da campanha. O valor principal nasce da transcrição; a primeira entrega visível é a Home com sessões e resumos existentes.

## Decisões aprovadas pelo proprietário nesta conversa
- Preservar os dados existentes; reconstruir a aplicação de forma controlada.
- `main` é Production; `Preview` é o ambiente de homologação. As demais branches são temporárias e descartáveis depois de integradas ou abandonadas.
- Usar toda tecnologia na versão mais recente. A política operacional proposta é a última versão estável; beta/RC/experimental requer decisão explícita. Ver [política de versões](03-stack-e-atualizacoes.md).
- Entregar Home, sessões e resumos antes de reconstruir o Edit.
- O Edit pertence à mesma aplicação e ao mesmo projeto, com autenticação integrada.
- Recriar os comportamentos úteis existentes no modelo novo.
- Expandir funcionalidades somente quando a base operacional estiver validada.
- Usar o Brand Pack e o Design System enviados como base visual; as imagens são referências de direção, não telas que precisam ser reproduzidas literalmente.
- Publicar a lore temporária `lore/pipipi` em leitura simples; a localização do conteúdo está pendente.

## Princípios de produto
1. Visitante vê história; editor vê estado editorial.
2. Transcrição é fonte, não canon automático. Falas de personagens, hipóteses, bastidores e erros de reconhecimento exigem revisão.
3. Conteúdo derivado deve conservar a origem: sessão, revisão da transcrição e trechos quando disponíveis.
4. Áudio e processamento pesado continuam locais por padrão. Leitores não dependem do computador do operador.
5. Permissões são verificadas no servidor e por recurso. Uma tela escondida não constitui autorização.
6. Um comportamento tem uma implementação canônica; transições têm prazo e condição de remoção.
7. A versão publicada é identificável pelo commit, e não apenas pela aparência.

## Públicos e necessidades
| Público | Necessidade | Limite |
| --- | --- | --- |
| Visitante | Ler histórias e resumos aprovados | Não recebe transcrição privada nem dados operacionais |
| Membro autorizado | Consultar material permitido da mesa | Associação à mesa não implica todas as permissões |
| Editor autorizado | Revisar, organizar e publicar | Editar, publicar, processar e acessar áudio são capacidades distintas |
| DM/administrador | Gerir acesso e decisões editoriais | Modelo exato de papéis será inventariado antes de migrar |
| Operador local | Importar e processar gravações | Dados locais e máquina não se tornam públicos |

## Primeira entrega: incluído
Home, arquivo de sessões, página de sessão/resumo, marca TDA, temas claro/escuro, layout móvel, imagens, metadados sociais, tratamento de erro/vazio/carregamento e URLs preservadas. Acesso às funções privadas que permanecerem em operação deve continuar funcionando durante a transição.

## Primeira entrega: excluído
Grafo, editor de relações, NPCs/pets/itens como novos módulos, timeline nova, galerias novas, busca global e novas integrações. A lore temporária oferece navegação e leitura; não introduz um CMS ou grafo antecipado.

## O que significa 100%
Checklist da entrega fechado com conteúdo real autorizado, testes, validação visual e smoke do commit publicado. Não significa ausência de ajustes futuros. Uma melhoria posterior não reabre automaticamente uma fase encerrada.

## Regra de mudança de escopo
Toda mudança registra problema, usuário beneficiado, fase afetada, impacto em dados/permissões, esforço ainda desconhecido e decisão do proprietário. A documentação antiga é referência de requisitos candidatos; não importa automaticamente todas as ideias históricas para o reboot.
