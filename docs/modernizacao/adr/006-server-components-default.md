# ADR 006 — Server Components por padrão

Status: **Accepted**

## Contexto

Grande parte do DnD Scribe é conteúdo de leitura: Home, catálogo de sessões, metadados e resumos. Enviar JavaScript para tudo aumenta complexidade e custo no browser sem benefício real.

## Decisão

No App Router, componentes serão Server Components por padrão. `use client` será aplicado somente quando houver necessidade concreta de estado ou APIs do browser.

## Client Components esperados nesta modernização

- theme switch;
- user menu quando necessário;
- busca/filtro da transcrição;
- carregamento incremental;
- ações que dependam diretamente do browser.

## Alternativas consideradas

- SPA predominantemente client-side;
- marcar layouts inteiros como client para simplificar migração.

## Motivos

- menos JavaScript enviado;
- conteúdo editorial adequado a renderização no servidor;
- melhor separação de responsabilidades;
- base mais adequada para páginas grandes futuras.

## Consequências

Positivas:

- bundle client menor;
- menor hidratação desnecessária;
- acesso a dados no servidor mais natural.

Custos:

- exige disciplina na fronteira server/client;
- algumas bibliotecas precisam ser isoladas em componentes cliente.
