# Stack alvo — 2026

A meta não é usar versões `current`/preview por vaidade. O padrão é **stable/LTS recente com suporte ativo e CI verde**.

## Web e backend HTTP

- Node.js 24 LTS
- Next.js 16 Active LTS
- React 19.2
- TypeScript 7 stable, após compatibilidade validada
- Tailwind CSS 4.3
- Supabase JS v2 atual
- `@supabase/ssr` atual
- Vitest 5
- Playwright estável atual
- App Router, Server Components e Route Handlers

Node 26 permanece `Current` em setembro de 2026; não é baseline de produção até virar LTS. Next 16.3.3 é release Active LTS com correções de segurança de agosto/2026.

## Dados

- Supabase / PostgreSQL 17.x atual do projeto
- migrations versionadas
- RLS explícito
- tipos gerados do schema
- Storage para assets públicos/privados conforme contrato

## Companion local

- Python 3.13 ou 3.14, decidido por validação real do pipeline
- FastAPI
- Uvicorn
- faster-whisper
- CTranslate2/CUDA 12/cuDNN 9
- pytest
- typing/lint/format modernos

## Regras de dependência

1. sem `latest` não versionado em produção;
2. patches de segurança têm prioridade;
3. majors entram via PR isolado;
4. previews/canary só em branch experimental;
5. runtime LTS é preferido a `Current`;
6. atualizar só é sucesso se tests/build/E2E e auditoria funcional passarem.
