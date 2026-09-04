# 20 — Fase 6: plano de execução da Home e Arquivo de Sessões

Status: **pré-planejado; execução depende da Fase 5 concluída**

## Objetivo

Migrar a primeira experiência real de conteúdo do novo app usando exclusivamente dados já existentes da campanha.

Nesta fase a Home deixa de ser sinônimo de catálogo completo e passa a funcionar como entrada da campanha, enquanto `/sessoes` assume o acervo cronológico.

Não entram Pessoas, Mundo, Lore, relações, timeline ou qualquer bloco vazio antecipando features futuras.

---

## 1. Mudança deliberada de UX

### Legado

```txt
/
→ Nossas sessões
→ catálogo completo
```

### Novo app

```txt
/
→ Home da campanha

/sessoes
→ arquivo completo
```

A Home responde:

> onde paramos e por onde continuo?

O arquivo responde:

> qual sessão quero consultar?

---

## 2. Estrutura final da Home nesta modernização

A Home desta etapa possui exatamente quatro blocos principais de conteúdo:

```txt
CampaignHero
LatestSession
ArchiveStats
RecentSessions
```

Além do shell/header já criado na Fase 5.

Regra:

> se um bloco depende de uma feature que ainda não existe, ele não aparece.

Portanto NÃO adicionar:

- arco atual estruturado como entidade;
- pessoas em foco;
- pontas abertas;
- lugares recentes;
- relações;
- timeline;
- mapa;
- coleções.

---

## 3. CampaignHero

Objetivo:

- comunicar que o DnD Scribe é o arquivo/memória da campanha;
- estabelecer hierarquia editorial;
- não depender de novos dados de domínio.

Copy base aprovada como direção:

```txt
ARQUIVO DA CAMPANHA

As histórias da mesa
vivem aqui.

Um registro das escolhas, encontros e histórias
construídas pela mesa.
```

O texto final pode receber microajustes de redação durante homologação, mas não deve virar landing page de produto.

### Layout

Desktop:

- título grande;
- descrição curta;
- bastante espaço negativo;
- composição que deixa espaço para crescimento futuro sem mostrar módulos inexistentes.

Mobile:

- hierarquia preservada;
- título quebra naturalmente;
- sem texto minúsculo;
- sem hero alto demais que empurre todo o conteúdo útil para fora da primeira tela.

---

## 4. LatestSession

É o elemento mais importante da Home depois do hero.

Semântica:

> continue a história daqui.

Dados já existentes:

```txt
sourceSessionId
title
sessionDate
arc
durationMs
summary
coverImageUrl
heroImageUrl
segments
participants
```

### Conteúdo esperado

```txt
ÚLTIMA MEMÓRIA

[arte]
arc
Título
Data · duração · falas
Resumo curto
Abrir sessão →
```

### Imagem

Preferência:

1. `heroImageUrl` quando adequada à composição horizontal;
2. fallback para `coverImageUrl` com crop controlado;
3. fallback visual do Design System se nenhuma imagem existir.

Nunca quebrar layout por falta de imagem.

### CTA

```txt
Abrir sessão →
```

Destino:

```txt
/sessoes/[sourceSessionId]
```

Na Fase 6 essa rota pode existir como bridge/placeholder controlado até a Fase 7, mas o PR que conclui a Fase 6 não deve deixar CTA quebrado. Opções aceitáveis:

- implementar shell mínimo da rota que será completado na Fase 7; ou
- temporariamente apontar para a rota legada equivalente de forma explícita.

Preferência: criar a rota moderna mínima e completar seu conteúdo na Fase 7.

---

## 5. ArchiveStats

Usar somente números deriváveis dos dados já retornados.

Métricas aprovadas:

```txt
sessões
falas
horas registradas
```

Cálculo:

```txt
sessions = sessions.length
falas = sum(session.segments)
duração = sum(session.durationMs)
```

Se duração estiver ausente/inválida em parte relevante do acervo, não inventar número. O bloco pode mostrar apenas métricas confiáveis.

### Estética

Não usar três cards de dashboard.

Direção:

```txt
      11                 30.840                 42h
    sessões               falas              registradas
```

- tipografia;
- divisores discretos;
- espaço negativo;
- accent raro.

---

