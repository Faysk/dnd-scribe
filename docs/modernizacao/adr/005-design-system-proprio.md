# ADR 005 — Design system próprio

Status: **Accepted**

## Contexto

O DnD Scribe já possui identidade visual forte nos temas dark e light. A modernização não deve transformar o produto em uma interface genérica de biblioteca de componentes.

## Decisão

A nova aplicação terá design system próprio baseado nos tokens e na linguagem visual já existente. Tailwind e primitivas acessíveis podem ser usados como ferramentas, mas não definem a estética do produto.

## Alternativas consideradas

- adotar integralmente um UI kit pronto;
- manter CSS global sem sistematização;
- redesenhar a identidade durante a migração.

## Motivos

- preservar reconhecimento visual;
- reduzir inconsistência;
- permitir evolução futura sem recomeçar CSS por página;
- manter dark e light como experiências equivalentes.

## Consequências

Positivas:

- identidade preservada;
- componentes reutilizáveis;
- tokens semânticos facilitam manutenção.

Custos:

- exige trabalho inicial de formalização;
- componentes de terceiros precisam ser adaptados visualmente.
