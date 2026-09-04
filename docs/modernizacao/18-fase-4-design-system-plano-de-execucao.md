# 18 — Fase 4: plano de execução do Design System

Status: **pré-planejado; execução depende da Fase 3 concluída**

## Objetivo

Transformar a identidade visual atual do DnD Scribe em um sistema semântico, reutilizável e testável, preservando a essência editorial/cinematográfica do produto sem iniciar ainda a migração funcional da Home, auth, sessões ou transcrição.

A Fase 4 não é um redesenho do produto. Ela cria a linguagem visual necessária para que as telas das fases seguintes sejam construídas de forma consistente.

---

## 1. Princípio de preservação

O Design System deve partir do app legado real, não de um template externo.

A referência visual oficial é composta por:

- `web/library.css` e tokens vigentes;
- golden baseline da Fase 0;
- direção aprovada em `04-design-system-e-ux.md`;
- dark mode com personalidade de grimório/arquivo cinematográfico;
- light mode com personalidade de livro/arquivo editorial;
- serifada para hierarquia narrativa;
- sans-serif para UI/metadados;
- dourado/bronze usado com parcimônia;
- imagens de sessão com forte peso visual;
- bastante espaço negativo;
- bordas e sombras discretas;
- movimento mínimo.

Regra:

> modernizar a implementação sem apagar a memória visual do produto.

---

## 2. Classificação de mudanças

Toda alteração visual deve ser classificada antes de entrar:

| Classe | Definição | Permitida na Fase 4? |
| --- | --- | --- |
| paridade | reproduz uma decisão visual atual | sim |
| refinamento | melhora consistência sem mudar função | sim |
| mudança deliberada de UX | já aprovada no roadmap | somente preparar componentes |
| feature nova | cria nova capacidade de domínio | não |

Exemplos permitidos:

- normalizar border radius;
- formalizar escala tipográfica;
- tornar foco mais consistente;
- reduzir duplicação de CSS;
- criar tokens semânticos;
- consolidar dark/light.

Exemplos proibidos:

- adicionar Pessoas;
- criar cards de NPC;
- criar editor de Lore;
- criar busca global;
- inventar dashboard de métricas.

---

## 3. Estratégia de tokens

Não expor nomes baseados em cor física para consumo dos componentes quando houver significado semântico.

Preferir:

```txt
--canvas
--canvas-subtle
--surface
--surface-hover
--surface-elevated
--border
--border-subtle
--foreground
--foreground-soft
--foreground-muted
--accent
--accent-strong
--accent-muted
--danger
--success
--focus-ring
```

Evitar componentes dependentes de nomes como:

```txt
--gray-900
--yellow-500
```

Esses valores físicos podem existir internamente, mas componentes devem consumir semântica.

### Tokens estruturais

```txt
--content-max
--reading-max
--header-height
--radius-sm
--radius-md
--radius-lg
--shadow-subtle
--shadow-elevated
--space-*
--duration-fast
--duration-normal
--ease-standard
```

---

## 4. Dark e Light como temas de primeira classe

### Dark

Direção:

- canvas quase preto com leve temperatura azul/cinza;
- superfícies escuras discretas;
- foreground quente, nunca branco puro agressivo;
- dourado luminoso apenas em accent;
- imagens podem parecer integradas ao ambiente;
- sombras muito discretas.

### Light

Direção:

- canvas em papel quente/creme;
- foreground em tinta escura;
- superfícies levemente diferenciadas do canvas;
- bronze/ocre como accent;
- imagens ganham contorno visual mais claro contra o papel;
- evitar branco puro dominante.

### Requisito

Os dois temas usam os mesmos tokens semânticos.

Um componente não deve conter lógica visual do tipo:

```txt
if dark then cor X else cor Y
```

quando o token semântico puder resolver.

---

## 5. Tema `system`

O comportamento existente `system | light | dark` deve continuar possível.

Na Fase 4 preparar:

- atributo/classe de tema no root;
- prevenção de flash incorreto antes da hidratação;
- atualização quando `prefers-color-scheme` mudar e o modo selecionado for `system`;
- armazenamento da escolha do usuário;
- API simples para o componente de Theme Toggle da Fase 5.

A implementação deve ser validada posteriormente com auth/shell real.

---

## 6. Tipografia

Criar papéis tipográficos, não apenas tamanhos soltos.

### Display

Uso:

- hero de Home;
- título principal de sessão;
- títulos editoriais maiores.

### Heading

Uso:

- seções;
- card title importante;
- blocos editoriais.

### Body

Uso:

- resumo;
- texto editorial;
- descrições.

### UI

Uso:

- botão;
- filtro;
- input;
- navegação.

### Metadata

Uso:

- data;
- duração;
- falas;
- participantes.

### Eyebrow

Uso:

- arco;
- categoria curta;
- pequenos rótulos editoriais.

Requisitos:

- escala responsiva sem extremos;
- leitura confortável em mobile;
- line-height consistente;
- largura de texto longa controlada;
- fallback de fonte documentado;
- nenhum layout depender de fonte ainda não carregada para permanecer funcional.

---

## 7. Largura e composição

Formalizar dois limites principais:

```txt
layout/content max
→ imagens, grids, hero e shell

reading max
→ texto longo de resumo
```

Direção inicial aproximada:

```txt
content: 1000–1200px
reading: 650–760px
```

Os valores finais devem ser derivados da comparação visual com o legado e aprovados no Preview.

Não usar viewport inteira como largura de parágrafo em telas grandes.

