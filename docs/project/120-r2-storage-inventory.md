# Etapa 120 - Inventario real do R2

## Objetivo

Criar uma visao segura e somente-leitura do que existe no R2 por sessao, prefixo e categoria, para parar de decidir armazenamento no escuro.

## Entregas

- Novo endpoint protegido: `/api/storage/inventory`.
- Novo painel na aba `Operacao`: `Inventario de audio e artefatos`.
- Agrupamento por sessao e por categoria.
- Lista dos maiores objetos.
- Alertas visuais por tamanho de sessao:
  - ok: abaixo de 250 MB;
  - amarelo: acima de 250 MB;
  - vermelho: acima de 500 MB.
- Inclusao nos checks:
  - `node --check api/storage/inventory.js`;
  - `node --check web/storage-inventory.js`.

## Categorias iniciais

- `raw_zip`: ZIP Craig original. Temporario, alvo de expiracao apos manifest/extracao validos.
- `work_flac`: FLAC extraido. Temporario assim que existir audio compacto permanente.
- `media_voice_ref`: audio compacto permanente futuro, preferencialmente Opus.
- `work_chunks`: slices/chunks temporarios para transcricao.
- `unknown`: objeto que ainda precisa de classificacao.

## Seguranca

O endpoint exige login e permissao tecnica `project.monitor.read`. Em ambientes sem RBAC completo, ainda permite o fallback legado para `owner`/`master`, seguindo o padrao atual de monitoramento.

O endpoint nao apaga, nao move e nao altera objetos. Ele apenas lista metadados do R2.

## Decisoes

- A listagem usa a API S3 ListObjectsV2 do R2 com URL assinada.
- O prefixo padrao e `campaigns/{campaignSlug}/sessions/`.
- A pagina inicial lista ate 10 paginas de 1000 objetos cada.
- Se o resultado vier truncado, a proxima etapa adiciona paginacao/cursor na UI.

## Proximo passo

Etapa 121: criar modelo persistente de artefatos de audio no banco para rastrear cada objeto com tipo, tamanho, origem, job criador, classe de retencao e expiracao planejada.
