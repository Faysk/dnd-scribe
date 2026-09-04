# 11 — Fase 0: evidências e checklist de baseline

Status: **em execução**  
Data de referência: **2026-09-04**

## Objetivo

Controlar de forma explícita o encerramento da Fase 0 — Baseline e congelamento.

A Fase 0 não termina quando “já entendemos o site”. Ela termina quando existe evidência suficiente para comparar o legado e o novo app sem depender de memória visual, conversa ou impressão subjetiva.

---

## 1. Estado geral

| Área | Estado | Observação |
| --- | --- | --- |
| escopo congelado | ✅ | ADR 007 aceito |
| frontend público identificado | ✅ | `web/index.html`, `web/library.js`, `web/library.css`, `web/theme.js` |
| rotas atuais identificadas | ✅ | hash routing documentado |
| auth atual identificada | ✅ | Supabase client + Bearer API + campaignRole |
| endpoints públicos usados pelo player | ✅ | contratos documentados |
| comportamento de resumo | ✅ | Markdown + sanitização client-side |
| comportamento de transcrição | ✅ | busca, speaker, cursor e carregamento progressivo |
| tema dark/light/system | ✅ | contrato identificado |
| build/deploy atual | ✅ | inventário documental separado |
| baseline visual desktop | 🟡 | Home dark/light e transcript dark disponíveis, ainda não versionados no repo |
| baseline visual mobile | ⬜ | faltam capturas oficiais |
| login/acesso pendente/erro | ⬜ | faltam capturas oficiais |
| performance legado | ⬜ | medição fica para baseline técnico antes da comparação de Fase 10 |

---

## 2. Evidência de código auditada

### Shell e navegação

- [x] `web/index.html` auditado;
- [x] marca/header identificados;
- [x] skip link identificado;
- [x] menu do usuário identificado;
- [x] theme toggle identificado;
- [x] container `#app` identificado;
- [x] dependências carregadas no shell identificadas.

### Roteamento

- [x] `#/`;
- [x] `#/sessao/:id`;
- [x] `#/sessao/:id/resumo`;
- [x] semântica atual transcrição-first registrada;
- [x] mudança deliberada resumo-first registrada.

### Auth

- [x] `/api/auth-config`;
- [x] Discord;
- [x] Google;
- [x] Supabase browser session;
- [x] Bearer token em requests;
- [x] `/api/auth/me`;
- [x] `profile`;
- [x] `campaignRole`;
- [x] `capabilities`;
- [x] estado de acesso pendente;
- [x] `canOpenEdit` no menu.

### Biblioteca

- [x] `/api/library-sessions`;
- [x] `/api/library-summary`;
- [x] `/api/library-transcript`;
- [x] `/api/session-download`;
- [x] campos principais consumidos pelo frontend;
- [x] cache privado identificado.

### Transcrição

- [x] page size atual = 120;
- [x] cursor;
- [x] `nextCursor`;
- [x] query textual;
- [x] speaker;
- [x] contador;
- [x] clear filters;
- [x] IntersectionObserver;
- [x] prefetch margin atual;
- [x] fallback manual;
- [x] retry;
- [x] empty state;
- [x] deduplicação no append;
- [x] download Markdown.

### Visual

- [x] tokens dark auditados;
- [x] tokens light auditados;
- [x] tipografia auditada;
- [x] largura de conteúdo e shell auditados;
- [x] estados de foco auditados;
- [x] elementos básicos de acessibilidade auditados.

---

## 3. Evidências visuais disponíveis fora do repositório

Durante o planejamento foram fornecidas capturas reais do `dnd.faysk.dev`.

Elas são úteis como referência nesta etapa, mas ainda não contam como baseline final versionado enquanto não forem armazenadas de forma reproduzível no repositório ou em artefato de teste controlado.

### Capturas já disponíveis na conversa/projeto

| Tela | Tema | Resolução do arquivo | Situação |
| --- | --- | ---: | --- |
| Home | dark | 1919 × 1079 | disponível, não versionada |
| Home | light | 2048 × 1280 | disponível, não versionada |
| Sessão/transcrição | dark | 2047 × 1279 | disponível, não versionada |
| Home light — captura adicional | light | 1919 × 1079 | disponível, não versionada |

As imagens de conceito geradas para a Home modernizada NÃO são baseline do legado. Elas pertencem ao direcionamento visual futuro e não devem ser usadas como golden snapshot do estado atual.

---

## 4. Estrutura proposta para baseline visual versionado

Quando as capturas oficiais forem consolidadas, usar uma estrutura equivalente a:

```txt
docs/modernizacao/baseline/
├── desktop/
│   ├── dark/
│   │   ├── login.png
│   │   ├── pending-access.png
│   │   ├── home.png
│   │   ├── session-transcript.png
│   │   ├── session-summary.png
│   │   └── error.png
│   └── light/
│       └── ...
│
└── mobile/
    ├── dark/
    │   └── ...
    └── light/
        └── ...
```

Alternativa aceitável: os snapshots podem morar em diretório de testes visuais quando Playwright entrar, desde que exista mapeamento explícito entre baseline legado e snapshot novo.

Não duplicar binários grandes sem necessidade. Se os arquivos forem mantidos fora do Git por custo/tamanho, o documento deve apontar para um artefato durável e versionado.

---

## 5. Matriz de capturas obrigatórias

### Desktop

