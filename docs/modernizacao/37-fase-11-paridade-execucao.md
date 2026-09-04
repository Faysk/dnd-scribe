# 37 — Execução da Fase 11 — Paridade Total

Status: **EM EXECUÇÃO**  
Data de início: **2026-09-04**  
Branch inicial: `modernizacao/fase-11-paridade-base`

## Objetivo

Transformar o estado moderno já implementado em um release candidate verificável contra o app legado, sem confundir cobertura automatizada com homologação real.

A Fase 11 só termina quando a matriz obrigatória estiver verde e as diferenças deliberadas estiverem registradas.

## Estado de entrada

A execução começa com:

```txt
Fases 3–9 tecnicamente implementadas
Fase 10 com otimizações implementadas
benchmark autenticado legado x moderno ainda pendente
projeto Vercel Next separado criado
Preview Next real READY
produção legada preservada
```

Preview técnico identificado:

```txt
Project: dnd-scribe-web-next
Project ID: prj_RVVEAucDhhftHY3UlE8PtoNxn6yl
Deployment: dpl_Ha9etK6sk3e96qmqVxJTCmz6fLoQ
Source commit: bf7ce242d083825cc65ee03354b3c638c95e87f0
State: READY
```

## 1. Primeiro bloco — matriz real de browsers

O CI inicial validava Playwright apenas em Chromium Desktop.

A Fase 11 amplia o gate para a matriz mínima definida no plano:

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

O mesmo conjunto E2E roda em todas as engines para detectar diferenças reais de:

- layout;
- teclado/foco;
- headers/requests;
- routing;
- auth shell;
- reflow;
- reduced motion;
- estrutura semântica.

## 2. CI ampliado

O workflow `Web Next CI` passa a instalar:

```txt
chromium
firefox
webkit
```

E executa os testes em cinco projetos Playwright.

O timeout do job foi elevado de 15 para 20 minutos para absorver instalação das engines sem reduzir cobertura.

Também foram adicionados dois cuidados operacionais durante a execução da Fase 11:

- `pnpm/action-setup` atualizado da linha v4 para v6, eliminando dependência da action antiga baseada em Node 20;
- artefatos de falha do Playwright preservados por sete dias com `actions/upload-artifact@v7`, permitindo inspecionar `test-results`, traces e error contexts quando o gate falhar.

Nenhum browser é marcado como aprovado antes do workflow real passar.

## 3. Primeiro achado real da matriz — foco no WebKit

A primeira execução com WebKit encontrou uma diferença real no teste do skip link.

Evidência inicial:

```txt
Web Next CI #57
56 passed
1 failed  — mobile-webkit
1 flaky   — desktop-webkit
2 skipped
```

O ponto de falha era a expectativa de que um link recebesse foco programático no WebKit da mesma forma que Chromium/Firefox.

Uma segunda tentativa adicionando `tabIndex=0` explicitamente não resolveu o comportamento do runner WebKit. Isso confirmou que o teste misturava duas responsabilidades diferentes:

1. semântica e ativação do skip link;
2. política de foco de links da engine/Safari, dependente de Full Keyboard Access.

A suíte foi então separada:

- todas as engines verificam `href="#content"`, target com `tabindex=-1`, ativação e foco transferido para `#content`;
- Chromium e Firefox também verificam foco programático, foco visível, Enter e primeira parada de Tab;
- WebKit não recebe um falso requisito de foco de link que depende da preferência de Full Keyboard Access do usuário.

Isso mantém a exigência de acessibilidade do produto sem transformar uma preferência da engine em falso negativo de CI.

### 3.1 Segundo achado — actionability de ponteiro em elemento intencionalmente oculto

A execução `Web Next CI #65` encontrou um segundo problema, desta vez no próprio teste e de forma consistente nas cinco engines:

```txt
56 passed
5 failed
4 skipped
```

Os cinco failures eram o mesmo cenário:

```txt
skip link aponta para o conteúdo e ativa o destino
```

O Playwright recusava `locator.click()` porque o skip link fica intencionalmente deslocado acima da viewport com `-translate-y-24` até receber foco.

Isso não representa defeito do produto: o componente é deliberadamente invisível para pointer enquanto não está em uso, mas continua disponível para teclado e tecnologia assistiva.

Correção aplicada no teste:

- a prova comum a todas as engines usa a ativação nativa `HTMLAnchorElement.click()` via DOM;
- continua verificando `href`, `tabindex=-1`, foco transferido ao `#content` e atualização do hash;
- o cenário separado Chromium/Firefox continua exercitando foco visível e `Enter`, cobrindo interação real por teclado sem transformar pointer actionability em requisito do skip link.

A correção preserva o comportamento do produto e remove apenas uma premissa incorreta da automação.

A partir dessa falha, os artefatos Playwright passaram a ser preservados automaticamente quando o job falha. A execução #65 comprovou o fluxo de upload de `test-results`/traces.

## 4. Higiene encontrada durante o gate

