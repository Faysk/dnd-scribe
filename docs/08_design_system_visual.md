# Design system visual — TDA

Este documento define o padrão visual que a interface pública do TDA deve seguir. O objetivo é impedir que cada tela invente uma paleta, um botão ou uma hierarquia diferente.

## Princípios

1. **Visitante vê história; editor vê estado editorial.** A interface pública prioriza título, arco, data, resumo e arte. Indicadores como `publicado`, `completo`, `ilustrado`, `em preparação` e métricas de cobertura não devem aparecer para o visitante, salvo quando alterarem de fato a ação disponível.
2. **Cores têm função semântica.** Componentes não devem escolher hexadecimais diretamente. Devem usar tokens do design system.
3. **Claro e escuro são a mesma identidade.** O tema muda luminância e contraste, não a hierarquia da marca.
4. **Acento é raro.** O dourado serve para marca, navegação ativa, arco, foco e ação primária. Não deve competir com título, resumo ou arte.
5. **Legibilidade vence decoração.** Texto normal deve atingir contraste WCAG AA de pelo menos 4.5:1; texto grande pode usar 3:1; limites e estados visuais de componentes interativos devem manter pelo menos 3:1 quando necessários para identificação.

## Paleta semântica

A implementação oficial fica em `apps/web/app/globals.css`.

### Tema escuro

| Papel | Token | Valor |
| --- | --- | --- |
| Fundo principal | `--ds-canvas` | `#0a0c0f` |
| Fundo secundário | `--ds-canvas-subtle` | `#101419` |
| Superfície | `--ds-surface` | `#151a20` |
| Superfície elevada | `--ds-surface-elevated` | `#11151a` |
| Texto principal | `--ds-foreground` | `#eee8dc` |
| Texto secundário | `--ds-foreground-soft` | `#c8c2b7` |
| Texto auxiliar | `--ds-foreground-muted` | `#9aa1aa` |
| Acento | `--ds-accent` | `#d7aa61` |
| Acento forte / foco | `--ds-accent-strong` | `#f2c879` |
| Botão primário | `--ds-action-primary-bg` | `#e7b95f` |
| Texto do botão primário | `--ds-action-primary-foreground` | `#15100a` |

O par do botão primário escuro tem contraste superior a 10:1, portanto não deve ser trocado por texto claro sobre o amarelo.

### Tema claro

| Papel | Token | Valor |
| --- | --- | --- |
| Fundo principal | `--ds-canvas` | `#f3efe7` |
| Fundo secundário | `--ds-canvas-subtle` | `#fffdf8` |
| Superfície | `--ds-surface` | `#e9e3d8` |
| Superfície elevada | `--ds-surface-elevated` | `#fffdf8` |
| Texto principal | `--ds-foreground` | `#191917` |
| Texto secundário | `--ds-foreground-soft` | `#4f4b44` |
| Texto auxiliar | `--ds-foreground-muted` | `#625d55` |
| Acento | `--ds-accent` | `#805817` |
| Acento forte / foco | `--ds-accent-strong` | `#9a6a1d` |
| Botão primário | `--ds-action-primary-bg` | `#805817` |
| Texto do botão primário | `--ds-action-primary-foreground` | `#fffdf8` |

## Botões e ações

Toda ação textual reutilizável deve passar por `Button`, `ActionLink` ou `actionStyles` em `apps/web/components/ui/action.tsx`.

### Primário

Usar para a ação principal da seção ou tela, por exemplo `Ler esta memória`.

- fundo sólido usando `action-primary`;
- texto usando `action-primary-foreground`;
- uma única ação primária dominante por bloco;
- altura mínima de 44 px no tamanho padrão;
- hover altera luminância e pode mover 1 px, sem glow;
- foco por teclado usa outline explícito com `accent-strong`.

### Secundário

Usar para ações importantes, mas não dominantes. Fundo de superfície, borda visível e texto principal.

### Terciário

Usar para navegação auxiliar e ações de baixa prioridade. Sem borda permanente; o hover cria superfície sutil.

### Não fazer

- não usar texto branco/creme sobre amarelo claro;
- não criar botão com hex inline;
- não usar dourado em todos os botões;
- não depender apenas da cor para comunicar seleção ou estado;
- não remover foco visível.

## Cards de sessão

### Card principal / última memória

O card principal é editorial, não um dashboard.

Hierarquia:

1. `Última memória`;
2. `Arco` como metadado textual discreto, sem pill grande;
3. título;
4. resumo;
5. data;
6. ação `Ler esta memória`;
7. arte.

Regras de proporção:

- largura máxima recomendada: aproximadamente 1080 px;
- texto e imagem devem ter peso visual semelhante;
- a imagem usa `object-cover` e `object-center`, sem deformação;
- no desktop, evitar coluna de imagem estreita e excessivamente alta;
- no mobile, texto e imagem empilham naturalmente;
- o resumo pode ser limitado em cards de destaque para impedir que uma sessão excepcionalmente longa altere toda a composição.

### Cards do arquivo

Manter a hierarquia já aprovada:

- arco;
- data;
- título;
- resumo curto;
- imagem quando existir.

Não exibir status editorial do conteúdo.

## Arcos

Nos cards compactos, o arco pode continuar em caixa alta como metadado. No card principal, o arco deve aparecer como uma linha editorial:

`ARCO  Valcinzento e o Coração-Raiz`

Isso evita competir com `Última memória` e com o título, além de funcionar melhor quando o nome do arco for comprido.

## Tipografia

- `font-display`: títulos e chamadas narrativas;
- `font-body`: conteúdo e resumos;
- `font-ui`: navegação, metadados, botões e controles.

Não misturar fonte display em controles de interface.

## Acessibilidade

O padrão segue WCAG AA como piso de contraste:

- texto normal: **4.5:1**;
- texto grande: **3:1**;
- componentes e gráficos essenciais: **3:1** contra cores adjacentes quando a borda/forma for necessária para identificação;
- foco de teclado deve permanecer visível;
- `prefers-reduced-motion` deve continuar desativando animações não essenciais.

Referências de pesquisa utilizadas para este padrão:

- W3C WAI — WCAG 1.4.3 Contrast (Minimum);
- W3C WAI — Visual Design / contraste de controles e gráficos;
- W3C WAI — Designing for Web Accessibility.

## Checklist para novas telas

Antes de publicar uma nova interface:

- usa somente tokens semânticos de cor?
- ação primária vem do componente compartilhado?
- botão primário é legível nos dois temas?
- arco, data e outros metadados não competem com o título?
- existe algum status editorial aparecendo para visitante sem necessidade?
- imagens mantêm proporção e crop intencional?
- foco visível funciona com teclado?
- claro e escuro preservam a mesma hierarquia visual?
