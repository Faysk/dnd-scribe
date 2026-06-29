# 165 - R2 Bucket Audit

## Objetivo

Criar uma auditoria sob demanda do bucket R2 real para comparar objetos existentes no storage com os rastros mantidos no banco.

## Contexto

A etapa 164 passou a listar objetos conhecidos em `recording_files`. Isso melhora a visao do banco, mas ainda nao responde se existem objetos no bucket que nao possuem rastro no projeto. Para controlar custo de storage com seguranca, precisamos enxergar candidatos a orfao antes de pensar em qualquer limpeza.

## Mudanca

- Nova rota protegida no catch-all existente: `GET /api/r2-inventory`.
- A rota assina uma chamada S3 `ListObjectsV2` para o bucket R2 configurado.
- Cada objeto retornado e comparado contra `recording_files` e, quando disponivel, `audio_artifacts`.
- A tela de storage ganhou uma secao `Auditoria direta do bucket R2` acionada manualmente.
- A auditoria mostra objetos rastreados e `orphan_candidate`.
- O smoke de rotas e o monitoramento profundo agora validam que `/api/r2-inventory` responde como rota protegida, nao `404`.

## Segurança

- A auditoria nao apaga objetos.
- A auditoria nao gera URLs de download.
- A auditoria nao roda automaticamente; o operador precisa clicar no botao.
- O acesso exige `project.monitor.read`.

## Custo

Cada pagina consultada usa uma operacao de listagem no R2. Por isso a tela nao carrega essa auditoria sozinha. A listagem e para investigacao operacional, especialmente quando o total do R2 divergir do total rastreado pelo banco.

## Proximo cuidado

`orphan_candidate` nao significa deletavel. Antes de apagar qualquer objeto, precisamos converter candidatos relevantes em registros auditaveis ou criar uma etapa de decisao que marque explicitamente o que pode ser descartado.
