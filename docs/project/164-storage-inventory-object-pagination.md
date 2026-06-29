# 164 - Storage Inventory Object Pagination

## Objetivo

Permitir navegar pelos objetos de audio rastreados no banco sem depender de terminal e sem criar nova Vercel Function.

## Contexto

O painel de storage ja mostrava totais agregados por `recording_files`, sessoes mais pesadas e readiness de limpeza. Faltava uma listagem operacional dos objetos individuais para investigar rapidamente quais caminhos/sessoes estao ocupando mais espaco.

## Mudanca

- Nova rota protegida no catch-all existente: `GET /api/storage-inventory`.
- A rota exige `project.monitor.read`, igual ao monitoramento tecnico.
- A resposta e paginada por `limit` e `offset`, ordenada pelos maiores objetos conhecidos em `recording_files`.
- A tela de storage carrega os 25 maiores objetos e permite carregar mais sem recalcular todo o painel.
- O smoke de rotas e o monitoramento profundo passam a validar que `/api/storage-inventory` responde como rota protegida, nao como `404`.

## Segurança

- A rota nao gera URL assinada para download.
- A rota nao apaga nem modifica R2.
- A rota nao lista segredos.
- O acesso fica restrito a perfis com permissao tecnica de monitoramento.

## Limite conhecido

Esta etapa lista objetos rastreados no Supabase. Ela ainda nao faz `ListObjectsV2` direto no R2, portanto objetos orfaos no bucket continuam sendo uma etapa futura separada.
