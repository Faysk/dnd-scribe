# ADR 001 — Next.js com App Router

Status: **Accepted**

## Contexto

O frontend público atual usa HTML, CSS, JavaScript e hash routing. A evolução futura exigirá layouts aninhados, páginas editoriais grandes, autenticação no servidor e uma base modular.

## Decisão

O novo app público será implementado com Next.js usando App Router e a versão estável suportada mais recente no momento da implementação.

## Alternativas consideradas

- continuar com vanilla JS;
- React + Vite SPA;
- outro meta-framework React.

## Motivos

- rotas semânticas;
- layouts aninhados;
- Server Components;
- integração natural com Vercel;
- boa adequação a conteúdo editorial e páginas grandes;
- possibilidade de reduzir JavaScript no cliente.

## Consequências

Positivas:

- arquitetura preparada para crescimento;
- melhor separação entre servidor e cliente;
- routing real sem hash;
- melhor organização por domínio.

Custos:

- curva de migração;
- necessidade de revisar auth SSR;
- necessidade de evitar Client Components desnecessários;
- dependência maior do ecossistema React/Next.
