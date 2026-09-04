# 10 — Contratos do app público legado

Status: **baseline verificado em código**  
Data da auditoria: **2026-09-04**  
Branch de referência do legado: **main**

## Objetivo

Congelar os contratos efetivamente usados pelo app público atual antes da migração para Next.js.

Este documento descreve o comportamento observado no código vigente. Ele não define a API futura. Durante a modernização, qualquer mudança deliberada deve ser registrada na matriz de paridade e manter compatibilidade ou possuir bridge/redirect quando necessário.

## Escopo auditado

Arquivos principais:

```txt
web/index.html
web/library.js
web/library.css
web/theme.js
web/auth-fetch.js
api/[...path].js
scripts/sync-public.js
vercel.json
package.json
.env.example
```

O app público da campanha é hoje uma aplicação estática servida a partir de `web/`, copiada para `public/` no build, com chamadas para a API serverless em `/api/*`.

---

## 1. Identidade da campanha

O frontend público usa atualmente um slug fixo:

```txt
yuhara-main
```

Em `web/library.js`:

```js
const CAMPAIGN_SLUG = 'yuhara-main';
```

Consequência para a migração:

- paridade inicial deve continuar consultando a mesma campanha;
- transformar campaign slug em contexto dinâmico é expansão arquitetural e não é requisito da primeira migração;
- se o novo app remover o hardcode, o resultado funcional ainda deve ser equivalente para a campanha atual.

---

## 2. Rotas do frontend legado

O roteamento público é feito por hash.

```txt
#/
#/sessao/:sourceSessionId
#/sessao/:sourceSessionId/resumo
```

Semântica atual:

| Rota | Tela atual |
| --- | --- |
| `#/` | catálogo completo de sessões |
| `#/sessao/:id` | transcrição da sessão |
| `#/sessao/:id/resumo` | resumo completo |

A modernização possui uma mudança deliberada de semântica:

```txt
/
/sessoes
/sessoes/:id
/sessoes/:id/transcricao
```

Mapeamento alvo:

| Legado | Novo |
| --- | --- |
| `#/` | `/` |
| catálogo completo em `#/` | `/sessoes` |
| `#/sessao/:id` | `/sessoes/:id/transcricao` ou bridge compatível |
| `#/sessao/:id/resumo` | `/sessoes/:id` |

Links antigos já compartilhados não devem simplesmente morrer no cutover. A estratégia exata de bridge/redirect será fechada antes da Fase 7.

---

## 3. Shell público

`web/index.html` define o shell estático principal.

Elementos do baseline:

- idioma `pt-BR`;
- `<meta name="viewport">`;
- `<meta name="theme-color" content="#0a0c0f">`;
- skip link para `#content`;
- header da marca;
- sigilo visual `20`;
- texto `DnD Scribe`;
- subtítulo `Arquivo da campanha`;
- theme toggle;
- avatar/menu do usuário;
- container principal `#app` com `aria-live="polite"`;
- toast com `role="status"` e `aria-live="polite"`.

Dependências carregadas no shell atual:

- `theme.js` antes do CSS;
- `library.css`;
- Supabase JS 2 via CDN;
- `marked` vendorizado;
- DOMPurify vendorizado;
- `library.js`.

Observação: `web/auth-fetch.js` existe no repositório e injeta Bearer token em requests same-origin `/api/*`, mas o `web/index.html` auditado não carrega esse arquivo. Para o shell público de sessões, o contrato ativo observado é a função `api()` de `library.js`, que já injeta o token diretamente.

---

## 4. Estado do frontend

O estado público atual é mantido em memória no browser.

Estrutura relevante:

```txt
auth
  client
  ready
  user
  apiUser
  profile
  campaignRole
  capabilities

sessions
sessionsLoaded

reader
  sourceSessionId
  session
  segments
  speakers
  total
  cursor
  query
  speaker
  loading
```

Não há store externa dedicada no app público atual.

---

## 5. Contrato de autenticação

### 5.1 Configuração pública

