# Etapa 120 - Inventario de storage em producao

## Objetivo

Criar uma visao segura e somente-leitura do que existe em audio/artefatos por categoria, para parar de decidir armazenamento no escuro e medir o impacto real de cada sessao.

## Entrega atual

- Painel protegido na aba `Operacao`: `Inventario de audio e artefatos`.
- A UI usa a rota existente `/api/monitoring?deep=1`, sem criar nova Serverless Function.
- Os totais vem do metric `storage` em `lib/monitoring.js`, agregado pela tabela `recording_files`.
- O painel mostra:
  - bytes totais rastreados;
  - quantidade de arquivos rastreados;
  - minutos de audio rastreados quando `duration_ms` existe;
  - categorias por `file_type` + `source_system`;
  - classe de retencao sugerida para cada categoria.

## Por que nao usar uma rota separada agora

A primeira versao criou `/api/storage/inventory`, mas isso adicionava uma nova Function e estourava o limite atual do plano Hobby da Vercel. A rota foi removida e o painel foi mantido em cima do monitoramento existente.

Decisao: enquanto estivermos no plano atual, novas visoes operacionais devem preferir reaproveitar `/api/[...path].js` ou bibliotecas internas chamadas por rotas ja existentes.

## Categorias iniciais

- `zip` ou `craig_zip`: ZIP Craig original. Temporario, alvo de expiracao apos manifest/extracao validos.
- `flac` ou `raw`: copia de trabalho. Temporaria assim que existir audio compacto permanente.
- `chunk` ou `slice`: artefato descartavel depois da transcricao validada.
- `opus`, `mp3` ou `voice_ref`: audio compacto permanente.
- `manifest` ou `transcript`: permanente leve.
- `unknown`: objeto que ainda precisa de classificacao.

## Seguranca

A leitura continua protegida por `/api/monitoring`, que exige login e permissao tecnica `project.monitor.read`. Valores sensiveis nao sao expostos.

O painel nao apaga, nao move e nao altera objetos. Ele apenas mostra metadados ja rastreados pelo banco.

## Limite conhecido

Esta etapa ainda nao lista todos os objetos reais do bucket R2. Ela mostra o que o banco conhece em `recording_files`. Isso e suficiente para comecar a medir custo/volume sem criar nova Function, mas ainda pode divergir se existir objeto no R2 sem linha correspondente no banco.

## Proximo ajuste tecnico

Acoplar ListObjectsV2 do R2 dentro de `lib/monitoring.js` ou de uma biblioteca chamada por `/api/[...path].js`, mantendo o total de Functions em 12. Quando isso entrar, o painel podera mostrar:

- objetos orfaos no R2;
- sessoes mais pesadas por prefixo;
- maiores objetos;
- candidatos seguros para expiracao;
- divergencia entre banco e bucket.

## Proximo passo

Etapa 121: criar modelo persistente de artefatos de audio no banco para rastrear cada objeto com tipo, tamanho, origem, job criador, classe de retencao e expiracao planejada.
