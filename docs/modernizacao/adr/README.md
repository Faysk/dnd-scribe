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
| [009](009-preview-next-em-projeto-vercel-separado.md) | Novo app Next usa projeto Vercel separado durante bootstrap e homologação | Accepted |
| [010](010-bff-next-para-api-legada.md) | Novo app usa BFF server-side para consumir a API legada durante coexistência | Accepted |
| [011](011-compatibilidade-hash-legado-no-cutover.md) | Links hash do legado serão preservados por bridge client-side mínima no cutover | Accepted |
| [012](012-origem-legada-estavel-e-gateway-no-cutover.md) | Projeto legado mantém origem técnica estável e o novo domínio atua como gateway no cutover | Accepted |
| [013](013-typescript-6-bridge-para-tooling.md) | TypeScript 6.0.3 é bridge temporária até o tooling estável suportar TypeScript 7 | Accepted |
| [014](014-preview-next-via-deploy-mcp.md) | Projeto Next isolado pode ser homologado por deploy MCP reproduzível e pinado por SHA | Accepted |
| [015](015-memoria-publica-material-bruto-privado.md) | Resumos publicados são públicos; transcrições e material bruto permanecem privados | Accepted |

## Pendências deliberadamente adiadas

Não bloqueiam o bootstrap:

- eventual substituição dos endpoints legados por acesso direto/handlers novos — só pode ocorrer depois de paridade e revisão de autorização;
- remoção do projeto Vercel legado — não faz parte da modernização do app público enquanto API/Central Local/jobs/crons ainda dependerem dele;
- data futura de remoção da bridge de hash — somente depois de uso estável das URLs modernas e decisão explícita;
- retirada gradual dos paths de passthrough do gateway — cada contrato exige migração ou aposentadoria explícita;
- reavaliar TypeScript 7 quando `eslint-config-next`/`typescript-eslint` da linha estável suportarem sua API oficialmente;
- ligar `dnd-scribe-web-next` diretamente ao GitHub quando a superfície operacional permitir, substituindo o deploy MCP como caminho normal de Preview;
- política de visibilidade por sessão (`public | members | private`) só entra com migração e semântica explícitas; até lá `status = 'published'` é o gate do resumo público.

## Formato

Cada ADR deve registrar:

- contexto;
- decisão;
- alternativas consideradas;
- consequências positivas;
- custos/consequências negativas;
- status;
- data quando relevante.