## 6. RecentSessions

Objetivo:

- permitir acesso rápido às memórias recentes;
- impedir que a Home cresça indefinidamente com o acervo.

Direção inicial:

```txt
MEMÓRIAS RECENTES

[session] [session]
[session] [session]

Ver todas as sessões →
```

Quantidade recomendada:

```txt
4 sessões
```

Pode ser ajustada para 6 apenas se testes visuais mostrarem ganho claro sem transformar Home em catálogo.

CTA:

```txt
Ver todas as sessões → /sessoes
```

---

## 7. SessionCard

A essência do card atual deve ser preservada.

Campos:

```txt
cover
sessionDate
title
summary curta
segments
participants
durationMs
```

### Interação

Card inteiro pode ser clicável desde que:

- semântica de link seja preservada;
- keyboard funcione;
- links internos não criem nested interactive controls inválidos.

### Hover

Somente refinamento discreto:

- leve zoom/crop da imagem;
- border/foreground sutil;
- seta opcional.

Nada de elevação exagerada ou animação longa.

---

## 8. `/sessoes` — Arquivo completo

Responsabilidade:

> listar todo o acervo publicado da campanha.

Conteúdo:

```txt
SESSÕES
Todas as memórias registradas da campanha.

metadata de arquivo

[grid/lista completa]
```

### Ordem

Padrão:

```txt
sessionDate DESC
```

Manter regra consistente mesmo que a API já venha ordenada; documentar/normalizar a expectativa no adapter.

### Agrupamento

Não é obrigatório nesta modernização.

Se o acervo continuar pequeno/médio, grid contínua é suficiente.

Agrupar por ano/mês só deve entrar se:

- não alterar contrato de dados;
- melhorar claramente navegação;
- for tratado como refinamento, não como nova feature complexa.

Não adicionar filtros de personagem/arco/local nesta fase.

---

## 9. Dados e BFF

Fonte durante migração:

```http
GET /api/library-sessions?campaignSlug=yuhara-main
```

Novo fluxo:

```txt
Server Component
→ lib/api/library-sessions.ts
→ BFF server-side
→ API legada
→ validação runtime
→ view model tipado
```

O browser não precisa baixar Supabase SDK ou fazer chamada direta à API legada só para renderizar Home.

---

## 10. Contrato tipado

Criar schema runtime para a resposta efetivamente usada.

Exemplo conceitual:

```txt
LibrarySession
├── sourceSessionId
├── title
├── sessionDate
├── arc?
├── durationMs?
├── summary?
├── hasSummary
├── coverImageUrl?
├── heroImageUrl?
├── segments
├── participants
└── updatedAt?
```

Não exigir campos que o acervo histórico não garante.

Separar:

```txt
API contract
→ dados vindos do legado

SessionCardViewModel
→ dados formatados para UI
```

---

## 11. Datas e duração

Centralizar formatadores.

Requisitos:

- locale pt-BR;
- timezone/semântica da data preservada;
- não converter `YYYY-MM-DD` para dia anterior por timezone acidental;
- duração consistente (`2h40`, por exemplo);
- falas com formatação de milhares pt-BR.

Testar explicitamente datas puras sem timezone.

---

## 12. Renderização

Home e arquivo devem ser Server Components por padrão.

Client Components apenas se houver interação real.

Nesta fase, idealmente:

```txt
CampaignHero → Server
LatestSession → Server
ArchiveStats → Server
RecentSessions → Server
SessionCard → Server
```

Theme/user menu continuam Client/interactive conforme Fase 5.

Resultado desejado:

> muito conteúdo visual, pouco JavaScript desnecessário.

---

## 13. Cache

Conteúdo pertence a campanha autenticada.

Não utilizar cache público compartilhado que possa expor conteúdo entre usuários.

Estratégia deve preservar a semântica privada existente.

É aceitável ter reuso/cache server-side controlado quando:

- varia corretamente por autenticação/campanha; ou
- os dados são comprovadamente idênticos para todos os membros autorizados e nunca misturados com cookies de auth.

Na dúvida nesta fase, priorizar correção/privacidade sobre cache agressivo.

---

## 14. Imagens com Next

Usar `next/image` onde fizer sentido para cover/hero.

