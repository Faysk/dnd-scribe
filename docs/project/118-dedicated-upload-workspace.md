# Etapa 118 - Tela dedicada de upload Craig

## Objetivo

Separar a ingestao Craig da tela generica de sessoes e transformar o fluxo em uma tela operacional propria, com contexto, status e proximas acoes no mesmo lugar.

## UX aplicada

- Upload deixou de ser um card dentro de `Sessoes` e virou aba `Upload`.
- A tela mostra:
  - preparacao do ZIP;
  - metadados opcionais da sessao;
  - opcoes de processamento;
  - esteira de progresso;
  - resumo da sessao criada/selecionada;
  - pipeline de jobs relacionado;
  - resumo do mapa Craig.
- O arquivo selecionado ganha preview visual antes do envio.
- Os jobs de manifest/extracao podem ser simulados ou executados sem sair da tela.

## Sessao e exclusao

Hard delete ainda nao foi implementado de proposito. Como `sessions` possui varios relacionamentos com `on delete cascade`, apagar uma sessao pode remover transcricoes, eventos, notas, jobs e candidatos, alem de exigir limpeza de objetos R2.

Nesta etapa foi adicionado o caminho seguro:

- `Arquivar`: muda `sessions.status` para `archived`.
- `Restaurar`: volta para `uploaded` quando ha arquivos, ou `planned` quando a sessao ainda esta vazia/manual.

## Proximo passo recomendado

Se for necessario hard delete real, implementar como fluxo separado de administracao:

- dry-run mostrando quantidades por tabela;
- confirmacao digitando o `source_session_id`;
- opcional de limpeza R2;
- log de auditoria antes/depois.
