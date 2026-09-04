# 37 — Execução da Fase 11 — Paridade Total

Status: **EM EXECUÇÃO — bloco automatizado verde; homologação autenticada pendente**  
Data de início: **2026-09-04**  
Branch: `modernizacao/fase-11-paridade-base`  
PR: `#36`

## Objetivo

Transformar o estado moderno já implementado em um release candidate verificável contra o app legado, sem confundir cobertura automatizada com homologação real.

A Fase 11 só termina quando a matriz obrigatória estiver verde e as diferenças deliberadas estiverem registradas.

## Estado de entrada

A execução começou com:

```txt
Fases 3–9 tecnicamente implementadas
Fase 10 com otimizações implementadas
benchmark autenticado legado x moderno ainda pendente
projeto Vercel Next separado criado
Preview Next real READY
produção legada preservada
```

Preview técnico já identificado:

```txt
Project: dnd-scribe-web-next
Project ID: prj_RVVEAucDhhftHY3UlE8PtoNxn6yl
Deployment: dpl_Ha9etK6sk3e96qmqVxJTCmz6fLoQ
Source commit: bf7ce242d083825cc65ee03354b3c638c95e87f0
State: READY
```

Esse deployment prova build/infra isolada, mas não é o release candidate final da Fase 11 porque a branch continuou avançando depois dele.

## 1. Matriz real de browsers

A Fase 11 ampliou o gate de Chromium Desktop para:

```txt
Desktop Chromium
Desktop Firefox
Desktop WebKit
Mobile Chromium
Mobile WebKit
```

Configuração Playwright:

```txt
desktop-chromium → Desktop Chrome
desktop-firefox  → Desktop Firefox
desktop-webkit   → Desktop Safari
mobile-chromium  → Pixel 5
mobile-webkit    → iPhone 13
```

O mesmo conjunto E2E roda nas cinco configurações para detectar diferenças de layout, teclado/foco, headers/requests, routing, shell, reflow, reduced motion e estrutura semântica.

## 2. CI ampliado

O workflow `Web Next CI` agora executa:

```txt
pnpm install --frozen-lockfile
typecheck
lint
unit tests
Next production build
audit do client bundle
medição do client bundle
Playwright Chromium + Firefox + WebKit
E2E em 5 projetos desktop/mobile
```

Também foram incorporados:

- `pnpm/action-setup@v6`;
- `actions/upload-artifact@v7` para preservar `test-results`/traces em falhas;
- timeout de 20 minutos para não reduzir cobertura pela instalação das engines.

## 3. Achados reais da matriz

### 3.1 WebKit e política de foco de links

A primeira execução com WebKit encontrou:

```txt
Web Next CI #57
56 passed
1 failed  — mobile-webkit
1 flaky   — desktop-webkit
2 skipped
```

O teste assumia que link receberia foco programático da mesma forma em todas as engines. Safari/WebKit condiciona parte desse comportamento à preferência Full Keyboard Access.

A suíte foi separada corretamente:

- todas as engines verificam semântica e ativação do skip link;
- Chromium/Firefox também verificam foco programático, foco visível, Enter e primeira parada de Tab;
- WebKit não recebe uma expectativa que depende de preferência externa do navegador/OS.

### 3.2 Actionability de ponteiro em skip link oculto

Depois, `Web Next CI #65` encontrou:

```txt
56 passed
5 failed
4 skipped
```

Os cinco failures vinham de `locator.click()` tentando clicar por ponteiro num link que fica intencionalmente acima da viewport até receber foco (`-translate-y-24`).

Isso era uma premissa errada do teste, não defeito de acessibilidade do componente.

A prova comum passou a acionar o elemento pela semântica nativa do DOM e continua verificando:

```txt
href = #content
target tabindex = -1
foco transferido ao #content
hash atualizado para #content
```

A interação real por teclado continua coberta separadamente.

## 4. Gate automatizado verde

A execução que fechou este bloco foi:

```txt
Web Next CI #69
run: 33923147976
E2E: 75 cenários em 5 projetos
71 passed
4 skipped intencionalmente
0 failed
duração E2E: 1.1m
```

Os quatro skips são exclusivamente os dois checks de foco/Tab executados em cada projeto WebKit, pelas razões documentadas acima. Não representam regressões funcionais.

No mesmo ciclo, o CI legado também permaneceu verde:

```txt
CI #388
run: 33923147957
Companion regression tests ✅
App checks                ✅
Python syntax             ✅
```

O Web Next também confirmou no mesmo run:

```txt
TypeScript              ✅
ESLint                  ✅
Vitest                  ✅ — 12 arquivos / 25 testes
Next production build   ✅
Client bundle audit     ✅ — 18 arquivos / 0 marcadores server-only
Bundle inventory        ✅
Multi-browser E2E       ✅ — 71 passed / 4 skipped / 0 failed
```

Inventário do build observado:

```txt
JS:  881.3 KiB raw / 265.0 KiB gzip em 17 arquivos
CSS: 32.4 KiB raw /   6.6 KiB gzip em 1 arquivo
```

Esses números continuam sendo inventário global dos chunks emitidos, não transferência inicial por rota.

## 5. Higiene encontrada durante o gate

Foram removidos ruídos que deixavam o pipeline menos determinístico:

- export anônimo no `postcss.config.mjs`;
- `.next/dev/types/**/*.ts` incorporado ao `tsconfig.json`;
- Vitest movido para `vitest.config.mts`, deixando ESM explícito.

Nenhuma dessas mudanças altera domínio ou UX.

## 6. Compatibilidade de links históricos

Além do teste unitário do mapeamento de hash, a Fase 11 adicionou E2E real no browser:

```txt
/#/sessao/sessao-42/resumo → /sessoes/sessao-42
/#/sessao/sessao-42        → /sessoes/sessao-42/transcricao
```

Sem envs privados, os destinos terminam nos estados técnicos seguros das páginas, provando o redirecionamento sem fabricar dados de campanha.

## 7. Corpus real preparado

O banco foi inspecionado somente em leitura para preparar um corpus fixo de sessões publicadas:

```txt
docs/modernizacao/39-fase-11-corpus-homologacao.md
```

O corpus contém casos reais para:

- sessão mais recente e resumo muito longo;
- maior transcrição publicada;
- busca e filtro por falante;
- transcrição mínima/histórica;
- duração ausente;
- `source_session_id` longo/manual;
- Markdown real com headings, listas e blockquotes.

Também ficou documentado que o snapshot atual não possui sessão publicada sem hero/cover. Fallback de arte permanece coberto deterministicamente, mas não será vendido como evidência real do corpus.

## 8. O que a automação já prova

Sem credenciais reais, o conjunto local/CI prova:

- build App Router;
- shell técnico seguro sem env;
- estrutura semântica;
- skip link;
- foco visível nas engines em que navegação completa por links está habilitada;
- reduced motion;
- reflow estreito;
- headers de segurança;
- proteção cross-origin do logout;
- contratos unitários de auth/library/summary;
- sanitização de Markdown;
- normalização de artwork;
- bridge das rotas legadas;
- ausência de marcadores server-only no client bundle;
- não regressão dos checks legados/companion.

Isso é evidência técnica forte, mas não substitui sessão real.

## 9. O que continua exigindo release candidate autenticável

Ainda não pode ser marcado como PASS:

```txt
Google OAuth real
Discord OAuth real
membership aprovada
membership pendente
refresh de sessão real
profile/avatar real
capabilities reais
Home com acervo real pelo BFF
/sessoes com conjunto completo real
resumo real
transcrição real longa
search real
speaker filter real
cursor real
infinite/progressive load real
download real
visual dark/light autenticado
zoom 200% autenticado
cookies HTTPS
benchmark legado x Next
```

Esses itens permanecem no gate da Fase 11/12.

## 10. Preview Next e limitação externa

O deployment isolado existe e está READY, porém o Preview está sujeito à Deployment Protection da Vercel e não substitui um browser autenticado real para a homologação do produto.

Além disso, a API de deploy do plano Hobby atingiu o limite diário:

```txt
resource: api-deployments-free-per-day
remaining: 0
reset: 2026-09-05T21:12:30.716Z
```

Nenhum deploy redundante será criado antes do reset.

Enquanto isso, seguem válidos: CI, testes, documentação, contratos, segurança, acessibilidade e preparação do corpus.

## 11. Política para o próximo release candidate

Quando a API de deploy voltar a permitir nova publicação, criar um candidato formal pinado no SHA verde mais recente e registrar:

```txt
source SHA
deployment ID
URL
framework/runtime
data/hora
resultado CI
resultado matriz browsers
```

Se qualquer correção mudar o SHA, nasce um novo candidato.

## 12. Ordem restante da Fase 11

```txt
A. matriz multi-browser no CI                         ✅
B. corrigir regressões encontradas                    ✅
C. consolidar checks determinísticos                  ✅
D. preparar corpus real                               ✅
E. obter release candidate autenticável               ⬜
F. comparar Home e /sessoes                           ⬜
G. comparar resumo/Markdown real                      ⬜
H. comparar transcrição e queries fixas               ⬜
I. comparar download                                  ⬜
J. validar hash bridge com sessão real                ⬜
K. validar erros reais                                ⬜
L. validar visual dark/light desktop/mobile           ⬜
M. incorporar benchmark autenticado da Fase 10        ⬜
N. identificar release candidate final                ⬜
```

## 13. Feature freeze

Continua proibido introduzir domínio novo nesta fase:

```txt
NPCs
Pessoas
Mundo
busca global
timeline
grafo
lore editor
coleções
```

## 14. Gate deste bloco

```txt
Playwright Desktop Chromium configurado ✅
Playwright Desktop Firefox configurado  ✅
Playwright Desktop WebKit configurado   ✅
Playwright Mobile Chromium configurado  ✅
Playwright Mobile WebKit configurado    ✅
CI instala as três engines              ✅
regressões multi-browser analisadas      ✅
correções determinísticas aplicadas      ✅
hash bridge coberto por E2E              ✅
corpus real de homologação preparado     ✅
5 projetos Playwright verdes             ✅
Web Next CI #69 verde                     ✅
CI legado #388 verde                      ✅
release candidate autenticável            ⬜
paridade com dados reais                   ⬜
benchmark autenticado                      ⬜
homologação visual/manual                  ⬜
```

**Conclusão deste bloco:** a parte automatizável da Fase 11 está verde. A fase permanece aberta exclusivamente porque os itens restantes exigem um release candidate autenticável e comparação real com o legado.
