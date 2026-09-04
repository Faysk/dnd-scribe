# 21 — Fase 7: plano de execução da Página de Sessão

Status: **pré-planejado; execução depende da Fase 6 concluída**

## Objetivo

Migrar a experiência de uma sessão individual e corrigir a hierarquia central do produto:

> sessão representa a memória; transcrição é um recurso dessa memória.

A partir desta fase, abrir uma sessão deve levar ao resumo por padrão.

---

## 1. Mudança deliberada de semântica

### Legado

```txt
#/sessao/:id
→ transcrição

#/sessao/:id/resumo
→ resumo
```

### Novo

```txt
/sessoes/[id]
→ resumo

/sessoes/[id]/transcricao
→ transcrição
```

Esta é uma mudança aprovada, não uma regressão de paridade.

---

## 2. Pergunta principal da página

A rota base responde:

> o que aconteceu nessa sessão?

A rota de transcrição responde:

> o que foi dito exatamente?

A UI deve tornar essa diferença óbvia sem esconder a transcrição.

---

## 3. Estrutura da rota base

Composição conceitual:

```txt
← Todas as sessões

Hero

ARCO / EYEBROW
Título da sessão
Data · duração · falas

Resumo | Transcrição

lead/resumo curto opcional

Resumo completo em Markdown
```

### Ações

Primária contextual:

```txt
Resumo
```

como conteúdo já selecionado, não necessariamente como botão dourado.

Secundárias:

```txt
Transcrição
Voltar às sessões
```

Download da transcrição permanece disponível, mas não deve competir com a leitura do resumo no topo da página.

---

## 4. Dados

Fonte durante coexistência:

```http
GET /api/library-summary
  ?campaignSlug=yuhara-main
  &sourceSessionId=:id
```

Fluxo:

```txt
Server Component
→ adapter/BFF
→ API legada
→ schema runtime
→ SessionSummaryViewModel
→ render
```

Campos relevantes:

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

Metadata adicional como duração/falas pode vir do catálogo já usado na Fase 6 se o endpoint de resumo não fornecer todos os campos necessários.

Preferir um adapter claro a duplicar requests sem necessidade.

---

## 5. Estratégia para metadata da sessão

Se `/api/library-summary` não possuir duração/falas/participantes suficientes, opções em ordem de preferência:

1. reutilizar dado já disponível no contexto/cache server-side de `/api/library-sessions`;
2. fazer composição server-side entre summary + catálogo;
3. alterar API legada somente se houver necessidade real e contrato/teste formal.

Não alterar API apenas para deixar o componente mais conveniente.

---

## 6. Hero

Preferência:

```txt
heroImageUrl
→ coverImageUrl com crop apropriado
→ fallback do Design System
```

Requisitos:

- forte peso visual;
- proporção cinematográfica;
- tamanho responsivo;
- imagem não precisa preencher toda a viewport;
- `next/image` configurado corretamente;
- LCP observado;
- alt coerente quando a imagem transmite conteúdo.

O hero não deve empurrar título/resumo para vários scrolls abaixo em mobile.

---

## 7. Eyebrow / arco

Se `arc` existir:

```txt
VALCINZENTO E O CORAÇÃO-RAIZ
```

ou o valor real publicado.

Se não existir:

- não renderizar espaço vazio;
- não usar texto genérico inventado.

Nesta modernização `arc` continua sendo metadata textual da sessão, não uma nova entidade de domínio.

---

## 8. Título e metadata

Título editorial com largura controlada.

Metadata esperada quando disponível:

```txt
data
duração
falas
participantes (se útil e confiável)
```

Evitar transformar cada metadata em card/badge.

Usar divisores tipográficos discretos.

---

## 9. Navegação Resumo | Transcrição

Tratar como navegação entre rotas, não como duas telas inteiras escondidas no mesmo Client Component.

```txt
Resumo
→ /sessoes/[id]

Transcrição
→ /sessoes/[id]/transcricao
```