A execução de paridade também revelou warnings que não eram regressões funcionais, mas deixavam o gate ruidoso.

Foram corrigidos:

- export anônimo do `postcss.config.mjs`;
- include de `.next/dev/types/**/*.ts` no `tsconfig.json`, evitando reescrita automática pelo build do Next;
- configuração do Vitest movida para `vitest.config.mts`, declarando ESM de forma explícita.

Essas correções não mudam domínio nem UX; apenas tornam o gate mais determinístico.

## 5. O que a automação atual já consegue provar

Sem credenciais reais, o conjunto local/CI pode provar:

- build do App Router;
- shell de login sem env;
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
- bridge de rotas legadas;
- ausência de marcadores server-only no client bundle.

Além do teste unitário do mapeamento de hash, a Fase 11 adicionou E2E para a bridge real no browser:

```txt
/#/sessao/sessao-42/resumo → /sessoes/sessao-42
/#/sessao/sessao-42        → /sessoes/sessao-42/transcricao
```

Sem envs de autenticação, os destinos terminam nos estados técnicos seguros das páginas, o que permite provar o redirecionamento sem fabricar uma sessão.

Esses testes são evidência técnica, não aprovação do fluxo autenticado completo.

## 6. Corpus real preparado para a homologação

Enquanto o deploy está limitado, o banco foi inspecionado em modo somente leitura para preparar um corpus fixo de sessões publicadas.

O inventário completo e as consultas fixas estão em:

```txt
docs/modernizacao/39-fase-11-corpus-homologacao.md
```

O corpus obrigatório inclui casos reais para:

- sessão mais recente e resumo muito longo;
- maior transcrição publicada;
- busca e filtro por falante;
- transcrição mínima/histórica;
- duração ausente;
- `source_session_id` longo/manual;
- Markdown real com headings, listas e blockquotes.

Também ficou documentado que o snapshot atual não possui sessão publicada sem hero/cover, portanto fallback de arte não será falsamente apresentado como caso real de paridade.

## 7. O que continua exigindo sessão real

Não será falsamente marcado como PASS usando mocks:

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
benchmark autenticado
```

Esses itens exigem release candidate acessível e sessão real aprovada.

## 8. Preview Next e proteção Vercel

O deployment isolado existe e está READY.

Porém o Preview está sujeito à Deployment Protection da Vercel. A superfície de acesso atual gera share links, mas a inspeção HTTP automatizada não conserva o cookie do fluxo SSO de proteção de forma suficiente para substituir um browser autenticado real.

Consequência:

- build/infra = validado;
- navegação real autenticada = ainda não homologada.

## 9. Limite diário de deploy

A API de deploy do plano Hobby atingiu o limite diário durante a criação/validação do projeto:

```txt
resource: api-deployments-free-per-day
remaining: 0
reset: 2026-09-05T21:12:30.716Z
```

Não serão gerados deploys redundantes antes do reset.

O deployment READY existente continua sendo evidência válida do build.

Enquanto esse limite estiver ativo, a execução continua em tudo que não depende de um novo deployment:

- CI;
- matriz multi-browser;
- correções determinísticas;
- documentação de evidência;
- contratos;
- segurança;
- acessibilidade;
- corpus real de homologação;
- preparação da homologação real.

## 10. Política para release candidate

Quando um novo deploy puder ser criado, ele deverá ser tratado como candidato formal, não como preview descartável.

Registrar sempre:

```txt
source SHA
deployment ID
URL
framework/runtime
data/hora
resultado CI
resultado matriz browsers
```

Se uma correção mudar o SHA, nasce um novo candidato.

## 11. Ordem de execução da Fase 11

```txt
A. matriz multi-browser no CI
B. corrigir regressões encontradas
C. consolidar checks determinísticos na matriz
D. preparar corpus real de sessões para comparação
E. obter sessão real no candidato
F. comparar Home e /sessoes
G. comparar resumo/Markdown
H. comparar transcrição e queries fixas
I. comparar download
J. validar hash bridge
K. validar erros
L. validar visual dark/light desktop/mobile
M. incorporar benchmark da Fase 10
N. identificar release candidate final
```

## 12. Feature freeze

Continua proibido usar a Fase 11 para introduzir domínio novo.

Qualquer ideia como:

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

continua fora deste ciclo.

## 13. Gate deste primeiro bloco

```txt
Playwright Desktop Chromium configurado ✅
Playwright Desktop Firefox configurado  ✅
Playwright Desktop WebKit configurado   ✅
Playwright Mobile Chromium configurado  ✅
Playwright Mobile WebKit configurado    ✅
CI instala as três engines              ✅
workflow executado                       ✅
regressão WebKit identificada            ✅
actionability falsa identificada         ✅
correções determinísticas aplicadas      ✅
hash bridge coberto por E2E              ✅
corpus real de homologação preparado     ✅
5 projetos Playwright verdes             ⬜
último workflow do head verde            ⬜
```

O documento só marcará os dois últimos itens como concluídos depois da execução real do SHA mais recente da branch.
