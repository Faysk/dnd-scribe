# 29 — Fase 15: plano de execução do Encerramento da Modernização

Status: **pré-planejado; execução depende da Fase 14 concluída**

## Objetivo

Encerrar formalmente o ciclo de modernização, registrar o estado real de produção e liberar — somente então — a criação de um roadmap separado para as novas features de domínio.

A Fase 15 existe para impedir que “já está em produção” vire sinônimo de “ninguém sabe exatamente o que sobrou do legado e já começamos outra coisa”.

---

## 1. Condição de entrada

A Fase 15 só começa quando a estabilização declarou:

```txt
critical = 0
high = 0
auth estável
gateway legado estável
performance aceitável
mobile/dark/light aprovados
documentação atualizada
```

Se ainda existe motivo plausível para rollback por bug conhecido, voltar à Fase 14.

---

## 2. Relatório final

Usar `09-relatorio-final-template.md` como base e preencher com fatos.

O relatório final deve conter no mínimo:

```txt
período da modernização
objetivo
escopo
stack final
arquitetura final
mudanças de UX deliberadas
funcionalidades preservadas
performance legado × moderno
segurança/a11y
cutover
estabilização
dívidas restantes
legado restante
status final
```

Não copiar o plano como se ele fosse resultado.

---

## 3. Stack efetivamente instalada

Registrar versões exatas de produção:

```txt
Node
Next.js
React
TypeScript
Tailwind
pnpm
Supabase JS
@supabase/ssr
Zod
Vitest
Playwright
```

Também registrar política de atualização futura.

Se alguma escolha diferir do plano inicial, explicar por quê.

---

## 4. Arquitetura efetiva

Documentar o fluxo real:

```txt
Browser
→ dnd.faysk.dev / Next
→ Server Components / Client islands
→ BFF
→ DND_LEGACY_ORIGIN
→ projeto legado
→ Supabase/PostgreSQL
```

E a topologia operacional:

```txt
Projeto Next
→ app público
→ BFF
→ gateway

Projeto legado
→ API
→ Central Local
→ jobs
→ crons
```

Não afirmar que o backend foi modernizado se ele deliberadamente não foi.

---

## 5. Mudanças deliberadas de UX

Registrar explicitamente:

### Home

Antes:

```txt
catálogo completo de sessões
```

Depois:

```txt
CampaignHero
LatestSession
ArchiveStats
RecentSessions
```

### Arquivo

```txt
/sessoes
→ catálogo completo
```

### Sessão

Antes:

```txt
transcrição first
```

Depois:

```txt
resumo first
```

### Transcrição

Capacidade preservada, posição hierárquica alterada.

---

## 6. Paridade preservada

Registrar resultado da matriz final:

- auth;
- themes;
- sessões;
- summary Markdown;
- transcrição;
- search;
- speaker filter;
- pagination/infinite loading;
- download;
- error states;
- links antigos;
- mobile;
- browsers críticos.

Anexar/referenciar a matriz, não apenas escrever “100%”.

---

## 7. Performance final

Resumo das comparações:

```txt
Home legacy → modern
Summary legacy → modern
Transcript legacy → modern
Search legacy → modern
```

Incluir:

- medianas;
- métricas principais;
- regressões aceitas;
- ganhos;
- budgets futuros.

Não selecionar apenas a melhor execução.

---

## 8. Segurança final

Registrar:

- auth SSR/cookies;
- server-side authorization;
- RLS review;
- secrets audit;
- BFF allowlist;
- Markdown/XSS;
- CSP/headers quando aplicados;
- dependency audit;
- findings críticos/altos resolvidos.

Medium/low aceitos devem ter referência.

---

## 9. Acessibilidade final

Registrar:

- keyboard;
- focus;
- skip link;
- labels;
- contrast dark/light;
- reduced motion;
- zoom/reflow;
- automated checks;
- manual findings.

Acessibilidade não precisa ser declarada “perfeita”; deve ser documentada com o nível realmente validado.

---

## 10. Cutover e estabilização

Registrar:

```txt
data do cutover
commit/deployment
houve rollback?
incidentes
janela de estabilização
bugs encontrados
bugs corrigidos
feedback da mesa
```

Isso vira memória operacional para futuras migrações.

---

## 11. Legado restante

Separar claramente:

### Frontend legado

Pergunta:

> ainda é necessário para uso normal do player?

Para encerrar a modernização, resposta deve ser:

```txt
não
```

### Backend/operacional legado

Pode continuar necessário:

- API;
- Central Local;
- jobs;
- crons;
- integrations;
- tooling.

Isso não impede encerrar a modernização do **app público**, porque permaneceu deliberadamente fora do escopo.

---

## 12. Destino do `web/` legado

Tomar decisão explícita.

Opções:

### A — manter temporariamente versionado

Adequado se rollback histórico ainda é útil ou o mesmo diretório possui superfícies não migradas.

### B — arquivar em diretório/tag

Quando o frontend antigo estiver totalmente sem uso, mas preservação histórica for desejada.

### C — remover código morto em PR dedicado

Somente quando:

- nenhum build/deploy depende dele;
- rollback não depende dele;
- Central Local e outros assets não são removidos junto por engano;
- `scripts/sync-public.js`/Vercel legado foram analisados.

Não fazer limpeza agressiva no mesmo commit que declara sucesso da modernização se isso aumentar risco.

---

## 13. Projeto Vercel legado

Não deletar apenas porque frontend moderno está em produção.

