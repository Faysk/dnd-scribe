# ADR 002 — TypeScript strict

Status: **Accepted**

## Contexto

O domínio do DnD Scribe tende a crescer em quantidade de estados, contratos e entidades. JavaScript puro funcionou bem no protótipo e no app atual, mas aumenta o risco de divergência silenciosa entre dados, API e UI.

## Decisão

A nova aplicação web usará TypeScript com `strict: true` desde o bootstrap.

## Alternativas consideradas

- JavaScript moderno com JSDoc;
- TypeScript sem strict;
- migração gradual de arquivos JS dentro do frontend legado.

## Motivos

- contratos explícitos;
- refactors mais seguros;
- melhor integração com tipos gerados do banco;
- menor risco de divergência em futuras expansões do domínio.

## Consequências

Positivas:

- feedback em compile time;
- melhor autocomplete e manutenção;
- base adequada a evolução futura.

Custos:

- maior disciplina inicial;
- necessidade de validar dados externos em runtime;
- casts e `any` não podem virar atalhos permanentes.