| Tela | Dark | Light | Prioridade |
| --- | --- | --- | --- |
| login | ⬜ | ⬜ | alta |
| acesso pendente | ⬜ | ⬜ | alta |
| Home | 🟡 | 🟡 | alta |
| sessão — transcrição | 🟡 | ⬜ | alta |
| sessão — resumo | ⬜ | ⬜ | alta |
| erro | ⬜ | ⬜ | média |
| empty state | ⬜ | ⬜ | média |
| user menu aberto | ⬜ | ⬜ | média |

### Mobile

| Tela | Dark | Light | Prioridade |
| --- | --- | --- | --- |
| login | ⬜ | ⬜ | alta |
| Home | ⬜ | ⬜ | alta |
| sessão — transcrição | ⬜ | ⬜ | alta |
| sessão — resumo | ⬜ | ⬜ | alta |
| user menu | ⬜ | ⬜ | média |
| erro | ⬜ | ⬜ | média |

Legenda:

- `⬜` faltando;
- `🟡` referência disponível, ainda não congelada/versionada;
- `✅` baseline oficial congelado.

---

## 6. Viewports a congelar

O baseline oficial deve usar viewports explícitos e reproduzíveis.

Sugestão para testes futuros:

```txt
desktop principal: 1920 × 1080
mobile principal: 390 × 844
```

É permitido adicionar outro desktop de alta densidade ou tablet, mas o gate não deve depender de dezenas de resoluções.

A resolução dos screenshots fornecidos até agora não deve ser confundida com viewport CSS exato do browser; eles incluem cromos do navegador e/ou captura de tela completa.

---

## 7. Conteúdo real de referência

Para comparação visual e funcional, escolher sessões reais estáveis.

### Sessão principal recomendada

A sessão mais recente atualmente visível:

```txt
26 de agosto de 2026
O Olho que Devora a Floresta
```

Motivos:

- possui capa;
- possui hero;
- possui resumo;
- possui transcrição longa;
- possui metadata completa;
- representa o estado visual mais recente do produto.

### Sessão antiga adicional

Escolher pelo menos uma sessão mais antiga para validar:

- títulos antigos/normalização;
- ausência potencial de algum metadata;
- compatibilidade com acervo histórico.

A sessão exata deve ser registrada quando o teste automatizado for criado.

---

## 8. Fluxos manuais que precisam de evidência

### Login aprovado

```txt
abrir app
→ login Discord ou Google
→ callback
→ profile/campaignRole carregado
→ Home
```

### Login sem aprovação

```txt
login válido
→ sem campaignRole
→ tela "Acesso pendente"
→ "Verificar novamente"
```

### Consulta de sessão

```txt
Home
→ card
→ transcrição no legado
→ Ler resumo
→ resumo
→ voltar à transcrição
```

### Busca

```txt
transcrição
→ informar texto
→ resultados
→ limpar filtros
```

### Speaker

```txt
transcrição
→ selecionar speaker
→ resultados filtrados
→ limpar filtros
```

### Download

```txt
sessão
→ baixar transcrição .md
→ arquivo recebido
```

### Tema

```txt
system
→ light
→ dark
→ system
```

Validar também atualização automática quando a preferência está em `system`.

---

## 9. Baseline de acessibilidade

Antes da migração, registrar como requisitos mínimos já existentes:

- [x] skip link;
- [x] focus visible;
- [x] elementos `sr-only`;
- [x] menu com ARIA;
- [x] search input com label;
- [x] speaker filter com label;
- [x] toast anunciado;
- [x] loading/área principal com `aria-live` onde aplicável.

Capturas não comprovam acessibilidade. Esses itens devem virar testes/checagens próprios nas fases seguintes.

---

## 10. Baseline técnico ainda pendente

As seguintes medições não precisam impedir a documentação conceitual, mas precisam existir antes da comparação de performance:

- [ ] LCP da Home legada;
- [ ] CLS da Home legada;
- [ ] INP em uso normal;
- [ ] tamanho inicial de JS/CSS;
- [ ] número de requests da Home;
- [ ] LCP da sessão;
- [ ] tempo típico de primeira página da transcrição;
- [ ] tempo de busca da transcrição com sessão real.

Essas medições serão registradas com ferramenta e ambiente definidos para que o número novo seja comparável ao legado.

---

## 11. O que já está congelado

### Escopo

Não entram durante a modernização:

- personagens;
- NPCs;
- lore editável;
- galerias de personagens;
- itens/coleções;
- timeline;
- relações;
- grafo;
- busca global de entidades.

### Semântica futura aprovada

Estas mudanças são intencionais:

- Home vira entrada da campanha;
- `/sessoes` vira arquivo completo;
- resumo vira default da sessão;
- transcrição vira recurso secundário.

O restante deve buscar paridade.

---

## 12. Gate de encerramento da Fase 0

### Auditoria documental

- [x] mapa do frontend atual;
- [x] rotas atuais;
- [x] contratos de API usados pelo player;
- [x] auth atual;
- [x] tema atual;
- [x] comportamento do resumo;
- [x] comportamento da transcrição;
- [x] build/deploy identificados;
- [x] feature freeze formal.

### Evidência visual

- [ ] baseline Home desktop dark versionado;
- [ ] baseline Home desktop light versionado;
- [ ] baseline session/transcript desktop dark versionado;
- [ ] baseline session/transcript desktop light versionado;
- [ ] baseline summary desktop dark/light versionado;
- [ ] baseline mobile essencial versionado;
- [ ] login e pending access documentados visualmente.

### Gate

Enquanto os itens visuais essenciais acima estiverem pendentes:

```txt
FASE 0 = EM EXECUÇÃO
```

É permitido continuar refinando a Fase 1 documental em paralelo, mas o bootstrap da nova aplicação não deve ser tratado como iniciado oficialmente até o baseline mínimo estar congelado.