O frontend obtém configuração em:

```http
GET /api/auth-config
```

Resposta observada no backend:

```json
{
  "ok": true,
  "mode": "auth_required",
  "primaryProvider": "discord",
  "providers": ["discord", "google"],
  "supabaseUrl": "...",
  "publishableKey": "..."
}
```

Esses valores são públicos por natureza do client Supabase. Chaves privilegiadas não podem ser expostas.

### 5.2 Providers

O app público oferece:

- Discord;
- Google.

O login atual usa OAuth do Supabase e redireciona de volta para a origem da aplicação.

### 5.3 Sessão no browser

O client Supabase legado utiliza sessão persistida no browser e recupera o access token para chamadas autenticadas.

O helper `api(path, options)` adiciona:

```http
Authorization: Bearer <access_token>
```

quando existe sessão.

### 5.4 Perfil e acesso à campanha

Após autenticação, o frontend consulta:

```http
GET /api/auth/me?campaignSlug=yuhara-main
Authorization: Bearer <token>
```

O frontend consome pelo menos:

```txt
user
profile
campaignRole
capabilities
```

Uso observado:

- `profile` contribui para nome e avatar;
- ausência de `campaignRole` renderiza tela de acesso pendente;
- `capabilities.canOpenEdit` controla a visibilidade do link de Edit no menu.

### 5.5 Estados funcionais de auth

O novo app deve preservar estes estados:

```txt
não autenticado
→ tela de login

usuário autenticado sem campaignRole
→ acesso pendente

usuário autenticado com campaignRole
→ arquivo da campanha
```

### 5.6 Regras no servidor

O backend utiliza `requireCampaignAccess` para endpoints de leitura da biblioteca.

Comportamento observado:

- sem usuário autenticado: HTTP `401`;
- usuário autenticado sem role aprovado na campanha: HTTP `403`;
- role inadequado quando uma lista de roles for exigida: HTTP `403`.

Mensagens específicas de erro não precisam ser copiadas byte a byte na nova UI, mas os estados e limites de autorização precisam permanecer equivalentes.

---

## 6. Contrato — catálogo de sessões

Endpoint:

```http
GET /api/library-sessions?campaignSlug=yuhara-main
```

Requer acesso à campanha.

Resposta de alto nível:

```txt
ok
campaignSlug
sessions[]
```

Campos consumidos/explicados no catálogo atual:

```txt
sourceSessionId
title
sessionDate
arc
status
durationMs
summary
hasSummary
coverImageUrl
heroImageUrl
segments
participants
createdAt
updatedAt
```

Uso na Home legada:

- `sourceSessionId`: navegação;
- `title`: título do card;
- `sessionDate`: data;
- `summary`: descrição curta;
- `coverImageUrl`: arte vertical;
- `segments`: total de falas;
- `participants`: participantes;
- `durationMs`: duração.

A Home calcula o total de falas somando `segments` de todas as sessões carregadas.

### Cache observado

A biblioteca usa cache privado curto no backend, com estratégia equivalente a:

```txt
private, max-age=60, stale-while-revalidate=300
```

A nova aplicação pode alterar a implementação de cache, mas não pode transformar conteúdo privado da campanha em cache público compartilhado.

---

## 7. Contrato — resumo da sessão

Endpoint:

```http
GET /api/library-summary
  ?campaignSlug=yuhara-main
  &sourceSessionId=:id
```

Requer acesso à campanha.

Resposta:

```txt
ok
session
```

Campos relevantes observados em `session`:

```txt
sourceSessionId
title
sessionDate
arc
summary
summaryFull
hasSummary
coverImageUrl
heroImageUrl
updatedAt
```

### Markdown

`summaryFull` é Markdown.

No legado:

1. remove BOM/caracteres invisíveis iniciais conhecidos;
2. usa `marked.parse` com GFM;
3. sanitiza HTML com DOMPurify;
4. possui fallback simples em parágrafos se as bibliotecas não estiverem disponíveis.

