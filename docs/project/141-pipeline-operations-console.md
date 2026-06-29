# 141 - Pipeline operations console

Data: 2026-06-29

## Objetivo

Deixar upload e tratamento de audio operaveis pelo site em producao, sem
depender de terminal, SQL manual ou leitura de codigo quando uma etapa falhar.

## Estado alvo

Para cada sessao, a tela deve mostrar uma esteira:

1. ZIP recebido no R2.
2. Manifest Craig lido.
3. Faixas FLAC extraidas.
4. Metadados de duracao gerados.
5. Chunks planejados.
6. Speech slices gerados.
7. Estimativa OpenAI calculada.
8. Transcricao aprovada.
9. Transcricao executada.
10. Review/candidatos gerados.
11. Limpeza/retencao aplicada.

Cada etapa deve ter:

- status;
- inicio/fim;
- tentativas;
- erro amigavel;
- erro tecnico;
- arquivos de entrada;
- arquivos de saida;
- custo estimado;
- acoes disponiveis.

## Acoes por etapa

- `tentar novamente`: reexecuta a etapa com os mesmos inputs.
- `continuar`: cria o proximo job quando a etapa atual ja tem output valido.
- `pausar`: impede novas etapas automaticas.
- `descartar`: marca job/artefato como descartado sem apagar imediatamente.
- `reprocessar`: invalida derivados e recria a partir de um ponto seguro.
- `limpar brutos`: remove ZIP/FLAC bruto quando derivados essenciais existem.

## Regras de seguranca

- Acao destrutiva exige confirmacao.
- Toda acao grava auditoria.
- Limpeza nunca apaga transcript/review/timeline.
- ZIP bruto so pode ser removido quando manifest + tracks + metadados essenciais estiverem persistidos.
- FLAC bruto so pode ser removido quando slices/transcricao estiverem aprovados ou quando o DM aceitar perder reprocessamento barato.

## Politica inicial de retencao

Manter:

- manifest;
- metadados de faixas;
- speech slices finais;
- transcript;
- review;
- eventos Discord/Roll20;
- artefatos publicados.

Remover ou arquivar depois de validado:

- ZIP Craig original;
- FLAC por faixa;
- chunks intermediarios silenciosos;
- arquivos temporarios de jobs falhos antigos.

## Custos

A tela deve separar:

- custo de storage R2;
- operacoes R2;
- minutos brutos de audio;
- minutos depois do speech slicing;
- custo OpenAI estimado;
- custo OpenAI executado, quando disponivel.

## Proximas tarefas de implementacao

1. Padronizar estados e transicoes dos jobs.
2. Criar endpoint de controle por etapa, nao apenas por pipeline inteiro.
3. Exibir a esteira na tela de upload/sessao.
4. Adicionar cleanup planner em modo dry-run.
5. Adicionar cleanup executor com confirmacao e auditoria.

