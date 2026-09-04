# ADR 009 — Preview do novo app Next em projeto Vercel separado

Status: **Accepted**  
Data: **2026-09-04**

## Contexto

O projeto Vercel atual `dnd-scribe` está ligado ao repositório `Faysk/dnd-scribe` e serve um conjunto maior que o frontend público:

- build estático atual via `scripts/sync-public.js`;
- conteúdo em `public/`;
- API serverless existente;
- Central Local/Edit;
- rewrites;
- crons;
- integrações e funções operacionais.

O novo frontend será criado em `apps/web` usando Next.js.

Alterar o projeto Vercel atual para apontar para `apps/web` antes do cutover poderia quebrar responsabilidades existentes e aumentar o blast radius da migração.

A Vercel suporta múltiplos projetos ligados ao mesmo repositório/monorepo e configuração por root directory.

## Decisão

Durante bootstrap, desenvolvimento e homologação, o novo app Next utilizará **um segundo projeto Vercel**, ligado ao mesmo repositório, com Root Directory em `apps/web`.

O projeto atual permanece responsável pela produção e serviços legados até a Fase 13.

Topologia:

```txt
Faysk/dnd-scribe
├── Vercel atual
│   └── produção + serviços legados
└── Vercel Next
    └── apps/web + previews
```

Nenhum domínio principal será movido durante bootstrap.

## Consequências positivas

- produção atual permanece intacta;
- rollback é trivial antes do cutover;
- configuração Next não interfere no build estático atual;
- previews do novo app podem evoluir independentemente;
- env/secrets podem ser reduzidos ao mínimo necessário;
- erros de build do novo app não impedem o uso do site atual.

## Consequências negativas

- será necessário manter dois projetos Vercel temporariamente;
- configuração de env precisa ser gerenciada separadamente;
- auth/OAuth precisa considerar o domínio de Preview/homologação;
- o novo app precisará de bridge server-side para a API legada durante coexistência;
- o cutover futuro exigirá decisão explícita de domínio e destino dos serviços legados.

## Alternativas consideradas

### Converter imediatamente o projeto atual para Next.js

Rejeitado por risco alto e acoplamento com funções/rotas operacionais existentes.

### Executar Next dentro do mesmo projeto com rewrites complexos desde o início

Rejeitado para bootstrap porque aumenta complexidade e blast radius sem benefício imediato.

### Desenvolver apenas localmente até o cutover

Rejeitado porque Preview Deployments fazem parte da estratégia de homologação e paridade visual/funcional.

## Relação com outros ADRs

- ADR 001 — Next.js App Router;
- ADR 004 — local-first preservado;
- ADR 008 — API legada como fronteira de dados durante a migração.

## Critério para superseder

Pode ser substituído após estabilização se a arquitetura final de produção justificar consolidação dos projetos, desde que:

- serviços legados estejam claramente separados;
- exista plano de rollback;
- domínio e rotas sejam testados;
- nenhuma função operacional seja perdida.