Benefícios:

- URL compartilhável;
- Server Components no resumo;
- transcrição interativa isolada;
- back/forward natural;
- menos JS na página editorial.

O estado ativo precisa ser perceptível sem depender apenas de cor.

---

## 10. Resumo curto / lead

`summary` pode funcionar como deck/lead editorial abaixo do título quando agrega contexto.

Cuidados:

- não duplicar um parágrafo idêntico imediatamente antes de `summaryFull`;
- se o corpus atual duplicar conteúdo, definir regra de apresentação em vez de repetir visualmente;
- não reescrever resumos nesta fase.

A lógica de deduplicação, se necessária, deve ser simples, testada e não alterar o conteúdo armazenado.

---

## 11. Markdown completo

`summaryFull` é conteúdo publicado da sessão e deve continuar sendo suportado sem migração manual.

### Requisitos

- renderização server-side preferencial;
- GFM quando necessário pelo corpus atual;
- headings;
- listas;
- links;
- blockquotes;
- code/inline code se existentes;
- tabelas se existentes;
- sanitização segura;
- styling editorial consistente;
- headings semânticos.

### HTML dentro de Markdown

Não habilitar raw HTML por padrão apenas porque o legado usava `marked + DOMPurify`.

Antes da implementação:

1. testar corpus atual;
2. verificar se resumos publicados dependem de HTML inline;
3. se não dependem, manter raw HTML desabilitado;
4. se dependem, escolher pipeline seguro e documentado.

Nenhuma perda silenciosa de conteúdo existente é aceitável.

---

## 12. Largura de leitura

O hero/layout pode usar `content-max`.

O Markdown deve usar `reading-max`.

Direção:

```txt
hero: largo
texto: ~650–760px
```

Evitar parágrafos extensos atravessando monitor inteiro.

---

## 13. Hierarquia de headings do Markdown

O título da página já é `h1`.

Portanto o renderer deve evitar estrutura inválida quando o Markdown começar com `#`.

Estratégias possíveis:

- normalizar headings no renderer;
- exigir que `summaryFull` use `##` como primeira seção se o corpus já seguir isso;
- mapear `h1` do conteúdo para `h2` visual/semanticamente quando necessário.

A decisão deve ser baseada no corpus real, não em suposição.

---

## 14. Links

Links externos no Markdown:

- devem ser identificáveis;
- abrir nova aba somente quando houver razão clara;
- usar `rel` seguro quando aplicável.

Links internos futuros entre entidades não entram neste roadmap.

---

## 15. Sessão sem resumo completo

Estado permitido:

```txt
hasSummary = false
```

Não deixar página quebrada.

Exibir algo equivalente a:

```txt
Resumo ainda não publicado.
```

E manter acesso à transcrição quando ela existir.

---

## 16. Sessão inexistente

Quando `sourceSessionId` não existir ou não for acessível:

- usar 404/notFound apropriado;
- preservar shell quando fizer sentido;
- oferecer retorno para `/sessoes`;
- não vazar diferença entre conteúdo privado inacessível e identificadores sensíveis além do necessário.

401/403 seguem tratamento de auth da Fase 5.

---

## 17. Compatibilidade com links antigos de hash

Links antigos já podem estar em Discord, histórico, favoritos ou documentação:

```txt
https://dnd.faysk.dev/#/sessao/:id
https://dnd.faysk.dev/#/sessao/:id/resumo
```

Fragmentos `#...` não são enviados ao servidor HTTP, então redirects server-side comuns não conseguem enxergá-los.

A compatibilidade no cutover deve possuir bridge client-side mínima.

Mapeamento:

```txt
#/sessao/:id
→ /sessoes/:id/transcricao

#/sessao/:id/resumo
→ /sessoes/:id
```

### Requisitos da bridge

- ler `window.location.hash` apenas no browser;
- validar formato/ID;
- fazer `replace`, não criar histórico duplicado;
- não interferir com URLs modernas sem hash legado;
- poder ser removida futuramente após período de compatibilidade definido;
- ter testes unitários/E2E.

