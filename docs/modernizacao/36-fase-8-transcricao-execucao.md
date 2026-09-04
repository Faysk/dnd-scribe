# 36 — Fase 8: execução da Transcrição

Status: **concluída e integrada ao `main`**  
PR: **#32**  
Merge commit: `eaabfca26ed9473dffc97ad6464cf0a79c6b4728`

## Objetivo entregue

A transcrição deixou de ser a entrada principal de uma sessão e passou a ser um recurso secundário da memória publicada:

```txt
/sessoes/[id]
→ resumo

/sessoes/[id]/transcricao
→ transcrição
```

## Entregas

- contrato TypeScript/runtime para o payload de transcrição;
- primeira página limitada a 120 falas;
- BFF same-origin autenticado para paginação e filtros;
- busca textual;
- filtro por speaker;
- limpar filtros;
- paginação por cursor;
- deduplicação no append;
- carregamento incremental com `IntersectionObserver`;
- botão manual `Carregar mais falas` como fallback;
- loading, empty state e retry;
- status de falas/resultados;
- timestamps editoriais;
- download `.md` por proxy autenticado;
- `Cache-Control: private, no-store` no BFF;
- `Content-Disposition` saneado no download;
- navegação `Resumo | Transcrição` integrada à página de sessão.

## Segurança preservada

O browser não recebe `DND_LEGACY_ORIGIN` nem credencial privilegiada. O token da sessão é recuperado no servidor e encaminhado apenas ao upstream legado fixo.

URLs de arte continuam restritas a HTTPS pelo contrato runtime e texto de fala é renderizado como texto React, sem interpretação como HTML.

## Gate

A implementação foi integrada após os checks da modernização e o PR #32 foi mergeado no `main` em 2026-09-04.

A auditoria transversal de segurança, acessibilidade e qualidade fica deliberadamente para a Fase 9, conforme o roadmap.
