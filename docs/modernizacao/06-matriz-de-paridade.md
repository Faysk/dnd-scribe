# 06 — Matriz de paridade

Status: **bloco automatizado consolidado; homologação autenticada pendente**

## Objetivo

Comparar o frontend legado e o novo app de forma objetiva. A modernização não é considerada concluída enquanto os itens obrigatórios de uso real estiverem verdes.

Legenda:

- `⬜` não iniciado;
- `🟡` implementação/evidência parcial;
- `✅` aprovado na camada indicada;
- `❌` regressão;
- `N/A` não aplicável.

## Funcionalidade

| Área | Cenário | Legado | Novo | Obrigatório | Status | Evidência/nota |
| --- | --- | --- | --- | --- | --- | --- |
| Auth | Login Google | funciona | implementado | sim | 🟡 | OAuth real depende do RC |
| Auth | Login Discord | funciona | implementado | sim | 🟡 | OAuth real depende do RC |
| Auth | Acesso aprovado | funciona | implementado | sim | 🟡 | membership real pendente |
| Auth | Acesso pendente | funciona | implementado | sim | 🟡 | cenário real pendente |
| Auth | Logout | funciona | implementado | sim | 🟡 | proteção cross-origin coberta; cookie HTTPS real pendente |
| Auth | Avatar/perfil | funciona | contrato/shell implementados | sim | 🟡 | dado real pendente |
| Auth | Capabilities | funciona | preservadas | sim | 🟡 | dado real pendente |
| Tema | Dark mode | funciona | implementado | sim | 🟡 | automação/reflow verde; homologação visual pendente |
| Tema | Light mode | funciona | implementado | sim | 🟡 | automação/reflow verde; homologação visual pendente |
| Home | Dados reais | funciona | implementado | sim | 🟡 | acervo autenticado pendente |
| Home | Última sessão em destaque | não existe | implementado | sim | 🟡 | mudança deliberada; RC pendente |
| Sessões | Catálogo completo | Home atual | `/sessoes` implementado | sim | 🟡 | dados reais pendentes |
| Sessões | Capas | funciona | `next/image` | sim | 🟡 | contrato/allowlist testados; visual real pendente |
| Sessões | Data | funciona | implementado | sim | 🟡 | corpus real preparado |
| Sessões | Título | funciona | implementado | sim | 🟡 | corpus real preparado |
| Sessões | Resumo curto | funciona | implementado | sim | 🟡 | corpus real preparado |
| Sessões | Falas | funciona | implementado | sim | 🟡 | dados reais pendentes |
| Sessões | Participantes | funciona | implementado | sim | 🟡 | dados reais pendentes |
| Sessões | Duração | funciona | implementado | sim | 🟡 | corpus inclui duração ausente |
| Sessão | Hero image | funciona | implementado/otimizado | sim | 🟡 | visual real pendente |
| Sessão | Arco | funciona | implementado | sim | 🟡 | corpus real preparado |
| Sessão | Resumo como default | não | `/sessoes/[id]` | sim | ✅ | mudança deliberada implementada |
| Resumo | Markdown completo | funciona | implementado | sim | 🟡 | parser real + corpus; leitura autenticada pendente |
| Resumo | Sanitização | funciona | renderer seguro | sim | ✅ | unit tests |
| Transcrição | Abrir transcrição | default atual | rota secundária | sim | ✅ | arquitetura/rota implementadas |
| Transcrição | Busca textual | funciona | implementado | sim | 🟡 | interação real pendente |
| Transcrição | Filtro speaker | funciona | implementado | sim | 🟡 | interação real pendente |
| Transcrição | Limpar filtros | funciona | implementado | sim | 🟡 | interação real pendente |
| Transcrição | Contador | funciona | implementado | sim | 🟡 | interação real pendente |
| Transcrição | Paginação/cursor | funciona | implementado | sim | 🟡 | corpus real pendente |
| Transcrição | Infinite/progressive load | funciona | implementado | sim | 🟡 | transcrição longa real pendente |
| Transcrição | Fallback carregar mais | funciona | implementado | sim | 🟡 | transcrição longa real pendente |
| Transcrição | Empty state | funciona | implementado | sim | ✅ | componente/automação determinística |
| Transcrição | Retry | funciona | implementado | sim | 🟡 | erro real controlado pendente |
| Download | `.md` | funciona | BFF implementado | sim | 🟡 | download autenticado real pendente |
| Erros | Erro de API | tratado | tratado | sim | 🟡 | estados implementados; falha real pendente |
| Erros | Retry de rota | tratado | tratado | sim | 🟡 | falha real pendente |

## Rotas

| Origem | Alvo | Status | Nota |
| --- | --- | --- | --- |
| `#/` | `/` | ✅ | Home moderna |
| `#/sessao/:id` | `/sessoes/:id/transcricao` | ✅ | unit + E2E browser |
| `#/sessao/:id/resumo` | `/sessoes/:id` | ✅ | unit + E2E browser |

## Visual — desktop

