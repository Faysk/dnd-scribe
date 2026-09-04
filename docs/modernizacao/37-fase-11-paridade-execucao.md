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

Nenhum browser é marcado como aprovado antes do workflow real passar.

## 3. O que a automação atual já consegue provar

Sem credenciais reais, o conjunto local/CI pode provar:

- build do App Router;
- shell de login sem env;
- estrutura semântica;
- skip link;
- foco visível;
- reduced motion;
- reflow estreito;
- headers de segurança;
- proteção cross-origin do logout;
- contratos unitários de auth/library/summary;
- sanitização de Markdown;
- normalização de artwork;
- bridge de rotas legadas;
- ausência de marcadores server-only no client bundle.

Esses testes são evidência técnica, não aprovação do fluxo autenticado completo.

## 4. O que continua exigindo sessão real

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

## 5. Preview Next e proteção Vercel

O deployment isolado existe e está READY.

Porém o Preview está sujeito à Deployment Protection da Vercel. A superfície de acesso atual gera share links, mas a inspeção HTTP automatizada não conserva o cookie do fluxo SSO de proteção de forma suficiente para substituir um browser autenticado real.

Consequência:

- build/infra = validado;
- navegação real autenticada = ainda não homologada.

## 6. Limite diário de deploy

A API de deploy do plano Hobby atingiu o limite diário durante a criação/validação do projeto:

```txt
resource: api-deployments-free-per-day
remaining: 0
reset: 2026-09-05T21:12:30.716Z
```

Não serão gerados deploys redundantes antes do reset.

O deployment READY existente continua sendo evidência válida do build.

## 7. Política para release candidate

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

## 8. Ordem de execução da Fase 11

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

## 9. Feature freeze

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

## 10. Gate deste primeiro bloco

```txt
Playwright Desktop Chromium configurado ✅
Playwright Desktop Firefox configurado  ✅
Playwright Desktop WebKit configurado   ✅
Playwright Mobile Chromium configurado  ✅
Playwright Mobile WebKit configurado    ✅
CI instala as três engines              ✅
workflow executado                       ⬜
5 projetos Playwright verdes             ⬜
regressões corrigidas                     ⬜
```

O documento será atualizado com a evidência do workflow antes de marcar este bloco como concluído.
