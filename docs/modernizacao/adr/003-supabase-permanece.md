# ADR 003 — Supabase/PostgreSQL permanecem

Status: **Accepted**

## Contexto

O projeto já usa Supabase para autenticação, perfis, campanha e conteúdo compartilhado. A modernização tem como foco principal a camada web pública, não a substituição do banco.

## Decisão

Supabase/PostgreSQL permanecem como plataforma de dados e autenticação durante a modernização. A integração será modernizada onde necessário, especialmente para SSR/cookies e revisão de RLS.

## Alternativas consideradas

- migrar para outro backend/BaaS;
- banco próprio e auth própria;
- reescrever a API simultaneamente ao frontend.

## Motivos

- reduzir risco;
- preservar dados e contratos existentes;
- manter RLS e Auth já conhecidos;
- permitir migração incremental.

## Consequências

Positivas:

- menor escopo;
- rollback mais simples;
- dados não precisam ser migrados por causa do frontend.

Custos:

- parte da API atual pode continuar legada temporariamente;
- integração SSR precisa ser revisada e testada.
