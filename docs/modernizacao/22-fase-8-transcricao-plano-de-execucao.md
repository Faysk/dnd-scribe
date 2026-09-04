# 22 — Fase 8: plano de execução da Transcrição

Status: **pré-planejado; execução depende da Fase 7 concluída**

## Objetivo

Migrar integralmente a experiência de transcrição preservando as capacidades atuais, agora posicionada como ferramenta secundária da Página de Sessão.

A fase deve manter:

- busca textual;
- filtro por speaker;
- contadores;
- cursor/paginação;
- carregamento incremental;
- clear filters;
- retry;
- empty state;
- download Markdown;
- comportamento com sessões longas.

Não adicionar análise semântica, busca global, IA ou novas features de domínio.

---

## 1. Rota

```txt
/sessoes/[id]/transcricao
```

A rota compartilha o contexto visual da sessão:

```txt
← Todas as sessões
Hero/metadata reduzido ou header contextual
Resumo | Transcrição

Ferramentas de busca/filtro
Transcrição
```

O nível exato de repetição do hero deve ser validado visualmente. A transcrição não precisa repetir um hero enorme se isso prejudicar a ferramenta.

---

## 2. Contrato legado preservado

Fonte:

```http
GET /api/library-transcript
```

Query params relevantes:

```txt
campaignSlug
sourceSessionId
limit
cursor
q
speaker
```

Resposta consumida:

```txt
session
segments[]
speakers[]
total
nextCursor
```

Segmento:

```txt
id
startMs
endMs
speaker
text
```

Valores de baseline atuais:

```txt
PAGE_SIZE = 120
prefetch/root margin ≈ 1200px 0px
```

Esses valores são ponto de partida de paridade, não dogma de performance. Mudanças posteriores precisam de medição.

---

## 3. Arquitetura de renderização

Separar shell server-side da ferramenta interativa.

Estrutura conceitual:

```txt
Server Component route
├── valida auth/campaign access
├── carrega metadata da sessão
├── carrega primeira página da transcrição
└── renderiza
    └── TranscriptExplorer (Client Component)
```

Benefícios:

- primeira página já chega renderizada;
- menos loading inicial;
- auth permanece server-first;
- interatividade fica isolada.

---

## 4. BFF para paginação e filtros

Após a primeira renderização, o Client Component precisa buscar páginas/filtros.

O browser deve chamar um endpoint same-origin do novo app, não a API legada diretamente.

Exemplo conceitual:

```txt
GET /api/library/transcript
```

ou nomenclatura interna equivalente.

Fluxo:

```txt
Browser
→ Next Route Handler/BFF
→ resolve sessão cookie server-side
→ obtém access token
→ valida query params
→ API legada /api/library-transcript
→ valida resposta
→ retorna payload mínimo ao client
```

Não expor service role e não exigir Bearer manual no browser.

---

## 5. Primeira página

Paridade inicial:

```txt
limit = 120
cursor = null
q = vazio
speaker = vazio
```

A primeira resposta alimenta:

- session metadata relevante;
- `segments` iniciais;
- `speakers`;
- `total`;
- `nextCursor`.

O Client Component deve receber o estado inicial sem fazer imediatamente a mesma request de novo.

---

## 6. Modelo de estado

Estado mínimo:

```txt
segments
speakers
total
nextCursor
query
speaker
loadingInitial
loadingMore
filtering
error
hasMore
requestGeneration/abort handle
```

Evitar store global. O estado pertence à ferramenta de transcrição daquela rota.

---

## 7. Busca textual

Comportamento de paridade:

```txt
usuário digita
→ busca é aplicada
→ resultados substituem lista anterior
→ cursor reinicia
→ total atualiza
```

### Debounce

Usar debounce curto se necessário para evitar request a cada tecla.

Direção inicial:

```txt
250–400ms
```

O valor final deve ser testado com a API real.

### Enter

A busca também deve funcionar naturalmente com Enter se o controle for tratado como formulário.

### Limites

Validar tamanho da query conforme contrato real do backend.

Não mandar strings arbitrariamente grandes ao endpoint.

---

## 8. Speaker filter

Controle:

```txt
Todas as vozes
speaker 1
speaker 2
...
```

Ao mudar:

```txt
segments = nova primeira página
cursor = reset
query = preservada
speaker = novo valor
total = atualizado
```

Busca textual + speaker precisam continuar combináveis se o backend já suporta essa combinação.