Essa decisão deve ser formalizada em ADR antes do cutover.

---

## 18. Navegação de retorno

O link superior deve levar a:

```txt
/sessoes
```

Texto:

```txt
← Todas as sessões
```

Não depender de `history.back()` como única opção, porque uma sessão pode ser aberta por link direto.

---

## 19. Prefetch

Links de SessionCard para resumo podem usar prefetch padrão do framework quando isso não causar carga desnecessária/auth issues.

Monitorar:

- quantidade de requests;
- imagens;
- impacto do prefetch em grids grandes.

Se o arquivo com muitas sessões disparar prefetch excessivo, ajustar deliberadamente.

---

## 20. Metadata/document title

Exemplo:

```txt
O Olho que Devora a Floresta — DnD Scribe
```

Não incluir resumo completo em metadata pública.

Como o conteúdo é autenticado, evitar vazamento de dados em preview/social metadata não autorizada.

---

## 21. Loading

Durante navegação:

- shell permanece estável;
- hero/text placeholders discretos se necessário;
- não esconder header;
- não piscar Home antes de sessão.

Server rendering deve reduzir estados de loading desnecessários.

---

## 22. Mobile

Requisitos:

- hero menor proporcionalmente;
- título não estoura largura;
- tabs continuam acessíveis;
- metadata quebra em linhas de forma limpa;
- Markdown preserva legibilidade;
- tabelas/code blocks, se existirem, não quebram viewport;
- targets interativos confortáveis.

---

## 23. Visual regression

Capturas mínimas:

```txt
session-summary-dark-desktop
session-summary-light-desktop
session-summary-dark-mobile
session-summary-light-mobile
session-no-summary
session-long-summary
```

Comparar com resumo legado para preservar identidade e conteúdo, embora a composição seja deliberadamente nova.

---

## 24. E2E

Cenários:

```txt
/sessoes → abrir sessão → resumo
Home → LatestSession → resumo
resumo → transcrição
transcrição → resumo
resumo → todas as sessões
sessão sem resumo
sessão inexistente
old hash transcript → nova transcrição
old hash resumo → novo resumo
dark/light
mobile
```

---

## 25. Segurança

- Markdown sanitizado;
- nenhum token em HTML/log;
- API via BFF;
- resposta privada não entra em cache público;
- URLs de imagem seguem allowlist/remotePatterns;
- links externos tratados com segurança.

---

## 26. Performance

Medir nesta fase:

- LCP do hero;
- TTFB/BFF summary;
- tamanho HTML do resumo longo;
- JS transferido;
- CLS;
- impacto do Markdown renderer.

Uma página editorial de resumo não deve exigir grande bundle client-side.

---

## 27. O que NÃO fazer

- extrair automaticamente pessoas/locais do resumo;
- criar links de entidades;
- adicionar galeria;
- criar timeline;
- editar Markdown;
- migrar endpoint de summary;
- alterar conteúdo publicado;
- remover transcrição;
- trocar domínio de produção.

---

## 28. Gate de saída

A Fase 7 termina quando:

```txt
/sessoes/[id] → resumo ✅
hero ✅
arc/título/metadata ✅
Markdown completo ✅
sem resumo ✅
404 ✅
Resumo | Transcrição ✅
links antigos com estratégia testada ✅
dark/light ✅
desktop/mobile ✅
visual regression ✅
E2E ✅
typecheck/lint/test/build ✅
produção legado intacta ✅
```

Registrar:

- renderer Markdown escolhido;
- auditoria do corpus;
- estratégia de headings;
- bridge de hash legado;
- métricas;
- diferenças visuais aprovadas.

---

## 29. Próxima fase

Após o gate:

```txt
Fase 8 — Transcrição
```

A transcrição passa então a ser migrada como ferramenta completa da sessão, sem voltar a ocupar o papel de página principal.