| Tela | Dark | Light | Baseline/estrutura | Novo aprovado |
| --- | --- | --- | --- | --- |
| Login | 🟡 | 🟡 | estrutura implementada | ⬜ |
| Acesso pendente | 🟡 | 🟡 | estrutura implementada | ⬜ |
| Home | 🟡 | 🟡 | design system implementado | ⬜ |
| Arquivo `/sessoes` | N/A | N/A | rota nova | ⬜ |
| Sessão/resumo | 🟡 | 🟡 | estrutura implementada | ⬜ |
| Transcrição | 🟡 | 🟡 | estrutura implementada | ⬜ |
| Erro | 🟡 | 🟡 | estados implementados | ⬜ |

## Visual — mobile

| Tela | Dark | Light | Automação de reflow | Novo aprovado |
| --- | --- | --- | --- | --- |
| Login | 🟡 | 🟡 | ✅ | ⬜ |
| Home | 🟡 | 🟡 | ✅ | ⬜ |
| Arquivo `/sessoes` | N/A | N/A | ✅ | ⬜ |
| Sessão/resumo | 🟡 | 🟡 | ✅ | ⬜ |
| Transcrição | 🟡 | 🟡 | ✅ | ⬜ |

## Browsers — automação

| Browser/engine | Desktop | Mobile/emulação | Status |
| --- | --- | --- | --- |
| Chromium | ✅ | ✅ Pixel 5 | ✅ |
| Firefox | ✅ | N/A | ✅ |
| WebKit | ✅ | ✅ iPhone 13 | ✅ |

Gate consolidado: `71 passed / 4 skipped intencionais / 0 failed` no bloco automatizado da Fase 11. Os skips são apenas checks de foco/Tab dependentes de Full Keyboard Access no WebKit; a semântica/ativação continua coberta.

## Acessibilidade

| Cenário | Status | Nota |
| --- | --- | --- |
| Pular para conteúdo | ✅ | todas as engines validam semântica/ativação |
| Navegação completa por teclado | 🟡 | Chromium/Firefox automatizados; Safari manual pendente |
| Foco visível | ✅ | engines aplicáveis automatizadas |
| Menu de usuário acessível | 🟡 | shell implementado; sessão real pendente |
| Inputs com label | ✅ | E2E |
| Estados loading anunciados | ✅ | transcrição |
| Estados erro anunciados | ✅ | componentes/roles |
| Contraste dark | ✅ | relações principais medidas |
| Contraste light | ✅ | relações principais medidas |
| Reduced motion | ✅ | E2E |
| Zoom 200% autenticado | ⬜ | RC |

## Performance

| Métrica | Legado | Novo | Meta | Status |
| --- | ---: | ---: | ---: | --- |
| LCP Home | pendente | pendente | sem regressão crítica | ⬜ |
| CLS Home | pendente | pendente | aceitável | ⬜ |
| INP | pendente | pendente | aceitável | ⬜ |
| JS inicial Home | pendente | inventário global disponível | justificar aumento | 🟡 |
| LCP sessão | pendente | pendente | sem regressão crítica | ⬜ |
| Tempo busca transcrição | pendente | pendente | igual ou melhor | ⬜ |

Inventário estático mais recente observado: aproximadamente `881 KiB raw / 265 KiB gzip` de JS em 17 chunks e `32.4 KiB raw / 6.6 KiB gzip` de CSS. Não equivale ao payload inicial de uma rota.

## Segurança

| Verificação | Status | Evidência |
| --- | --- | --- |
| Nenhuma service role no browser | ✅ | client bundle audit |
| Cookies/auth revisados | 🟡 | arquitetura SSR validada; HTTPS real pendente |
| RLS revisada | ✅ | auditoria Supabase da Fase 9 |
| Inputs validados | ✅ | limites BFF/unit tests |
| Rotas protegidas | 🟡 | server-side implementado; sessão real pendente |
| Env separado Preview/Prod | 🟡 | modelo definido; RC final pendente |
| Headers revisados | ✅ | E2E + config |
| Logout cross-origin | ✅ | E2E |
| Origem legada anti-self-loop | ✅ | validação + testes do gateway/BFF |

## CI

| Check | Status |
| --- | --- |
| frozen install | ✅ |
| lint | ✅ |
| typecheck | ✅ |
| unit tests | ✅ |
| E2E multi-browser | ✅ |
| client bundle audit | ✅ |
| bundle measurement | ✅ |
| build | ✅ |
| CI legado | ✅ |
| visual autenticado | ⬜ |
| Preview/RC smoke real | ⬜ |

## Gate final

A fase de cutover só pode ser **executada** quando:

- todos os itens obrigatórios de uso real estiverem `✅`;
- diferenças deliberadas estiverem documentadas;
- critical/high = 0;
- benchmark autenticado estiver registrado;
- release candidate Vercel estiver homologado;
- mesa/owner aprovar explicitamente.

Até lá, os blocos automatizados verdes permanecem válidos e não precisam ser refeitos sem mudança relevante de SHA/comportamento.
