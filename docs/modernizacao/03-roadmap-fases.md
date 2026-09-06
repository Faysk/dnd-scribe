# 03 — Roadmap por fases

Status: **concluído — modernização encerrada em 2026-09-06**

## Regra geral

O roadmap foi executado sequencialmente por risco, não por empolgação visual. As fases abaixo permanecem registradas como plano e histórico de execução.

## Estado final em 2026-09-06

```txt
Fase 0  — Baseline e congelamento           ✅ concluída
Fase 1  — Arquitetura alvo                  ✅ concluída
Fase 2  — ADRs e contratos                  ✅ concluída
Fase 3  — Bootstrap da nova aplicação       ✅ concluída
Fase 4  — Design system                     ✅ concluída
Fase 5  — Auth e shell                      ✅ concluída
Fase 6  — Home e arquivo de sessões         ✅ concluída
Fase 7  — Página de sessão/resumo           ✅ concluída
Fase 8  — Transcrição                       ✅ concluída
Fase 9  — Qualidade/security/a11y           ✅ concluída
Fase 10 — Performance                       ✅ concluída
Fase 11 — Paridade total                    ✅ concluída
Fase 12 — Homologação                       ✅ concluída
Fase 13 — Cutover reversível                ✅ concluída
Fase 14 — Estabilização                     ✅ encerrada por aceite do proprietário
Fase 15 — Encerramento formal               ✅ concluída
```

Produção final:

```txt
https://dnd.faysk.dev
```

O registro factual de encerramento, incluindo evidências de produção, exceção explícita à janela padrão de estabilização e dívidas aceitas, está em:

- `44-fase-15-encerramento-final.md`

> Nota histórica: as seções abaixo descrevem os objetivos, entregas e gates definidos durante a execução. Menções a “pendente”, “bloqueado” ou “estado atual” dentro de uma fase refletem o momento em que aquele plano foi escrito; o estado canônico final é o bloco acima e o documento 44.

---

## Fase 0 — Baseline e congelamento

### Objetivo

Registrar o estado atual do produto e impedir expansão funcional durante a migração.

### Entregas

- mapa de telas atuais;
- rotas atuais;
- contratos usados pelo frontend;
- screenshots dark/light desktop/mobile;
- fluxos críticos;
- lista de capacidades atuais;
- feature freeze formal.

### Gate de saída

- baseline visual congelado;
- baseline funcional congelado;
- baseline técnico de performance reproduzível;
- escopo aprovado;
- backlog futuro separado.

### Resultado

**Concluída.** O baseline e o freeze sustentaram toda a execução posterior.

---

## Fase 1 — Arquitetura alvo

### Objetivo

Definir a fundação da nova aplicação antes de criar UI real.

### Entregas

- stack alvo;
- política de versões;
- estrutura de diretórios;
- estratégia de rendering;
- estratégia de auth;
- estratégia de dados;
- estratégia de coexistência com legado.

### Gate de saída

Arquitetura aprovada e sem decisões críticas pendentes que bloqueiem bootstrap.

### Resultado

**Concluída.** A API legada foi preservada como fronteira durante a migração, o Next adotou BFF server-side e a coexistência Vercel foi definida antes do cutover.

---

## Fase 2 — ADRs e contratos

### Objetivo

Registrar decisões arquiteturais que não devem depender de memória de conversa.

### Entregas

- App Router;
- TypeScript strict;
- permanência do Supabase;
- local-first preservado;
- design system próprio;
- Server Components por padrão;
- feature freeze;
- contratos reais do app público legado;
- estratégia BFF/gateway.

### Gate de saída

ADRs com status `Accepted` ou exceções documentadas.

### Resultado

**Concluída.**

---

## Fase 3 — Bootstrap da nova aplicação

### Objetivo

Criar o novo app web sem substituir produção prematuramente.

### Entregas

- workspace/pnpm;
- app Next;
- TypeScript strict;
- Tailwind;
- lint;
- Vitest;
- Playwright;
- scripts de typecheck/build/test;
- Vercel Preview;
- CI.

### Gate de saída

```txt
install ✅
typecheck ✅
lint ✅
test ✅
build ✅
preview ✅
```

### Resultado