---

## 9. Clear filters

Ação visível quando `query` ou `speaker` estiver ativo.

Resultado:

```txt
query = ''
speaker = ''
→ primeira página padrão
```

Não exigir refresh completo da rota.

---

## 10. Race conditions e cancelamento

Esse é um ponto obrigatório da implementação moderna.

Cenário:

```txt
buscar "Poppe"
→ request A
usuário rapidamente muda para "Noah"
→ request B
A termina depois de B
```

A resposta antiga não pode sobrescrever a nova.

Usar uma estratégia explícita:

- `AbortController`; e/ou
- geração/request id.

Testar esse cenário.

---

## 11. Carregamento incremental

Preservar `IntersectionObserver` como estratégia principal.

Direção inicial:

```txt
rootMargin: 1200px 0px
```

Ao sentinel se aproximar:

```txt
if nextCursor && !loadingMore
→ carregar próxima página
→ append
```

### Fallback

Manter um mecanismo funcional se IntersectionObserver não disparar:

```txt
Carregar mais
```

pode aparecer como fallback/manual control quando necessário.

Não tornar o conteúdo inacessível se observer falhar.

---

## 12. Deduplicação

Ao append:

- não duplicar segmentos;
- usar `segment.id` quando confiável;
- preservar ordem;
- não perder segmentos se páginas tiverem overlap defensivo.

Criar helper testável para merge.

---

## 13. Ordenação

A sequência deve seguir a ordem cronológica da sessão.

Não reordenar no browser por speaker/texto.

Se o backend retorna segmentos em ordem, preservar.

Se houver necessidade defensiva de ordenação, usar `startMs` e documentar.

---

## 14. Representação de um segmento

Estrutura visual aproximada:

```txt
00:42       Dandelion       texto da fala...
```

Papéis:

- timestamp: metadata;
- speaker: identidade visual discreta/accent;
- text: foco principal.

Não transformar cada fala em card pesado.

A lista deve continuar legível com milhares de entradas.

---

## 15. Timestamp

Centralizar formatter de milissegundos.

Requisitos:

- formato consistente com legado;
- suportar sessões > 1h;
- sem arredondamento que desloque significativamente o ponto da fala.

Testes:

```txt
0
59999
60000
3599999
3600000
```

---

## 16. Contador de resultados

Exemplos:

```txt
120 de 3.380 falas
38 resultados
```

A redação final pode variar conforme estado.

Requisitos:

- `total` do backend é fonte de verdade para filtro atual;
- número carregado vem de `segments.length`;
- formatar milhares pt-BR;
- não mostrar `NaN`/undefined.

---

## 17. Loading states

Separar:

### Initial

Primeira página da rota.

### Filtering

Busca/filtro mudou.

### Loading more

Append de próxima página.

Não apagar a sessão inteira ao carregar mais.

Evitar layout jump significativo.

---

## 18. Error states

Tratar:

```txt
primeira página falhou
próxima página falhou
filtro falhou
auth expirou
API 403
API 404
payload inválido
network timeout
```

### Erro ao carregar mais

Segmentos já carregados permanecem visíveis.

Exibir retry contextual sem perder estado atual.

### Erro de filtro

Não misturar resultados antigos com indicação de que pertencem ao novo filtro.

---

## 19. Empty states

### Sessão sem segmentos

```txt
Nenhuma fala publicada nesta sessão.
```

### Busca sem resultado

```txt
Nenhuma fala encontrada para esta busca.
```

### Speaker sem resultado

Mensagem coerente com filtro.

A ação `Limpar filtros` deve estar disponível quando apropriado.

---

## 20. URL dos filtros

Não é requisito desta modernização tornar `q` e `speaker` compartilháveis na URL.

Por paridade e simplicidade, podem permanecer estado local do Client Component.

Se a implementação optar por search params, isso deve ser tratado como refinamento deliberado e testado para:

- back/forward;
- encoding;
- links compartilhados;
- nenhuma navegação server-side excessiva a cada tecla.

Preferência inicial: estado local até existir benefício concreto.

---

## 21. Download Markdown

Capacidade obrigatória.

Contrato legado:

```http
GET /api/session-download
```

O novo app deve fornecer download same-origin por BFF/Route Handler.

Fluxo:

```txt
Browser
→ Next download route
→ auth cookie
→ API legada com Bearer server-side
→ stream/resposta
→ Content-Disposition preservado
```

