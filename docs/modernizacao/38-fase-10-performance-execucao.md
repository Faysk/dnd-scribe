# 38 — Fase 10: execução de Performance

Status: **bloco técnico concluído; benchmark autenticado comparativo pendente**  
Data: **2026-09-04**

## Resultado executivo

A revisão técnica da aplicação moderna encontrou e corrigiu custos concretos de rede/render sem alterar produto, segurança ou acessibilidade.

O gate completo da Fase 10 **não é declarado concluído ainda** porque o baseline de performance legado continua sem medições autenticadas reais e as rotas relevantes do novo app também exigem sessão aprovada. Sem isso não é honesto publicar LCP/CLS/TTFB ou comparação legado × moderno como se fossem representativos da experiência dos players.

O que já pode ser provado por build, código e CI está concluído e verde.

---

## 1. Achados concretos

### P10-01 — capas do catálogo como `background-image`

Antes desta fase, `SessionCard` usava CSS `background-image` para a arte.

Consequências:

- sem pipeline de otimização do `next/image`;
- sem `srcset`/seleção responsiva gerada pelo Next;
- browser podia iniciar downloads de capas assim que os cards entravam no estilo calculado;
- o tamanho efetivamente entregue não era controlado pela largura renderizada do card.

Correção:

- cards usam `next/image` via `ArtworkImage`;
- `sizes="(min-width: 768px) 11rem, 100vw"`;
- lazy loading permanece no comportamento padrão das capas;
- fallback visual foi preservado.

### P10-02 — heroes fora do image optimizer

`LatestSession`, resumo e transcrição carregavam arte via CSS ou `<img>` direto.

Correção:

- hero da última memória usa `next/image` com `priority` e `sizes` responsivo;
- hero do resumo e da transcrição usam `next/image` com dimensão de layout estável e prioridade;
- o aspect ratio existente foi preservado.

### P10-03 — origens de imagem abertas demais para migração segura

O inventário real do banco mostrou arte publicada apenas em:

```txt
dmrqnbdvbkfqzctcerbx.supabase.co
dnd.faysk.dev
raw.githubusercontent.com
```

Correção:

- `next.config.ts` contém `remotePatterns` apenas para essas origens;
- contratos de biblioteca, resumo e transcrição normalizam URL antes do renderer;
- HTTP, credenciais embutidas e host desconhecido são rejeitados;
- teste unitário cobre a fronteira.

A allowlist deve ser atualizada conscientemente se uma nova origem de arte for adotada no futuro.

### P10-04 — prefetch de navegação autenticada cara

O catálogo possui muitos links de sessão e a navegação de sessão possui link direto para transcrição, uma rota que pode carregar 120 segmentos logo na primeira resposta.

Correção:

- `SessionCard` usa `prefetch={false}`;
- navegação `Resumo ↔ Transcrição` usa `prefetch={false}`;
- o CTA principal da última memória mantém o comportamento padrão porque representa intenção de navegação de alta probabilidade.

Objetivo: não trocar latência percebida por tráfego privado antecipado em dezenas de destinos que o player talvez nunca abra.

---

## 2. Client bundle — inventário CI

Build medido no GitHub Actions com Node 24 / Next 16.3.3.

Resultado do inventário de `.next/static`:

```txt
JS:  880.7 KiB raw / 264.7 KiB gzip em 17 arquivos
CSS: 32.4 KiB raw /   6.6 KiB gzip em 1 arquivo
```

Maiores chunks por gzip no build observado:

```txt
69.9 KiB
64.8 KiB
44.0 KiB
38.7 KiB
 8.1 KiB
 7.5 KiB
```

Observação importante:

> este é um inventário estático global dos chunks emitidos, não JS inicial por rota.

Portanto ele serve como série histórica e detector grosseiro de explosão do bundle, mas não deve ser usado como afirmação de que Home transfere 264.7 KiB de JS.

Foi adicionado `measure:client-bundle` ao CI. Um budget rígido ainda não foi fixado porque não há série histórica suficiente nem medição por rota; escolher um número agora seria arbitrário.

---

## 3. Segurança do bundle

A auditoria pós-build da Fase 9 continua ativa junto da medição de tamanho.

Neste build:

```txt
18 arquivos auditados
0 marcadores server-only encontrados
```

