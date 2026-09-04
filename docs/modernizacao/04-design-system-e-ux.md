# 04 — Design system e UX da modernização

Status: **direção visual aprovada**

## Objetivo

Formalizar a identidade visual atual do DnD Scribe e reorganizar a hierarquia da interface sem introduzir novas features de domínio.

## Essência que deve permanecer

O DnD Scribe não deve virar um dashboard SaaS genérico.

A linguagem visual atual é parte do produto:

- editorial;
- escura e cinematográfica no dark mode;
- clara e semelhante a livro/arquivo no light mode;
- uso contido de dourado/bronze;
- serifada em títulos e leitura;
- sans-serif em controles e metadados;
- bastante espaço negativo;
- imagens de sessão com grande peso visual;
- bordas discretas;
- animações mínimas.

## Princípio de UX

> Ter muita informação no sistema não significa mostrar muita informação ao mesmo tempo.

A modernização já deve preparar esse princípio, mesmo antes das futuras features existirem.

## Uma página, uma pergunta principal

### Home

Pergunta: **onde está a campanha e por onde continuo?**

### Arquivo de sessões

Pergunta: **qual sessão quero consultar?**

### Sessão

Pergunta: **o que aconteceu nessa sessão?**

### Transcrição

Pergunta: **o que foi dito exatamente?**

Essa separação evita que uma única tela tente responder a tudo.

## Home modernizada — sem features futuras

A Home deve usar somente dados já disponíveis.

Estrutura inicial:

```txt
Header

CampaignHero
  título editorial
  descrição curta da campanha/arquivo

LatestSession
  imagem
  arco
  título
  data
  duração
  falas
  resumo curto
  CTA "Abrir sessão"

ArchiveStats
  sessões
  falas
  duração total, se calculável com os dados atuais

RecentSessions
  subconjunto das sessões recentes
  CTA "Ver todas as sessões"
```

Não mostrar placeholders para `Pessoas`, `Mundo`, `Timeline` ou `Relações` antes dessas áreas existirem.

## Arquivo de sessões

A rota `/sessoes` assume a responsabilidade de listar o acervo completo.

Direção:

- ordem cronológica decrescente por padrão;
- cards atuais refinados, não reinventados;
- suporte a grande quantidade de sessões sem transformar a Home em rolagem infinita;
- possibilidade futura de agrupamento por período sem ser requisito desta modernização.

## Página de sessão

Estrutura conceitual:

```txt
Voltar
Hero
Arco
Título
Metadata

Resumo | Transcrição

Conteúdo
```

O resumo é selecionado por padrão.

A transcrição continua completa, mas deixa de competir visualmente com o resumo na primeira abertura.

## Hierarquia de ações

### Primária

Ação principal daquela região da página.

Exemplos:

- `Abrir sessão`;
- `Continuar lendo`.

Visual: accent/dourado.

### Secundária

Ação importante, porém não principal.

Exemplos:

- `Ver transcrição`;
- `Baixar .md` quando necessário.

Visual: superfície/borda discreta.

### Terciária

Ações ocasionais.

Visual: texto, ícone ou menu contextual.

Nunca exibir várias ações primárias competindo na mesma região.

## Cards

Não usar card como mecanismo universal de separação.

### Card é adequado para

- sessão;
- conteúdo visual clicável;
- estado contextual compacto.

### Evitar card para

- texto editorial simples;
- estatísticas que funcionam melhor como tipografia e divisores;
- cada pequeno metadado;
- containers aninhados sem necessidade.

## Espaçamento e largura

Direção de leitura:

- layout geral largo o suficiente para imagens e cards;
- conteúdo editorial longo em largura menor;
- espaço negativo tratado como parte ativa do design;
- não esticar parágrafos pela largura total de telas grandes.

## Dark mode

Personalidade:

- grimório;
- arquivo noturno;
- cinematográfico;
- imagens podem fundir parcialmente com a atmosfera;
- dourado mais luminoso;
- superfícies escuras discretamente separadas.

## Light mode

Personalidade:

- livro;
- arquivo editorial;
- papel quente;
- bronze/ocre no lugar de dourado brilhante;
- imagens com contraste deliberado contra o canvas claro;
- superfícies levemente diferenciadas, evitando branco puro excessivo.

Dark e light devem compartilhar semântica de tokens, não necessariamente os mesmos efeitos visuais.

## Tokens semânticos alvo

Exemplo de vocabulário:

```txt
canvas
canvas-subtle
surface
surface-hover
surface-elevated
border
border-subtle
foreground
foreground-soft
foreground-muted
accent
accent-strong
accent-muted
danger
success
shadow
radius-sm
radius-md
radius-lg
font-display
font-body
font-ui
```

O mapeamento inicial deve derivar dos tokens já presentes no CSS legado.

## Tipografia

### Display

- hero e títulos principais;
- serifada;
- forte diferença de escala.

### Heading

- títulos de seção;
- serifada.

### Body

- leitura;
- serifada ou combinação editorial validada visualmente.

### UI / Metadata

- sans-serif;
- tamanho menor;
- alta legibilidade.

### Eyebrow

- uppercase;
- tracking alto;
- accent discreto.

## Interações

Animações devem ser curtas e funcionais:

- hover sutil de imagem;
- mudança de border/foreground;
- drawer/menu com transição curta;
- skeleton/loading quando necessário.

Evitar:

- parallax obrigatório;
- animações longas de navegação;
- efeitos que atrasem acesso à informação;
- movimento excessivo.

Respeitar `prefers-reduced-motion`.

## Header durante a modernização

Mostrar apenas destinos existentes:

```txt
DnD Scribe | Início | Sessões | tema | usuário
```

A estrutura pode estar pronta para novos destinos, mas eles não devem aparecer antes de serem implementados.

## Mobile

Requisitos mínimos:

- hero empilha naturalmente;
- card de sessão vira uma coluna legível;
- áreas clicáveis confortáveis;
- menu não depende de hover;
- transcrição continua pesquisável;
- filtros não quebram largura;
- tipografia de leitura não fica microscópica;
- conteúdo principal não exige zoom.

## Acessibilidade visual

- contraste medido em ambos os temas;
- foco visível;
- estado ativo não comunicado apenas por cor;
- icons acompanhados por label acessível quando necessário;
- imagens de conteúdo com `alt` adequado;
- imagens decorativas ignoradas por leitor de tela.

## Regra para refinamentos

Durante a modernização, mudanças visuais devem ser classificadas como:

1. **paridade** — reproduz o comportamento atual;
2. **refinamento** — melhora consistência sem mudar função;
3. **mudança deliberada de UX** — Home/arquivo e resumo-default;
4. **feature nova** — deve ser adiada.

## Definition of Done

- tokens documentados;
- dark e light implementáveis com a mesma semântica;
- componentes básicos definidos;
- Home moderna especificada sem dados futuros;
- arquivo de sessões especificado;
- página de sessão especificada;
- transcrição preservada como ferramenta secundária;
- mobile considerado;
- regras de ação e interação consistentes.
