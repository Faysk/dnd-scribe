# Edit integrado e inventário de paridade

> Status: plano documentado; implementação pendente. Responsável: proprietário e implementador do TDA. Revisão: 2026-09-06.

## Objetivo
Recriar a operação útil existente no modelo novo, depois da primeira entrega pública aprovada. O Edit usa a mesma aplicação, sessão, identidade e autorização da web.

## Inventário inicial de capacidades
A presença de código/documentação histórica é evidência de implementação candidata, não prova de funcionamento atual.
| Capacidade | Evidência inicial | Validação necessária antes de portar |
| --- | --- | --- |
| Login e acesso ao Edit | Rota operacional existente | Login único, expiração, logout e revogação |
| Gestão de permissões | Implementação e documentação anteriores | Matriz real, papéis e recursos |
| Listar/editar sessão | Fluxos existentes | Campos, validação, conflitos e persistência |
| Importar ZIP Craig | Companion e documentação | Importação real, cópia verificada e recuperação |
| Processar transcrição | Companion | Windows, GPU, CPU, qualidade e progresso |
| Revisar texto/falante | Código de revisão | Preservar original, timestamps e autoria |
| Gerir artes | Implementação existente | Otimização, acesso, URLs e persistência |
| Publicar resumos/conteúdo | APIs e ferramentas | Aprovação, idempotência, retirada e histórico |
| Ler/baixar transcrição | Rotas protegidas | Membro permitido/negado e recurso correto |
| Áudio e player | Arquitetura histórica | Permissão específica e ligação com fonte |
| Jobs e retry | Pipeline existente | Reinício, interrupção, duplicidade e cancelamento |
| Discord/Roll20 | Adaptadores existentes | Consumidores atuais e valor operacional |

Em R0, cada linha vira registro de paridade: IDs de rotas/telas, consumidor, dado usado, fixture, evidência atual, decisão manter/simplificar/retirar/adiar e responsável. Capacidade não validada não recebe rótulo “funcionando”.

## Ordem proposta de recriação
1. Shell do Edit, sessão única e capacidade de entrada.
2. Catálogo e metadados de sessão.
3. Revisão de conteúdo e resumos, imagens e publicação.
4. Interface canônica para processamento local e acompanhamento de jobs.
5. Revisão de transcrição e acesso autorizado à fonte.
6. Integrações que o inventário confirmar como necessárias.

Essa sequência detalha R3/R4 e pode mudar conforme dependências descobertas. Não iniciar antes do aceite de Home/sessões/resumos.

## Contrato de autenticação
O Edit é cloud. Ler, revisar e publicar conteúdo já sincronizado não depende do PC. Controles de transcrição mostram conexão e disponibilidade do companion; execução pesada permanece local. Resultados pendentes de envio não são apresentados como disponíveis em cloud. A atualização tecnológica deve preservar o fluxo atual e comparar qualidade/desempenho antes e depois, conforme a [divisão vigente](registros/operacao-cloud.md).

Mesma sessão entre público e Edit; autorização no servidor por campanha/recurso/ação; logout encerra o acesso web; revogação tem efeito verificável. Separar “entrar no Edit” de “editar”, “publicar”, “ler transcrição”, “processar localmente” e “ouvir áudio”.

Definir precedência e escopos das capacidades antes da migração. Não inferir privilégio de metadados editáveis do usuário. Não assumir que o login de uma pessoa prova o isolamento entre duas contas.

## Comportamento editorial
Rascunho não é publicação. Salvar revisão não muda conteúdo público sem a ação correspondente. Erros de rede não descartam trabalho silenciosamente. Conflitos entre editores têm comportamento definido, e alterações relevantes registram ator, momento e objeto.

## Retirada do legado
Cada fluxo novo só substitui o antigo depois de paridade, segurança e smoke no ambiente publicado. Registrar caminho antigo, replacement, consumidores, dados, rollback e evidência de remoção. No fechamento de R3, o Edit antigo deixa de ser servido; no fechamento de R4, retirar os adapters operacionais que não tiverem consumidor.

Não copiar a estrutura do monólito para TypeScript sem mudar responsabilidades. Não manter central-local, Edit novo e companion com três interfaces editoriais concorrentes.