A otimização de imagens não moveu origins internas, tokens ou segredos para o client.

---

## 4. Testes e build

Gate do Web Next após as mudanças:

```txt
TypeScript              PASS
ESLint                  PASS (0 errors; 1 warning preexistente de PostCSS)
Vitest                  PASS — 12 arquivos / 25 testes
Next production build   PASS
Client secret audit     PASS
Bundle inventory        PASS
Playwright              PASS — 11/11
```

Gate legado/companion no mesmo head:

```txt
App checks               PASS
Python syntax            PASS
Companion regression     PASS
```

Não houve regressão detectada no sistema antigo durante este bloco.

---

## 5. Waterfall da página de resumo

A página atualmente executa:

```txt
library-sessions
→ localizar sessão
→ se hasSummary = true
→ library-summary
```

Isso é um waterfall real, porém deliberadamente **não foi convertido cegamente para `Promise.all`**.

Motivo:

- `library-sessions` determina existência da sessão e `hasSummary`;
- disparar `library-summary` em paralelo criaria request desnecessário/404 para sessões sem resumo;
- a implementação atual também usa metadados da biblioteca que o contrato de resumo não fornece integralmente.

Decisão da fase:

> manter até existir benchmark autenticado ou endpoint específico que entregue os metadados necessários sem duplicação.

Performance não justifica aumentar tráfego ou alterar contrato apenas para remover uma waterfall teórica.

---

## 6. Cache

Não foi introduzido cache compartilhado de conteúdo autenticado.

Mantido:

```txt
legacy fetch: cache = no-store
BFF transcript: private, no-store
conteúdo privado sem CDN/Data Cache compartilhado explícito
```

A fase não troca isolamento por score de benchmark.

---

## 7. Virtualização da transcrição

Não implementada.

Motivo:

- a primeira página continua em 120 segmentos, preservando o contrato atual;
- infinite load continua incremental;
- não existe evidência medida de DOM longo causando degradação real que justifique a complexidade de virtualização;
- virtualização afetaria copiar texto, find, acessibilidade e comportamento de scroll.

Decisão permanece conforme o plano: medir antes de introduzir.

---

## 8. Benchmark autenticado — BLOCKED

O protocolo de baseline da Fase 0 já registra que as medições autenticadas do legado nunca foram persistidas.

Continuam pendentes:

```txt
Home legado — desktop/mobile — 3 runs
sessão/transcrição longa legado — desktop/mobile — 3 runs
busca legado
speaker filter legado
resumo legado
Home moderna autenticada
resumo moderno autenticado
transcrição moderna autenticada
busca/filtro modernos
LCP / CLS / TBT / TTFB / bytes / requests comparáveis
```

Sem uma sessão de navegador real aprovada na campanha, uma ferramenta externa mede login/redirect e não o produto.

Classificação:

```txt
BLOCKED — requires authenticated browser evidence
```

Esse bloqueio é de evidência, não um defeito conhecido do app.

---

## 9. Estado do gate da Fase 10

### Concluído

```txt
imagens auditadas ✅
image optimizer aplicado ✅
origens restritas ✅
prefetch excessivo reduzido ✅
JS/CSS estático inventariado ✅
client bundle auditado por segredo ✅
cache privado preservado ✅
waterfall revisada conscientemente ✅
virtualização avaliada sem implementação prematura ✅
CI/build verde ✅
legado/companion verde ✅
```

### Pendente para gate formal

```txt
Home desktop/mobile medidos ⏳
Resumo autenticado medido ⏳
Transcrição autenticada medida ⏳
Infinite load medido em sessão real ⏳
Busca medida em sessão real ⏳
Speaker filter medido em sessão real ⏳
LCP/CLS registrados ⏳
comparação legado × moderno publicada ⏳
budget por rota definido com evidência ⏳
```

---

## 10. Próximo passo

Não iniciar a declaração formal de Paridade Total enquanto a Fase 10 tiver requisito obrigatório `BLOCKED`.

É seguro, porém, manter estas otimizações no `main`, porque são mudanças isoladas, cobertas por CI e não dependem do benchmark para serem corretas.

Quando houver janela de homologação com login real, executar o protocolo de performance antes de fechar formalmente a Fase 10 e marcar o release candidate da Fase 11.
