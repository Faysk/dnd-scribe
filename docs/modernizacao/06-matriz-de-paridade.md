# 06 — Matriz de paridade

Status: **template de homologação**

## Objetivo

Comparar o frontend legado e o novo app de forma objetiva. A modernização não é considerada concluída enquanto os itens obrigatórios não estiverem verdes.

Legenda:

- `⬜` não iniciado;
- `🟡` parcial;
- `✅` aprovado;
- `❌` regressão;
- `N/A` não aplicável.

## Funcionalidade

| Área | Cenário | Legado | Novo | Obrigatório | Status | Evidência/nota |
| --- | --- | --- | --- | --- | --- | --- |
| Auth | Login Google | funciona |  | sim | ⬜ | |
| Auth | Login Discord | funciona |  | sim | ⬜ | |
| Auth | Acesso aprovado | funciona |  | sim | ⬜ | |
| Auth | Acesso pendente | funciona |  | sim | ⬜ | |
| Auth | Logout | funciona |  | sim | ⬜ | |
| Auth | Avatar/perfil | funciona |  | sim | ⬜ | |
| Auth | Capabilities | funciona |  | sim | ⬜ | |
| Tema | Dark mode | funciona |  | sim | ⬜ | |
| Tema | Light mode | funciona |  | sim | ⬜ | |
| Home | Dados reais | funciona |  | sim | ⬜ | |
| Home | Última sessão em destaque | não existe | planejado | sim | ⬜ | mudança deliberada |
| Sessões | Catálogo completo | Home atual | `/sessoes` | sim | ⬜ | mudança deliberada |
| Sessões | Capas | funciona |  | sim | ⬜ | |
| Sessões | Data | funciona |  | sim | ⬜ | |
| Sessões | Título | funciona |  | sim | ⬜ | |
| Sessões | Resumo curto | funciona |  | sim | ⬜ | |
| Sessões | Falas | funciona |  | sim | ⬜ | |
| Sessões | Participantes | funciona |  | sim | ⬜ | |
| Sessões | Duração | funciona |  | sim | ⬜ | |
| Sessão | Hero image | funciona |  | sim | ⬜ | |
| Sessão | Arco | funciona |  | sim | ⬜ | |
| Sessão | Resumo como default | não | planejado | sim | ⬜ | mudança deliberada |
| Resumo | Markdown completo | funciona |  | sim | ⬜ | |
| Resumo | Sanitização | funciona |  | sim | ⬜ | |
| Transcrição | Abrir transcrição | default atual | rota secundária | sim | ⬜ | mudança deliberada |
| Transcrição | Busca textual | funciona |  | sim | ⬜ | |
| Transcrição | Filtro speaker | funciona |  | sim | ⬜ | |
| Transcrição | Limpar filtros | funciona |  | sim | ⬜ | |
| Transcrição | Contador | funciona |  | sim | ⬜ | |
| Transcrição | Paginação/cursor | funciona |  | sim | ⬜ | |
| Transcrição | Infinite/progressive load | funciona |  | sim | ⬜ | |
| Transcrição | Fallback carregar mais | funciona |  | sim | ⬜ | |
| Transcrição | Empty state | funciona |  | sim | ⬜ | |
| Transcrição | Retry | funciona |  | sim | ⬜ | |
| Download | `.md` | funciona |  | sim | ⬜ | |
| Erros | Erro de API | tratado |  | sim | ⬜ | |
| Erros | Retry de rota | tratado |  | sim | ⬜ | |

## Rotas

| Origem | Alvo | Status | Nota |
| --- | --- | --- | --- |
| `#/` | `/` | ⬜ | Home muda de composição |
| `#/sessao/:id` | `/sessoes/:id/transcricao` ou bridge | ⬜ | compatibilidade de link antigo |
| `#/sessao/:id/resumo` | `/sessoes/:id` | ⬜ | compatibilidade de link antigo |

## Visual — desktop

| Tela | Dark | Light | Baseline salvo | Novo aprovado |
| --- | --- | --- | --- | --- |
| Login | ⬜ | ⬜ | ⬜ | ⬜ |
| Acesso pendente | ⬜ | ⬜ | ⬜ | ⬜ |
| Home | ⬜ | ⬜ | ⬜ | ⬜ |
| Arquivo `/sessoes` | N/A | N/A | N/A | ⬜ |
| Sessão/resumo | ⬜ | ⬜ | ⬜ | ⬜ |
| Transcrição | ⬜ | ⬜ | ⬜ | ⬜ |
| Erro | ⬜ | ⬜ | ⬜ | ⬜ |

## Visual — mobile

| Tela | Dark | Light | Baseline salvo | Novo aprovado |
| --- | --- | --- | --- | --- |
| Login | ⬜ | ⬜ | ⬜ | ⬜ |
| Home | ⬜ | ⬜ | ⬜ | ⬜ |
| Arquivo `/sessoes` | N/A | N/A | N/A | ⬜ |
| Sessão/resumo | ⬜ | ⬜ | ⬜ | ⬜ |
| Transcrição | ⬜ | ⬜ | ⬜ | ⬜ |

## Browsers

| Browser/engine | Desktop | Mobile/emulação | Status |
| --- | --- | --- | --- |
| Chromium |  |  | ⬜ |
| Firefox |  |  | ⬜ |
| WebKit |  |  | ⬜ |

## Acessibilidade

| Cenário | Status | Nota |
| --- | --- | --- |
| Pular para conteúdo | ⬜ | |
| Navegação completa por teclado | ⬜ | |
| Foco visível | ⬜ | |
| Menu de usuário acessível | ⬜ | |
| Inputs com label | ⬜ | |
| Estados loading anunciados | ⬜ | |
| Estados erro anunciados | ⬜ | |
| Contraste dark | ⬜ | |
| Contraste light | ⬜ | |
| Reduced motion | ⬜ | |

## Performance

Registrar números do legado e do novo em condições equivalentes.

| Métrica | Legado | Novo | Meta | Status |
| --- | ---: | ---: | ---: | --- |
| LCP Home |  |  | sem regressão crítica | ⬜ |
| CLS Home |  |  | aceitável | ⬜ |
| INP |  |  | aceitável | ⬜ |
| JS inicial Home |  |  | justificar qualquer aumento | ⬜ |
| LCP sessão |  |  | sem regressão crítica | ⬜ |
| Tempo busca transcrição |  |  | igual ou melhor | ⬜ |

## Segurança

| Verificação | Status | Evidência |
| --- | --- | --- |
| Nenhuma service role no browser | ⬜ | |
| Cookies/auth revisados | ⬜ | |
| RLS revisada | ⬜ | |
| Inputs validados | ⬜ | |
| Rotas protegidas | ⬜ | |
| Env separado Preview/Prod | ⬜ | |
| Headers revisados | ⬜ | |

## CI

| Check | Status |
| --- | --- |
| install | ⬜ |
| lint | ⬜ |
| typecheck | ⬜ |
| unit tests | ⬜ |
| E2E | ⬜ |
| visual tests | ⬜ |
| build | ⬜ |
| Preview smoke | ⬜ |

## Gate final

A fase de cutover só pode começar quando:

- todos os itens com `Obrigatório = sim` estiverem `✅`;
- diferenças deliberadas estiverem documentadas;
- nenhuma regressão crítica estiver aberta;
- Preview estiver aprovado pela mesa.
