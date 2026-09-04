# 35 — Fase 7: sessão e resumo como rota principal

Status: **implementação de código concluída; homologação visual com dados reais depende do Preview configurado**

Data: 2026-09-04

## Objetivo

Virar a semântica antiga do reader: abrir uma sessão passa a significar abrir sua memória/resumo. A transcrição permanece importante, mas se torna conteúdo secundário em `/sessoes/:id/transcricao`.

## Implementado

- contrato runtime/TypeScript de `GET /api/library-summary`;
- fetch server-side autenticado do resumo publicado;
- rota `/sessoes/[id]` como detalhe principal;
- hero com arte, arco, título, data, duração, falas e participantes;
- resumo curto como contexto de abertura;
- `summaryFull` renderizado como Markdown no servidor;
- renderização de Markdown segura por construção, sem `dangerouslySetInnerHTML` para conteúdo editorial;
- HTML bruto do Markdown não é executado;
- links com protocolos perigosos não recebem `href`;
- imagens embutidas no Markdown aceitam apenas HTTPS;
- navegação `Resumo | Transcrição`;
- estado explícito quando a sessão existe, mas o recap completo ainda não foi publicado;
- 404 para `sourceSessionId` inexistente;
- bridge para links hash compartilhados no app legado;
- testes de contrato do resumo, bridge de rotas e segurança básica do Markdown;
- smoke E2E da rota de resumo sem secrets.

## Compatibilidade de links antigos

No cutover, a raiz nova consegue interpretar os hashes antigos no browser:

```txt
#/sessao/:id/resumo -> /sessoes/:id
#/sessao/:id        -> /sessoes/:id/transcricao
```

Como fragments `#...` não chegam ao servidor HTTP, a bridge precisa existir no client e roda somente quando o pathname é `/`.

## Markdown

O acervo continua usando `marked` 18.0.7 para tokenização GFM. Em vez de transformar o resultado em HTML arbitrário e injetá-lo, o Web Next converte tokens conhecidos diretamente em elementos React. Isso mantém SSR, elimina execução de HTML bruto e reduz a superfície de XSS.

Os principais blocos suportados nesta fase são:

- headings;
- parágrafos;
- strong/em/del;
- links;
- imagens HTTPS;
- listas;
- blockquotes;
- código inline e bloco;
- horizontal rule;
- tabelas GFM;
- quebras de linha.

## Fora desta fase

- implementação funcional da transcrição;
- busca e filtro por speaker;
- cursor/infinite load;
- download `.md`.

Esses itens entram imediatamente na Fase 8.

## Gate

```txt
install
typecheck
lint
unit
build
Playwright smoke
CI legado
```

Todos precisam ficar verdes antes do merge. Produção `dnd.faysk.dev` continua intocada.
