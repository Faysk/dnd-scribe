# ADRs da modernização

Architecture Decision Records usados para registrar decisões que não devem depender de memória de conversa ou comentário de código.

## Estados

- `Proposed` — proposta ainda não aprovada;
- `Accepted` — decisão vigente;
- `Superseded` — substituída por outro ADR;
- `Deprecated` — não deve mais orientar novas mudanças.

## Índice

| ADR | Decisão | Status |
| --- | --- | --- |
| [001](001-nextjs-app-router.md) | Next.js com App Router para o novo app público | Accepted |
| [002](002-typescript-strict.md) | TypeScript strict como padrão | Accepted |
| [003](003-supabase-permanece.md) | Supabase/PostgreSQL permanecem na modernização | Accepted |
| [004](004-local-first-preservado.md) | Arquitetura local-first permanece | Accepted |
| [005](005-design-system-proprio.md) | Identidade visual própria, sem UI kit ditando estética | Accepted |
| [006](006-server-components-default.md) | Server Components por padrão | Accepted |
| [007](007-feature-freeze.md) | Nenhuma expansão de domínio durante a modernização | Accepted |
| [008](008-api-legada-como-fronteira-durante-migracao.md) | API existente permanece como fronteira canônica de dados do player durante a migração | Accepted |

## Formato

Cada ADR deve registrar:

- contexto;
- decisão;
- alternativas consideradas;
- consequências positivas;
- custos/consequências negativas;
- status;
- data quando relevante.
