# ADR 013 — TypeScript 6 como bridge temporária para tooling

Status: **Accepted**  
Data: **2026-09-04**

## Contexto

A Fase 3 tentou inicialmente TypeScript 7.0.2, seguindo a política do projeto de preferir versões estáveis recentes.

O primeiro CI provou que o compilador em si funciona para o código do bootstrap: `tsc --noEmit` passou.

Entretanto, o lint falhou antes de analisar o código porque `typescript-eslint@8.69.0`, trazido pela integração do `eslint-config-next@16.3.3`, ainda não suporta a API do TypeScript 7.0.

O erro observado no CI foi explícito:

```txt
typescript-eslint does not support TS 7.0.
```

A própria mensagem do tooling orienta usar a API do TypeScript 6 para esse cenário enquanto o suporte a 7 amadurece.

O plano da Fase 3 já previa esta exceção: se a incompatibilidade fosse real e atribuível ao ecossistema do framework/plugin, usar a versão estável mais recente oficialmente compatível, sem desativar typecheck/lint.

## Decisão

O `apps/web` usará **TypeScript 6.0.3** durante o bootstrap.

Continuam obrigatórios:

```txt
strict = true
noEmit = true
```

Não serão usados:

- `ignoreBuildErrors`;
- bypass do ESLint;
- `@ts-ignore` global;
- dual toolchain improvisada apenas para afirmar que o projeto “usa TypeScript 7”.

## Natureza da decisão

Esta é uma **bridge temporária de compatibilidade de tooling**, não uma rejeição ao TypeScript 7.

Quando `eslint-config-next` / `typescript-eslint` da linha estável usada pelo projeto suportarem TypeScript 7 de forma oficial e o CI permanecer verde, este ADR deve ser reavaliado.

## Alternativas consideradas

### Manter TypeScript 7 e desabilitar lint TypeScript

Rejeitada. Enfraqueceria o gate de qualidade apenas para usar um número de versão maior.

### Executar TypeScript 7 no build e TypeScript 6 no ESLint

Não adotada no bootstrap. A complexidade não oferece ganho material para um app ainda vazio e aumenta o risco de comportamentos divergentes.

### Fixar um fork/canary de typescript-eslint

Rejeitada. O roadmap exige versões estáveis, não canary/beta/RC para contornar incompatibilidade temporária.

### Usar TypeScript 6 estável até o ecossistema alcançar 7

Aceita.

## Consequências positivas

- mantém `strict` e lint reais;
- usa linha estável suportada pelo ecossistema atual;
- evita bypass de qualidade;
- torna a decisão auditável;
- facilita upgrade futuro deliberado.

## Consequências negativas

- o novo app não usa imediatamente o compilador nativo TypeScript 7;
- os ganhos de performance do TS7 ficam adiados;
- é necessário revisar esta decisão futuramente para evitar estagnação.

## Gate para superseder

Este ADR pode ser supersedido quando:

1. a linha estável do Next/ESLint usada pelo projeto suportar TypeScript 7;
2. `pnpm typecheck` passar;
3. `pnpm lint` passar;
4. unit tests passarem;
5. `next build` passar;
6. E2E crítico passar.

Até lá:

```txt
TypeScript 6.0.3 = versão operacional aprovada
TypeScript 7.x   = alvo futuro de revalidação
```
