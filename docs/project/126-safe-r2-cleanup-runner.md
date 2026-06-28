# Etapa 126 - Executor seguro de limpeza R2

## Objetivo

Criar o caminho operacional para apagar objetos R2 somente quando a propria esteira ja marcou o artefato como `delete_ready`.

Esta etapa nao decide o que pode ser apagado. Essa decisao vem da view `audio_storage_cleanup_candidates`. O executor apenas consome candidatos ja aprovados pela politica.

## Entregas

- Nova rota POST usada pelo front em producao: `/api/storage-cleanup-run`.
- Alias aceito no codigo: `/api/storage/cleanup-run`; na Vercel Hobby atual, caminhos profundos podem retornar 404 antes do catch-all.
- Usa a Function existente `api/[...path].js`, sem aumentar a contagem de Functions na Vercel.
- Permissao exigida: `project.jobs.run`.
- Modo padrao: `dryRun`.
- Execucao real exige `confirm: "DELETE_READY_R2"`.
- Painel de storage ganhou:
  - botao `Simular limpeza`;
  - botao `Executar limpeza segura`, desabilitado sem bytes liberaveis ou sem permissao tecnica.

## Fluxo

1. Seleciona no maximo 5 artefatos por execucao.
2. Filtra apenas:
   - `readiness_status = delete_ready`;
   - `lifecycle_status = delete_ready`;
   - campanha atual.
3. Em `dryRun`, retorna lista e bytes sem tocar no R2.
4. Em execucao real:
   - muda artefato para `delete_queued`;
   - chama `DELETE` assinado no R2;
   - grava evento `deleted`;
   - muda lifecycle para `deleted`.

## Falhas

Se o R2 falhar, o artefato vira `failed` e recebe evento `note` com o erro. Assim ele nao fica preso como se estivesse pronto para apagar novamente sem revisao.

## O que ainda falta

- Criar compactacao permanente por faixa para destravar `raw_track_flac`.
- Quando um ZIP grande ficar `delete_ready`, executar a limpeza real pelo painel.
- Adicionar uma tela historica de eventos de cleanup por artefato.
