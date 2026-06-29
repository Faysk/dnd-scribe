# 160 - Pipeline Operator Action Summary

## Objetivo

Melhorar a leitura operacional da esteira Craig mostrando, no painel de jobs, quantas acoes estao disponiveis para a sessao atual.

## Contexto

A producao precisa permitir tentativa novamente, pausa, retomada e descarte sem exigir leitura de JSON ou analise de codigo. Os botoes ja existiam por job, mas a visao geral nao mostrava rapidamente quantos jobs estavam acionaveis em cada categoria.

## Mudanca

- `web/jobs.js` agora calcula um resumo de acoes disponiveis no painel do pipeline.
- O resumo mostra contadores para `Retry`, `Pausar`, `Retomar` e `Descartar`.
- `web/jobs.css` adiciona uma grade responsiva compacta para esses contadores.
- A mudanca nao executa jobs, nao chama OpenAI e nao altera regras de permissao.

## Resultado operacional

Durante uma sessao ou pos-upload, o operador consegue bater o olho no painel e entender se existe algo recuperavel, pausado, descartavel ou pronto para retry antes de entrar em cada card individual.