Requisitos:

- filename útil;
- content type correto;
- não carregar arquivo inteiro em memória sem necessidade se streaming for possível;
- erro controlado;
- sem token em URL.

### Localização da ação

Preferência:

- dentro da área de transcrição;
- secundária/terciária;
- não competir com tabs.

---

## 22. Keyboard e acessibilidade

Obrigatório:

- label real para busca;
- label real para speaker;
- foco visível;
- clear filters acionável por teclado;
- retry acionável;
- tabs semânticas/links;
- loading anunciado de forma não excessiva;
- contador/result state com `aria-live` quando útil;
- lista de falas navegável sem armadilhas.

Não anunciar cada segmento carregado individualmente para screen reader.

---

## 23. Mobile

Toolbar precisa funcionar em largura estreita.

Direção:

```txt
Busca
[full width]

Speaker
[full width ou composição compacta]

contador / limpar filtros
```

Segmento pode empilhar:

```txt
timestamp · speaker
texto
```

quando três colunas ficarem apertadas.

Não exigir scroll horizontal para leitura normal.

---

## 24. DOM e sessões muito longas

A estratégia inicial preserva append progressivo do legado.

Não instalar virtualização automaticamente.

Durante testes, observar:

- memória;
- scroll fluido;
- quantidade de nós;
- tempo de render após muitas páginas.

Se sessões de milhares de falas causarem problema real, virtualização pode ser proposta na Fase 10 com benchmark e ADR/registro de impacto.

---

## 25. Visual regression

Capturas mínimas:

```txt
transcript-dark-desktop
transcript-light-desktop
transcript-dark-mobile
transcript-light-mobile
transcript-search-results
transcript-speaker-filter
transcript-empty
transcript-load-more-error
```

Comparação deve preservar a ferramenta atual, mesmo que o header/posição tenha mudado deliberadamente.

---

## 26. Unit tests

Cobrir helpers como:

- formatter de timestamp;
- merge/deduplicação;
- reducer/state transitions;
- query params validation;
- response schema;
- race/cancel behavior quando isolável;
- contadores.

---

## 27. E2E

Cenários mínimos:

```txt
abrir transcrição
primeira página = até 120
scroll → próxima página
buscar texto
limpar busca
filtrar speaker
combinar busca + speaker
limpar filtros
busca sem resultado
falha próxima página → retry
download .md
Resumo → Transcrição → Resumo
mobile toolbar
```

Teste com a sessão longa de referência da Fase 0.

---

## 28. Segurança

- BFF valida `sourceSessionId`, cursor, q, speaker e limit;
- limit possui máximo;
- access token server-side;
- resposta privada;
- sem HTML arbitrário vindo do texto da transcrição;
- text deve ser renderizado como texto, não `dangerouslySetInnerHTML`;
- download exige acesso à campanha.

---

## 29. Performance

Medir:

- primeira página;
- busca;
- speaker filter;
- append de página;
- tempo após 1k+ segmentos no DOM;
- JS do Client Component;
- memory/scroll quando possível;
- tamanho das respostas.

Comparar com o baseline legado da Fase 0.

---

## 30. O que NÃO fazer

- busca semântica;
- IA sobre transcrição;
- highlights inteligentes;
- links automáticos para NPCs;
- comentários/anotações;
- edição de fala;
- áudio sincronizado novo;
- timeline;
- migrar endpoint legado;
- alterar dados publicados.

---

## 31. Gate de saída

A Fase 8 termina quando:

```txt
rota moderna ✅
primeira página server-first ✅
busca ✅
speaker ✅
busca + speaker ✅
clear filters ✅
cursor ✅
infinite loading ✅
fallback/retry ✅
deduplicação ✅
empty states ✅
download .md ✅
race conditions tratadas ✅
dark/light ✅
desktop/mobile ✅
visual regression ✅
E2E ✅
performance inicial registrada ✅
typecheck/lint/test/build ✅
produção legado intacta ✅
```

Documentar:

- page size final;
- debounce final;
- rootMargin final;
- endpoint BFF;
- estratégia de cancelamento;
- métricas comparativas;
- diferenças deliberadas frente ao legado.

---

## 32. Próxima fase

Após o gate:

```txt
Fase 9 — Qualidade, Segurança e Acessibilidade
```

Nesse ponto todas as capacidades públicas atuais já devem existir no novo app, permitindo uma revisão transversal séria antes de performance/paridade final.