---

## 8. Espaçamento

Criar uma escala pequena e previsível.

Objetivos:

- impedir `margin: 37px` arbitrário em cada página;
- preservar o espaço negativo que já faz parte da identidade;
- permitir densidade diferente entre UI e conteúdo editorial.

A escala pode ser implementada via tokens/Tailwind, mas os nomes semânticos devem existir para regiões críticas quando necessário.

---

## 9. Componentes fundamentais

A Fase 4 deve implementar somente primitivas necessárias para as próximas telas.

### UI básica

```txt
Button
IconButton
TextLink
Input
Select
Tabs
Badge/Eyebrow
Divider
Spinner/Skeleton
EmptyState
ErrorState
```

### Layout

```txt
AppContainer
ReadingContainer
Section
Stack
Cluster
HeaderShell placeholder
```

### Campaign/session

Somente componentes visuais sem dados reais quando necessário:

```txt
SessionCard shell
MetadataRow
SessionArtwork frame
```

Não criar componentes para features futuras.

---

## 10. Estados dos componentes

Cada componente interativo deve possuir explicitamente:

```txt
default
hover
focus-visible
active
selected (quando aplicável)
disabled
loading (quando aplicável)
error (quando aplicável)
```

Regra:

> focus não pode ser um efeito acidental do browser removido sem substituição.

---

## 11. Acessibilidade visual

Validar em dark e light:

- contraste de texto;
- contraste de controles;
- focus ring;
- tamanho mínimo de target interativo;
- estado ativo não dependente apenas de cor;
- `prefers-reduced-motion`;
- zoom 200% sem perda de função nos componentes base.

Não esperar a Fase 9 para corrigir problemas estruturais criados nesta fase.

---

## 12. Movimento

Definir apenas duas ou três velocidades.

Direção:

```txt
fast: hover/focus
normal: menu/tab/transição curta
```

Evitar:

- animações longas;
- entrada de página teatral;
- parallax obrigatório;
- movimentação que atrase leitura.

Em `prefers-reduced-motion`, remover animações não essenciais.

---

## 13. Imagens

Preparar um wrapper/contrato visual para imagens de sessão compatível com `next/image`.

Requisitos:

- aspect ratios documentados;
- `sizes` responsivo;
- placeholder/fallback quando necessário;
- ausência de CLS evitável;
- crop consistente;
- hero e cover tratados como papéis diferentes.

A Fase 4 não migra URLs/dados reais de sessões ainda.

---

## 14. Tailwind

Tailwind é ferramenta de composição, não a identidade.

Permitido:

- spacing;
- flex/grid;
- responsive;
- estados;
- tokens expostos via theme/CSS variables.

Evitar:

- repetir grandes blocos de utility classes em dezenas de lugares;
- cores Tailwind arbitrárias em componentes de domínio;
- aparência padrão de kit/UI genérico.

Quando uma composição se repete e representa conceito real do produto, extrair componente ou estilo semântico.

---

## 15. Catálogo visual

Pode existir um catálogo técnico somente para desenvolvimento/Preview.

Objetivo:

- comparar dark/light;
- mostrar estados de buttons/inputs/tabs;
- validar tipografia;
- validar tokens;
- servir de superfície para visual regression.

Não transformar isso em uma feature pública do produto.

Se uma rota técnica for usada, deve estar indisponível/oculta em produção ou claramente fora da navegação.

---

## 16. Testes da Fase 4

### Unitários

Somente quando houver lógica real, por exemplo:

- resolução de preferência de tema;
- helpers de classes/tokens.

### Componentes

Validar:

- estados acessíveis;
- keyboard;
- aria quando necessário.

### Visuais

Criar snapshots para pelo menos:

```txt
design-system-dark-desktop
design-system-light-desktop
design-system-dark-mobile
design-system-light-mobile
```

O objetivo é detectar regressões internas do sistema, não reproduzir ainda a Home completa.

---

## 17. Critério de aprovação visual

A Fase 4 não precisa ser pixel-perfect em relação ao legado em cada primitiva.

Ela precisa responder sim para:

1. parece claramente o mesmo DnD Scribe?
2. dark e light mantêm suas personalidades?
3. não parece um template genérico?
4. títulos e leitura continuam editoriais?
5. dourado/bronze continua raro?
6. os componentes são acessíveis e previsíveis?
7. as próximas telas podem ser montadas sem CSS improvisado?

---

## 18. O que NÃO fazer

- implementar Home funcional;
- consumir `/api/library-sessions`;
- implementar OAuth;
- implementar reader/transcrição;
- criar componentes de Pessoas/Mundo/Lore;
- instalar Tiptap/XYFlow;
- adicionar biblioteca UI que substitua a identidade do produto;
- alterar produção.

---

## 19. Gate de saída

A Fase 4 termina quando:

```txt
tokens semânticos ✅
dark ✅
light ✅
system preparado ✅
tipografia ✅
espaçamento/larguras ✅
componentes fundamentais ✅
estados/focus ✅
reduced motion ✅
catálogo/superfície de teste ✅
visual regression básica ✅
typecheck/lint/test/build ✅
```

E houver registro de:

- tokens finais;
- componentes criados;
- diferenças deliberadas frente ao legado;
- screenshots do catálogo;
- checks executados;
- riscos/dívidas deixados para fases seguintes.

---

## 20. Próxima fase

Após o gate:

```txt
Fase 5 — Auth e Shell
```

É quando o Design System passa a compor uma experiência real autenticada.