Configurar `remotePatterns` explicitamente para hosts usados pelo acervo.

Não usar configuração ampla desnecessária.

### Requisitos

- `width/height` ou `fill` com container dimensional;
- `sizes` realista;
- prioridade somente para imagem crítica acima da dobra;
- lazy loading nas demais;
- crop via `object-fit`;
- fallback sem CLS.

Medir impacto em comparação ao legado na Fase 10.

---

## 15. Loading

A aplicação não deve piscar entre shell vazio e conteúdo completo de maneira desorientadora.

Opções:

- loading route do App Router;
- skeleton editorial discreto;
- streaming quando houver benefício real.

Não criar skeleton complexo apenas para demonstrar tecnologia.

---

## 16. Empty state

Mesmo que a campanha atual tenha sessões, documentar o estado:

```txt
Nenhuma sessão publicada ainda.
```

Sem erro de JavaScript e sem métricas `NaN`.

---

## 17. Error state

Falhas relevantes:

```txt
401 → sessão/auth
403 → acesso
5xx → indisponibilidade temporária
payload inválido → erro controlado
network/timeout → retry
```

A Home não deve renderizar catálogo parcial silenciosamente como se estivesse completo quando a chamada principal falhar.

---

## 18. SEO/metadata interna

O app é autenticado, então SEO público não é objetivo desta fase.

Ainda assim definir metadata de documento coerente:

```txt
DnD Scribe — Arquivo da campanha
Sessões — DnD Scribe
```

Não incluir detalhes privados sensíveis em metadata que possa aparecer fora do contexto autenticado.

---

## 19. Responsividade

### Desktop

- LatestSession pode ser composição horizontal;
- RecentSessions em duas colunas;
- stats distribuídos tipograficamente.

### Mobile

- LatestSession empilha arte/texto;
- SessionCard vira composição legível em uma coluna;
- stats quebram de forma previsível;
- CTA permanece visível;
- nada depende de hover.

Validar no viewport oficial da Fase 0.

---

## 20. Visual regression

Capturas mínimas:

```txt
home-dark-desktop
home-light-desktop
home-dark-mobile
home-light-mobile
sessions-dark-desktop
sessions-light-desktop
sessions-dark-mobile
sessions-light-mobile
```

Home nova não será pixel-perfect com a Home legada porque existe mudança deliberada de UX.

A comparação deve avaliar:

- identidade;
- tokens;
- tipografia;
- proporção das imagens;
- card de sessão;
- header;
- densidade.

---

## 21. E2E

Cenários mínimos:

```txt
authorized → Home
Home → última sessão
Home → /sessoes
Home → sessão recente por card
/sessoes → sessão antiga
Home dark/light
/sessoes dark/light
mobile navegação
API error → retry
```

---

## 22. Performance a observar

Já nesta fase registrar:

- LCP da Home;
- bytes de imagem;
- JS transferido;
- requests iniciais;
- CLS;
- tempo server response/BFF.

Não é gate final de performance ainda, mas qualquer regressão enorme deve ser corrigida antes de avançar.

---

## 23. O que NÃO fazer

- mostrar Pessoas;
- mostrar Mundo;
- criar busca global;
- criar filtros complexos;
- criar timeline;
- criar relações;
- editar sessões;
- migrar API;
- alterar banco;
- remover Home legada de produção;
- ligar domínio de produção ao novo projeto.

---

## 24. Gate de saída

A Fase 6 termina quando:

```txt
Home real ✅
LatestSession ✅
ArchiveStats ✅
RecentSessions ✅
/sessoes completo ✅
SessionCard refinado ✅
dados reais via BFF ✅
empty/error/loading ✅
dark ✅
light ✅
desktop ✅
mobile ✅
visual regression ✅
E2E crítico ✅
typecheck/lint/test/build ✅
produção legado intacta ✅
```

Documentar:

- quantidade de sessões exibidas na Home;
- regras de ordenação;
- schema usado;
- hosts de imagem;
- métricas iniciais;
- diferenças deliberadas frente ao legado.

---

## 25. Próxima fase

Após o gate:

```txt
Fase 7 — Página de Sessão
```

É nela que a mudança mais importante de hierarquia entra: resumo passa a ser o conteúdo padrão da sessão.