Contrato de migração:

- o acervo Markdown atual deve continuar renderizando sem conversão manual;
- sanitização continua obrigatória;
- diferenças visuais deliberadas precisam ser homologadas;
- a nova implementação deve preferir renderização server-side quando possível.

---

## 8. Contrato — transcrição

Endpoint:

```http
GET /api/library-transcript
```

Query params consumidos:

```txt
campaignSlug\sourceSessionId
limit
cursor
q
speaker
```

Nota: na URL real, `campaignSlug` e `sourceSessionId` são parâmetros independentes; a quebra acima é apenas listagem de nomes.

Valores/regras relevantes do frontend legado:

```txt
PAGE_SIZE = 120
TRANSCRIPT_PREFETCH_MARGIN = 1200px 0px
```

Busca e speaker são limitados no backend e tratados como filtros opcionais.

Resposta consumida:

```txt
session
segments[]
speakers[]
total
nextCursor
```

Campos de cada segmento usados visualmente:

```txt
id
startMs
endMs
speaker
text
```

O backend também pode retornar dados adicionais de revisão; o player público não deve depender deles para renderizar a transcrição básica.

### Comportamento obrigatório da transcrição

- primeira página limitada;
- cursor para páginas seguintes;
- evitar duplicação de segmentos ao append;
- busca textual;
- filtro por speaker;
- limpar filtros;
- contador de carregados/resultados;
- carregamento incremental;
- `IntersectionObserver` quando disponível;
- botão manual `Carregar mais falas` como fallback sem `IntersectionObserver`;
- empty state;
- retry em erro de append;
- loading state.

Quando não existem filtros, o status atual é conceitualmente:

```txt
X de Y falas
```

Com busca/filtro:

```txt
X resultado(s)
```

---

## 9. Contrato — download da transcrição

Endpoint:

```http
GET /api/session-download
  ?campaignSlug=yuhara-main
  &sourceSessionId=:id
```

Requer Bearer token no fluxo atual.

Comportamento do frontend:

1. faz fetch autenticado;
2. recebe blob;
3. cria URL temporária;
4. cria `<a download>`;
5. dispara o download;
6. revoga a URL.

O nome do arquivo é derivado do título e sanitizado pelo frontend.

A resposta do backend é Markdown para download e usa cache privado/no-store no fluxo correspondente.

Paridade significa preservar a capacidade de baixar a transcrição em `.md`; a implementação interna pode mudar.

---

## 10. Contrato de imagens

O app público diferencia:

```txt
coverImageUrl
heroImageUrl
```

Uso:

- `coverImageUrl`: cards do catálogo;
- `heroImageUrl`: abertura da sessão/transcrição/resumo.

O frontend legado só usa URLs de imagem iniciadas por HTTPS nos pontos auditados.

A modernização deve preservar:

- proporção adequada dos cards;
- hero sem layout shift evitável;
- alt text contextual no hero;
- ausência de carregamento massivo desnecessário.

---

## 11. Contrato de tema

Tema atual possui três estados conceituais:

```txt
system
light
dark
```

O valor explícito é persistido no `localStorage` sob:

```txt
dnd-scribe-theme
```

Ausência de valor explícito significa seguir o sistema operacional.

O seletor atual cicla:

```txt
system → light → dark → system
```

Quando o usuário está em `system`, mudanças de `prefers-color-scheme` atualizam a interface.

A modernização pode alterar o mecanismo de persistência para evitar flash e suportar SSR, mas deve preservar:

- dark;
- light;
- preferência do sistema;
- persistência da escolha;
- ausência de flash visual relevante no carregamento.

---

## 12. Tokens visuais legados relevantes

### Dark

```txt
ink            #0a0c0f
ink-soft       #101419
panel          #151a20
panel-hover    #1a2027
line           #2a3038
paper          #eee8dc
paper-soft     #c8c2b7
muted          #8f969f
gold           #d7aa61
gold-bright    #f2c879
```

### Light