**Concluída.**

---

## Fase 4 — Design system

### Objetivo

Reproduzir a identidade existente de forma componentizada e consistente.

### Entregas

- tokens semânticos;
- dark mode;
- light mode;
- tipografia;
- espaçamento;
- bordas/sombras;
- estados de interação;
- componentes fundamentais.

### Resultado

**Concluída.**

---

## Fase 5 — Auth e shell

### Objetivo

Migrar a moldura da aplicação e o estado autenticado.

### Entregas

- Root Layout;
- Campaign Layout;
- header;
- navegação;
- theme toggle;
- login/logout;
- acesso pendente;
- campaign role;
- capabilities;
- Supabase Auth SSR/cookies.

### Resultado

**Concluída e homologada em produção.** O OAuth real foi utilizado e a sessão passou a ser compartilhada com o Edit no mesmo domínio.

---

## Fase 6 — Home e arquivo de sessões

### Objetivo

Modernizar a entrada da campanha sem novas features de domínio.

### Entregas

```txt
/
→ Home editorial moderna

/sessoes
→ catálogo cronológico público
```

### Resultado

**Concluída.** Home e arquivo públicos usam dados reais em produção.

---

## Fase 7 — Página de sessão e resumo

### Objetivo

Transformar o resumo publicado na memória principal da sessão.

### Resultado

**Concluída.** `/sessoes/[id]` é público para sessões publicadas e suporta o resumo completo real.

---

## Fase 8 — Transcrição

### Objetivo

Manter a transcrição como material secundário da mesa, com busca, paginação e download.

### Resultado

**Concluída.** A transcrição exige autenticação e, após o hardening final, `campaign.transcript.read`. Download segue a mesma permissão e revisão exige também `campaign.content.edit`.

---

## Fase 9 — Qualidade, segurança e acessibilidade

### Objetivo

Fechar regressões funcionais e tornar segurança/a11y parte do produto.

### Resultado

**Concluída.** Inclui contratos defensivos, headers, CSRF, sanitização, foco/skip link, estados de erro e cobertura automatizada.

---

## Fase 10 — Performance

### Objetivo

Controlar bundle, imagens, prefetch e custo do frontend moderno.

### Resultado

**Concluída para o escopo de modernização.** Bundle audit/measure permanece no CI. O benchmark autenticado formal foi aceito pelo proprietário como acompanhamento operacional não bloqueante após homologação real em produção.

---

## Fase 11 — Paridade total

### Objetivo

Provar a experiência moderna nos navegadores e tamanhos relevantes.

### Resultado

**Concluída.** Matriz automatizada cobre Desktop Chromium, Firefox, WebKit, Mobile Chromium e Mobile WebKit.

---

## Fase 12 — Homologação

### Objetivo

Validar o produto real antes e durante a entrada em produção.

### Resultado

**Concluída.** O proprietário homologou o frontend público, OAuth e Edit em produção; regressões encontradas no cutover foram corrigidas antes do encerramento.

---

## Fase 13 — Cutover reversível

### Objetivo

Colocar a experiência Next em `dnd.faysk.dev` sem destruir as superfícies operacionais existentes.

### Resultado

**Concluída.** O PR #41 ativou o gateway de produção, preservando Edit, APIs, jobs, crons, integrações e rollback.

---

## Fase 14 — Estabilização

### Objetivo

Observar a produção após o cutover e corrigir regressões reais.

### Resultado

**Encerrada por aceite explícito do proprietário em 2026-09-06.** O runbook define sete dias como janela padrão, mas a janela foi comprimida após homologação ativa, correções de autenticação/Edit, CI/E2E completos, smoke final e ausência de 5xx no deployment final durante a verificação. O acompanhamento contínuo passa a operação normal.

---

## Fase 15 — Encerramento formal

### Objetivo

Consolidar o estado final, evidências, dívidas aceitas e liberar o próximo ciclo de produto.

### Resultado

**Concluída.** Ver `44-fase-15-encerramento-final.md`.

```txt
MODERNIZAÇÃO: COMPLETA ✅
```

A partir daqui, Pessoas/NPCs, lore, timeline, relações, galerias, busca e demais expansões pertencem a um roadmap novo e independente.
