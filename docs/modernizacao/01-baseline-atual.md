# 01 — Baseline atual

Status: **Fase 0 em execução — auditoria de código concluída, baseline visual parcial**

## Objetivo

Registrar o comportamento e a estrutura do app público atual antes da modernização. Este documento é referência de paridade e não define a arquitetura futura.

## Documentos de evidência da Fase 0

Este baseline é complementado por:

- [10 — Contratos do app público legado](10-contratos-legado-app-publico.md) — rotas, auth, endpoints, transcrição, tema e formatos efetivamente consumidos;
- [11 — Fase 0: evidências e checklist](11-fase-0-evidencias-e-checklist.md) — matriz de capturas, itens concluídos e pendências para congelar o baseline;
- [12 — Inventário de deploy e dependências do legado](12-inventario-deploy-e-dependencias-legado.md) — build, Vercel, API, Central Local, env e riscos de coexistência.

A auditoria documental de código está suficientemente detalhada para orientar a migração. A Fase 0 permanece aberta porque o baseline visual oficial ainda precisa ser congelado/versionado, especialmente em mobile e estados de auth/erro.

## Aplicação pública atual

O app de leitura usado pelos jogadores vive principalmente em `web/`.

Arquivos centrais:

```txt
web/index.html
web/library.js
web/library.css
web/theme.js
web/auth-fetch.js
```

O `index.html` fornece o shell da aplicação e o container `#app`. A interface principal é renderizada dinamicamente por JavaScript.

## Estado atual do frontend

O estado de `web/library.js` é organizado principalmente em:

```txt
auth
sessions
reader
```

A aplicação mantém:

- usuário autenticado;
- perfil e papel na campanha;
- capabilities;
- catálogo de sessões;
- sessão aberta;
- segmentos de transcrição;
- speakers;
- filtros;
- paginação/cursor;
- estado de carregamento.

## Rotas atuais

O roteamento público usa hash:

```txt
#/
#/sessao/:sourceSessionId
#/sessao/:sourceSessionId/resumo
```

Semântica atual:

```txt
#/sessao/:id
→ transcrição

#/sessao/:id/resumo
→ resumo completo
```

Essa hierarquia será deliberadamente invertida na modernização.

## Home atual

A Home apresenta:

- eyebrow `DnD Scribe`;
- título `Nossas sessões`;
- descrição do arquivo;
- total de sessões;
- total de falas;
- grid cronológica de sessões.

Cada card pode exibir:

- capa;
- data;
- título;
- resumo curto;
- número de falas;
- participantes;
- duração.

## Página atual de sessão / transcrição

Ao abrir um card, a rota padrão carrega a transcrição.

O cabeçalho apresenta:

- link para voltar;
- hero da sessão, quando disponível;
- arco;
- título;
- data;
- duração;
- total de falas;
- resumo curto;
- botão para ler o resumo, quando existe;
- botão para baixar a transcrição `.md`.

A transcrição possui:

- busca textual;
- filtro por speaker;
- status de quantidade carregada;
- paginação por cursor;
- carregamento automático com `IntersectionObserver`;
- fallback manual de carregar mais;
- estados de erro;
- download Markdown.

O tamanho de página atual é 120 segmentos.

## Página atual de resumo

O resumo é uma rota separada e secundária.

A página possui:

- hero;
- título;
- botão de download da transcrição;
- conteúdo Markdown completo.

O Markdown atual é convertido com `marked` e sanitizado com DOMPurify.

## Auth e acesso

O app público atual trabalha com:

- Supabase Auth;
- usuário autenticado;
- perfil da mesa;
- `campaignRole`;
- `capabilities`;
- menu de usuário;
- visibilidade condicional do acesso de edição.

O comportamento sem perfil aprovado também deve ser preservado durante a migração.

## Temas

Existem dark e light mode.

### Dark

Características principais:

- canvas quase preto;
- superfícies azuladas/escuras;
- texto em tom de papel;
- dourado como accent;
- imagens integradas ao fundo;
- estética de grimório/arquivo cinematográfico.

### Light

Características principais:

- canvas creme/papel;
- texto escuro;
- bronze/ocre como accent;
- cards claros com borda discreta;
- estética de arquivo editorial/livro ilustrado.

## Tokens visuais atuais relevantes

O CSS atual já possui uma base de tokens semânticos, incluindo:

```txt
--ink
--ink-soft
--panel
--panel-hover
--line
--line-soft
--paper
--paper-soft
--muted
--gold
--gold-bright
--gold-fade
--danger
--success
--shadow
--radius
--serif
--sans
```

A modernização deve transformar esse vocabulário em design system, não descartá-lo.

## Acessibilidade já existente

Há fundações que devem ser preservadas:

- skip link;
- `focus-visible`;
- `sr-only`;
- `aria-label`;
- `aria-live`;
- estados de menu;
- feedback de loading/erro.

## Backend e local-first

A modernização do app público não substitui a arquitetura local-first.

Continuam fora do browser público:

- ZIP Craig;
- FLACs;
- modelo Whisper;
- transcrição e artefatos pesados locais;
- processamento GPU/CPU;
- jobs locais.

A nuvem continua responsável pelo conteúdo pequeno e compartilhável.

## Build/runtime atuais

O repositório já utiliza Node 24.x e possui scripts de verificação para web, API, workers, monitoring, Roll20 e companion.

A modernização deve integrar-se ao CI existente sem remover as proteções atuais antes de existirem substitutos equivalentes.

## Golden baseline visual

Antes da implementação da nova interface devem ser congeladas imagens de referência de, no mínimo:

```txt
desktop/home-dark
desktop/home-light
desktop/session-dark
desktop/session-light
desktop/summary-dark
desktop/summary-light
desktop/transcript-dark
desktop/transcript-light
mobile/home-dark
mobile/home-light
mobile/session-dark
mobile/session-light
mobile/transcript-dark
mobile/transcript-light
```

Já existem capturas reais de Home dark, Home light e sessão/transcrição dark fornecidas durante o planejamento. Elas ainda precisam ser promovidas a baseline oficial versionado ou reproduzível. A matriz detalhada está em `11-fase-0-evidencias-e-checklist.md`.

## Golden baseline funcional

Fluxos obrigatórios:

1. login;
2. acesso aprovado;
3. acesso pendente;
4. Home;
5. abrir sessão;
6. ler resumo;
7. abrir transcrição;
8. buscar transcrição;
9. filtrar por speaker;
10. carregar mais falas;
11. limpar filtros;
12. baixar `.md`;
13. trocar tema;
14. abrir menu do usuário;
15. logout;
16. tratamento de erro e retry.

## Estado atual do gate

### Concluído

- [x] escopo congelado;
- [x] mapa de código principal;
- [x] rotas identificadas;
- [x] auth identificada;
- [x] contratos de API do player identificados;
- [x] tema identificado;
- [x] comportamento de resumo identificado;
- [x] comportamento da transcrição identificado;
- [x] build/deploy atual inventariado;
- [x] riscos de coexistência documentados.

### Pendente

- [ ] screenshots desktop essenciais congelados/versionados;
- [ ] screenshots mobile essenciais congelados/versionados;
- [ ] estados de login/acesso pendente/erro congelados visualmente;
- [ ] baseline técnico de performance medido de forma reproduzível.

## Critério de encerramento desta fase

O baseline está concluído quando os screenshots, fluxos e contratos acima estiverem registrados de forma reproduzível e puderem ser usados nos testes de paridade do novo app.

Enquanto os itens visuais essenciais não estiverem congelados:

```txt
FASE 0 = EM EXECUÇÃO
```
