# 15 — Gates das Fases 1 e 2

Status: **concluídas documentalmente**  
Data: **2026-09-04**

## Objetivo

Registrar de forma auditável o encerramento das Fases 1 e 2 da modernização, sem confundir aprovação arquitetural com autorização para iniciar o bootstrap.

A Fase 0 ainda possui pendências visuais e de performance. Portanto:

```txt
Fase 1 = concluída
Fase 2 = concluída
Fase 3 = bloqueada
```

---

# Fase 1 — Arquitetura alvo

## Objetivo da fase

Definir a fundação da nova aplicação antes de criar UI real.

## Decisões fechadas

### Stack

- Next.js App Router;
- React;
- TypeScript strict;
- Tailwind CSS;
- Node.js LTS;
- Supabase Auth;
- Zod;
- Vitest;
- Playwright;
- pnpm;
- Vercel.

### Estrutura

O novo frontend nasce em:

```txt
apps/web
```

O root legado permanece preservado durante coexistência.

### Rendering

```txt
Server Components por padrão
Client Components somente para interação
```

### Auth

- Supabase Auth permanece;
- sessão SSR/cookies no novo app;
- OAuth callback tratado no app Next;
- access token do próprio usuário é encaminhado à API existente;
- nenhuma service role no browser.

### Dados

Durante a migração:

```txt
Browser
→ Next/BFF
→ API legada
→ Supabase/PostgreSQL
```

A API atual continua sendo a fronteira canônica do player.

### Deploy

Dois projetos Vercel durante coexistência:

```txt
projeto atual
→ produção e API legada

projeto novo com Root Directory apps/web
→ Preview e homologação do Next
```

O domínio de produção atual não é movido durante bootstrap.

## Validação da Fase 1

- [x] limites do sistema definidos;
- [x] stack alvo definida;
- [x] política de versões definida;
- [x] estrutura de diretórios definida;
- [x] rendering strategy definida;
- [x] auth strategy definida;
- [x] data strategy definida;
- [x] estratégia de cache privado definida em nível arquitetural;
- [x] topologia de coexistência definida;
- [x] rollback conceitual preservado pelo projeto Vercel separado;
- [x] features futuras permanecem fora do escopo.

## Riscos restantes da Fase 1

### OAuth em Preview

Antes da Fase 5, redirects/callbacks do novo projeto precisam ser configurados/validados no Supabase Auth.

### Cache autenticado

A implementação deve começar conservadora (`private`/dinâmica) e só otimizar depois de testes. Nenhum conteúdo privado pode virar cache público.

### Hop adicional do BFF

Durante coexistência existirá um hop Next → API legada. Performance deve ser medida, não presumida.

### URLs antigas

A estratégia final de bridge para URLs hash antigas está adiada até os destinos novos existirem. Isso não bloqueia bootstrap, mas bloqueia cutover.

## Rollback da Fase 1

Como esta fase é documental, rollback significa reverter/superseder ADRs antes da implementação.

Nenhuma mudança de runtime, banco ou produção foi executada para encerrar esta fase.

## Resultado

```txt
FASE 1 = CONCLUÍDA
```

---

# Fase 2 — ADRs e contratos

## Objetivo da fase

Registrar decisões que não devem depender de memória de conversa, comentário solto ou interpretação futura.

## ADRs aceitos

| ADR | Tema | Status |
| --- | --- | --- |
| 001 | Next.js App Router | Accepted |
| 002 | TypeScript strict | Accepted |
| 003 | Supabase permanece | Accepted |
| 004 | local-first preservado | Accepted |
| 005 | design system próprio | Accepted |
| 006 | Server Components por padrão | Accepted |
| 007 | feature freeze | Accepted |
| 008 | API legada como fronteira de dados | Accepted |
| 009 | Vercel separado para Preview/Homologação | Accepted |
| 010 | BFF Next para API legada | Accepted |

## Contratos congelados

Os contratos do player legado estão documentados em:

```txt
10-contratos-legado-app-publico.md
```

Incluem:

- auth config;
- `/api/auth/me`;
- catálogo de sessões;
- resumo;
- transcrição;
- busca;
- speaker filter;
- paginação por cursor;
- download Markdown;
- tema;
- estados de erro/acesso.

## Validação da Fase 2

- [x] ADRs mínimos exigidos pelo roadmap aceitos;
- [x] decisões adicionais de dados/deploy aceitas;
- [x] BFF formalizado;
- [x] contratos do legado documentados;
- [x] pendências deliberadas identificadas;
- [x] nenhuma decisão crítica de bootstrap depende de memória de chat.

## Pendências deliberadamente bloqueadas para fases posteriores

### Bridge de URLs antigas

Fechar antes da Fase 7/cutover.

### Substituição da API legada

Não faz parte do bootstrap. Qualquer migração deve ter paridade, autorização equivalente e ADR de substituição.

### Remoção do projeto legado

Somente após produção nova estável e período de estabilização.

## Rollback da Fase 2

ADRs podem ser marcados `Superseded` por nova decisão formal. Não editar silenciosamente uma decisão histórica para fingir que ela nunca existiu.

## Resultado

```txt
FASE 2 = CONCLUÍDA
```

---

# Bloqueio atual para a Fase 3

O bloqueio não é mais arquitetura.

O bloqueio restante vem da Fase 0:

- baseline visual desktop essencial;
- baseline visual mobile essencial;
- estados de login/acesso pendente/erro;
- baseline técnico de performance reproduzível.

Quando o gate mínimo definido para esses itens estiver fechado, o bootstrap pode começar sem nova rodada de decisões estruturais.

## Próximo passo autorizado após desbloqueio

```txt
Fase 3 — Bootstrap
→ criar apps/web
→ pnpm/workspace sem quebrar legado
→ Next + TS strict
→ Tailwind
→ Vitest
→ Playwright
→ CI
→ novo projeto Vercel com Root Directory apps/web
→ página mínima sem domínio real
```

Nenhuma feature de personagem, NPC, lore, timeline ou grafo é autorizada por este encerramento.