Conforme ADR 012, ele ainda pode hospedar:

```txt
legacy.dnd.faysk.dev
API
Central Local
integrations
jobs
crons
```

Registrar status:

```txt
MANTIDO — backend/operacional legado
```

A remoção futura terá projeto/roadmap próprio quando todas as dependências forem migradas.

---

## 14. Gateway legado

Publicar lista atual dos paths ainda encaminhados.

Exemplo:

```txt
/api/* exceto /api/web/*
/edit/*
/central-local/*
/terms
/privacy
/linked-role
/docs/api/*
```

Usar inventário real final, não apenas exemplo.

Essa lista vira dívida arquitetural rastreável, não conhecimento tribal.

---

## 15. Hash bridge

ADR 011 continua vigente.

Decisão final deve dizer:

```txt
mantida após modernização
```

ou, somente se houver evidência excepcional:

```txt
removida com justificativa
```

Preferência do roadmap: manter inicialmente porque links históricos fazem parte da memória da campanha.

---

## 16. Dívidas técnicas

Classificar cada item restante:

```txt
P0 blocker — não deveria chegar à Fase 15
P1 importante
P2 melhoria
legacy backend debt
operational debt
```

Dívida conhecida não invalida o encerramento quando:

- não quebra uso normal;
- não é critical/high de segurança;
- possui registro claro;
- ficou fora do escopo por decisão deliberada.

---

## 17. Backlog de features futuras

Durante toda a modernização podem ter surgido ideias.

Consolidar em documento/issue separado, sem iniciar implementação.

Categorias futuras já conhecidas:

```txt
Pessoas/NPCs
Lore editável
Galerias
Coleções
Jornada/Timeline
Mundo
Relações/Grafo
Busca global
```

Esse backlog é **entrada** para discussão do Roadmap V2, não roadmap aprovado automaticamente.

---

## 18. Documentação principal

Atualizar onde necessário:

- README principal;
- docs index;
- arquitetura local-first;
- documentação de deploy;
- runbooks;
- auth;
- env example;
- Vercel topology;
- development setup.

Remover instruções que façam um novo desenvolvedor iniciar pelo frontend antigo quando isso não for mais verdade.

---

## 19. ADRs

Revisar índices/status.

Nenhum ADR aceito deve estar contradito pela produção sem:

- atualização;
- superseding ADR;
- nota de exceção.

Especialmente:

- App Router;
- TypeScript strict;
- Supabase;
- local-first;
- Server Components;
- BFF;
- Vercel separado;
- hash bridge;
- legacy origin/gateway.

---

## 20. CI e manutenção

Registrar pipeline final:

```txt
legacy checks
new web typecheck
lint
unit
build
E2E
visual/a11y conforme política
```

Definir quais jobs são obrigatórios para PRs futuros.

Configurar/confirmar atualização de dependências automatizada quando aprovada.

---

## 21. Runbook de incidente

Antes de encerrar, garantir que existe resposta para:

```txt
Next indisponível
legacy origin indisponível
Supabase auth indisponível
gateway falha
transcript API falha
OAuth callback falha
```

Não precisa ser um manual corporativo gigante; precisa dizer onde olhar e qual rollback/fallback existe.

---

## 22. Release/tag

Criar tag/release quando útil para marcar o marco.

Exemplo conceitual:

```txt
modernization-v1
```

ou versão semântica adotada pelo projeto.

A tag deve apontar para produção estabilizada, não para o primeiro commit do cutover.

---

## 23. Definition of Done final

Revisar o checklist do `docs/modernizacao/README.md` item por item.

Todos os obrigatórios precisam estar concluídos ou possuir aceite formal compatível com a própria regra do roadmap.

Não marcar checkbox por expectativa.

---

## 24. Declaração final

Somente depois dos gates:

```txt
MODERNIZAÇÃO: COMPLETA
```

O README do roadmap muda de estado.

Exemplo:

```txt
Status: CONCLUÍDA
Data: YYYY-MM-DD
Release: ...
```

---

## 25. Desbloqueio do próximo roadmap

Após a declaração final, o feature freeze específico da modernização é encerrado.

A próxima atividade permitida é:

```txt
planejar Roadmap V2 — Memória Viva da Campanha
```

Não começar implementação de features no mesmo commit do encerramento.

Primeiro discutir/modelar:

- domínio;
- UX;
- dados;
- permissões;
- media;
- ownership;
- relações.

Depois criar roadmap próprio.

---

## 26. Checklist final resumido

```txt
[ ] Fases 0–14 concluídas
[ ] relatório final preenchido
[ ] stack final registrada
[ ] arquitetura real registrada
[ ] matriz 100% registrada
[ ] performance registrada
[ ] security/a11y registradas
[ ] cutover/estabilização registrados
[ ] frontend antigo não necessário para uso normal
[ ] backend legado restante explicitado
[ ] gateway paths inventariados
[ ] dívidas classificadas
[ ] documentação principal atualizada
[ ] ADRs coerentes
[ ] CI final documentado
[ ] runbook de incidente mínimo
[ ] Definition of Done mestre concluída
[ ] status MODERNIZAÇÃO: COMPLETA
```

---

## 27. Saída

O resultado desta fase não é uma feature.

É uma base estável e conhecida para que o próximo roadmap possa crescer sem carregar a dívida de uma migração ainda aberta.

Somente depois disso começamos a desenhar as features de Pessoas, Lore, Coleções, Jornada, Mundo e Relações.