```txt
ink            #f3efe7
ink-soft       #fffdf8
panel          #e9e3d8
panel-hover    #ffffff
line           #c8c0b3
paper          #191917
paper-soft     #4f4b44
muted          #6a655d
gold           #805817
gold-bright    #9a6a1d
```

Tipografia:

```txt
serif: Georgia, "Times New Roman", serif
sans: Inter, ui-sans-serif, system stack
```

Esses valores são baseline, não obrigação eterna de hexadecimal. O Design System novo deve preservar a identidade e documentar alterações deliberadas.

---

## 13. Contratos de formatação

### Data

- locale atual: `pt-BR`;
- formato visível: dia, mês por extenso, ano.

### Duração

Exemplos conceituais:

```txt
2h40
42 min
```

### Timestamp da transcrição

Sem hora:

```txt
MM:SS
```

Com duração maior que uma hora:

```txt
H:MM:SS
```

### Título

O frontend possui normalização para títulos técnicos antigos, incluindo padrões equivalentes a:

```txt
Sessão Craig ...
YYYYMMDD-sessao
```

Nesses casos pode apresentar `Sessão de <data>`.

Esse comportamento deve ser testado com sessão real antiga antes do cutover.

---

## 14. Estados de UI que fazem parte da paridade

### Globais

- loading;
- login;
- login com erro;
- acesso pendente;
- erro de rota/API;
- retry;
- empty state.

### Sessões

- catálogo com sessões;
- catálogo vazio.

### Transcrição

- carregando primeira página;
- carregando mais;
- resultado vazio;
- busca ativa;
- speaker ativo;
- filtros limpos;
- erro ao carregar mais;
- fim do cursor.

---

## 15. Acessibilidade já existente no legado

Itens confirmados no shell/CSS/markup auditado:

- skip link;
- `focus-visible` explícito;
- classe `sr-only`;
- labels visuais ou screen-reader-only nos filtros;
- `aria-expanded`/`aria-controls` no menu do usuário;
- `aria-live` no app e toast;
- `role="status"` no toast;
- alt contextual em hero images.

Esses comportamentos são piso, não teto. A migração não pode remover acessibilidade já existente.

---

## 16. Mudanças deliberadas já aprovadas

Estas diferenças não são regressões:

1. Home deixa de ser o catálogo completo e vira entrada da campanha usando apenas dados já existentes.
2. `/sessoes` passa a concentrar o catálogo cronológico completo.
3. Resumo vira a entrada padrão de uma sessão.
4. Transcrição vira rota/recurso secundário da sessão.
5. Navegação deixa hash routing e passa para rotas reais do App Router.
6. Auth poderá migrar de sessão exclusivamente client-side para integração SSR/cookies oficial do Supabase.
7. Markdown poderá ser renderizado no servidor em vez do browser.

Todas as demais diferenças funcionais precisam ser justificadas antes de serem aceitas.

---

## 17. Pontos que NÃO devem ser confundidos com contrato futuro

Existem no backend atual rotas e conteúdos além do player público, incluindo Central Local, operação, lore específica e integrações.

A existência dessas rotas não significa que serão migradas para o novo app público neste roadmap.

O escopo desta auditoria é:

```txt
auth do jogador
home pública autenticada
catálogo de sessões
resumo
transcrição
download
tema
shell da campanha
```

---

## 18. Gate deste documento

Contrato legado considerado suficientemente congelado quando:

- [x] rotas do player público identificadas;
- [x] auth e estados de acesso identificados;
- [x] endpoints usados pelo player identificados;
- [x] principais campos consumidos identificados;
- [x] comportamento da transcrição identificado;
- [x] contrato de tema identificado;
- [x] comportamento de Markdown identificado;
- [x] estados de erro/loading identificados;
- [x] baseline de acessibilidade em código identificado;
- [ ] endpoints exercitados por testes automatizados de contrato na nova aplicação;

O último item pertence às fases de implementação/paridade; não bloqueia o encerramento documental da auditoria de código da Fase 0.
