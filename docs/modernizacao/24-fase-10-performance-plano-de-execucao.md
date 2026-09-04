# 24 — Fase 10: plano de execução de Performance

Status: **pré-planejado; execução depende da Fase 9 concluída**

## Objetivo

Medir e otimizar a aplicação moderna de forma comparável ao baseline legado, garantindo que a troca de tecnologia não resulte em uma experiência mais pesada ou lenta sem benefício claro.

A Fase 10 não é uma competição por score 100. O objetivo é desempenho real para a mesa, com especial atenção a:

- Home com imagens;
- sessão/resumo longo;
- transcrição longa;
- busca/filtro;
- mobile/rede limitada;
- auth/BFF.

---

## 1. Fonte de comparação

O baseline oficial da Fase 0 deve conter resultados brutos e medianas do legado.

Cenários comparáveis:

```txt
Home autenticada
Sessão/resumo
Transcrição longa
Busca na transcrição
Filtro por speaker
```

A comparação moderna precisa usar:

- mesma sessão de referência quando possível;
- mesma ferramenta/versão ou registro explícito da diferença;
- mesmos perfis desktop/mobile;
- três execuções por cenário no mínimo;
- mediana como valor principal;
- observações sobre variância.

Não comparar um run frio legado com um run quente moderno e chamar isso de ganho.

---

## 2. Métricas principais

Medir no mínimo:

```txt
LCP
CLS
INP quando disponível em uso real
TBT como proxy de laboratório quando necessário
FCP
TTFB
JS transferido
CSS transferido
requests
bytes de imagens
HTML/document bytes
time to first transcript content
time to filtered results
```

Para interações:

- busca;
- speaker filter;
- abrir user menu;
- theme toggle;
- navegação resumo ↔ transcrição.

---

## 3. Core Web Vitals

Objetivos de referência devem seguir boas práticas vigentes na execução.

Não congelar thresholds de plataforma indefinidamente neste documento.

Regra do projeto:

- nenhuma regressão crítica perceptível frente ao legado;
- buscar faixa `good` dos Core Web Vitals quando tecnicamente razoável;
- explicar regressões deliberadas com benefício concreto;
- não sacrificar segurança/acessibilidade para melhorar score.

---

## 4. Laboratório vs uso real

### Laboratório

Lighthouse/DevTools/Playwright podem medir de forma reproduzível:

- LCP;
- CLS;
- TBT;
- bytes;
- requests;
- carga inicial.

### Uso real

INP e variância de rede/dispositivo podem exigir observação de campo.

Nesta fase registrar claramente:

```txt
lab
field/real usage
```

Nunca apresentar TBT como se fosse INP.

---

## 5. Perfis

Mínimo:

### Desktop

Viewport oficial do baseline:

```txt
1920 × 1080 CSS px
```

### Mobile

```txt
390 × 844 CSS px
```

Usar throttling/perfil equivalente entre legado e moderno.

Se a ferramenta mudar defaults entre versões, registrar.

---

## 6. Home

Medir:

- TTFB;
- LCP e qual elemento é LCP;
- tamanho/tempo da imagem da LatestSession;
- covers das RecentSessions;
- JS inicial;
- requests;
- CLS;
- cache behavior em segunda navegação.

### Suspeitas comuns

- `next/image` configurado com `sizes` incorreto enviando imagem gigante;
- hero marcado `priority` sem necessidade;
- todas as capas sendo preloadadas;
- Client Components envolvendo a Home inteira;
- fontes bloqueando render;
- BFF sequencial desnecessário.

---

## 7. Arquivo `/sessoes`

Medir com acervo completo atual.

Observar:

- quantidade de imagens simultâneas;
- lazy loading;
- prefetch de links;
- custo de grid grande;
- memória/scroll;
- comportamento quando o acervo crescer.

Não implementar paginação só por ansiedade futura se o acervo atual não demonstra necessidade.

Se prefetch automático de dezenas de cards gerar tráfego excessivo, ajustar conscientemente.

---

## 8. Página de resumo

Medir:

- TTFB do BFF/upstream;
- tempo de render Markdown;
- HTML final;
- hero LCP;
- JS transferido;
- resumo muito longo;
- layout shift de imagens/fontes.

Meta arquitetural:

> conteúdo editorial deve exigir pouco JavaScript client-side.

Se a página de resumo estiver enviando bundle grande apenas por renderer Markdown client-side, revisar implementação.

---

## 9. Transcrição — primeira página

Medir:

```txt
request server-side inicial
tempo até primeiras falas visíveis
payload da primeira página
hidratação do TranscriptExplorer
JS do componente
```

Comparar com legado usando `PAGE_SIZE=120` como baseline.

Alterar page size somente com benchmark.

---

## 10. Transcrição — carregamento incremental

Medir:

- tempo para próxima página;
- payload;
- render/append;
- scroll durante append;
- duplicação de requests;
- observer disparando cedo/tarde demais.

Testar após várias páginas carregadas.

---

## 11. Transcrição — busca e speaker

Medir separadamente:

```txt
keypress final
→ request começa
→ resposta
→ UI atualizada
```

Registrar:

- debounce;
- network duration;
- upstream duration quando observável;
- render duration;
- total de requests para uma sequência de digitação.

Não mascarar backend lento aumentando debounce absurdamente.

---

## 12. DOM longo

Carregar progressivamente uma sessão até volume alto.

Observar:

- número de nós;
- memória;
- frame drops;
- scroll;
- tempo de append;
- input responsiveness.

### Virtualização

Somente introduzir se benchmark demonstrar problema real.

Se necessária:

- preservar find/search UX;
- acessibilidade;
- scroll behavior;
- copiar texto;
- impressão quando aplicável.

A decisão deve ser documentada separadamente porque muda significativamente a implementação da transcrição.

---

## 13. BFF e upstream

Instrumentar duração em categorias:

```txt
Next render
BFF overhead
legacy upstream
response parsing/validation
```

Objetivo:

- saber onde está o custo;
- não culpar Next por latência do upstream;
- não otimizar validação antes de medir.

Evitar requests server-side duplicados dentro do mesmo render quando os mesmos dados já estão disponíveis.

---

## 14. Paralelismo de dados

Quando uma página precisa de chamadas independentes, avaliar `Promise.all`/paralelismo em vez de waterfalls.

Mas não executar chamadas que não são necessárias apenas porque podem rodar em paralelo.

Documentar waterfalls encontradas.

---

## 15. Cache

Conteúdo é autenticado.

Performance não autoriza cache inseguro.

Auditar:

- cache browser;
- Next Data Cache se usado;
- Vercel CDN;
- upstream headers;
- external rewrites;
- imagens otimizadas.

Regras:

- nada privado em cache compartilhado indevido;
- `Set-Cookie` não cacheado;
- passthrough legado privado conservador;
- cache só quando chave/escopo estão claros.

---

## 16. Imagens

Inventariar para cada papel:

```txt
hero
cover
avatar
ícones/assets
```

Medir:

- formato entregue;
- dimensões intrínsecas;
- dimensões renderizadas;
- bytes;
- DPR;
- cache;
- prioridade.

Corrigir `sizes` que resultem em downloads muito acima do necessário.

Não degradar arte com compressão visivelmente ruim só para melhorar score.

---

## 17. Fontes

Auditar:

- famílias realmente usadas;
- pesos;
- subset;
- preload;
- `font-display`;
- layout shift.

Evitar baixar pesos nunca usados.

Se usar fontes do sistema/serif fallback atual, preservar coerência visual.

---

## 18. JavaScript

Gerar/analisar bundle.

Perguntas:

- quanto JS chega na Home?;
- resumo está quase server-only?;
- Supabase browser SDK está presente em páginas que não precisam dele?;
- transcript bundle é carregado fora da rota de transcrição?;
- bibliotecas futuras foram instaladas sem uso?;

Regras:

- Client Component no menor boundary possível;
- lazy/dynamic import apenas quando benéfico;
- não transformar tudo em client para facilitar estado.

---

## 19. CSS

Auditar:

- CSS duplicado;
- Tailwind output;
- regras globais pesadas;
- styles mortos evidentes;
- blocking stylesheet behavior.

Não sacrificar Design System por micro-otimização sem impacto.

---

## 20. Requests e third-party

Listar requests externos na carga crítica.

Esperado no app autenticado:

- assets próprios;
- imagens aprovadas;
- Supabase/auth quando necessário;
- nenhum script de analytics/third-party desnecessário.

Qualquer third-party novo deve justificar custo e privacidade.

---

## 21. Navegação interna

Medir transições:

```txt
Home → sessão
/sessoes → sessão
Resumo → transcrição
Transcrição → resumo
```

Observar:

- prefetch útil;
- requests duplicados;
- scroll reset esperado;
- loading state;
- image reload desnecessário.

---

## 22. Cold vs warm

Registrar ao menos:

```txt
cold navigation
repeat/warm navigation
```

Quando Vercel Functions tiverem cold-start relevante, identificar sem confundir com média de todas as requests.

---

## 23. Performance budgets

Ao fim da medição inicial moderna, criar budgets úteis para CI quando possível.

Exemplos de categoria:

```txt
JS inicial máximo por rota
imagem LCP máxima aproximada
CLS máximo aceito
regressão percentual vs baseline
```

Não fixar números arbitrários antes de coletar dados.

Budgets finais entram no relatório da fase.

---

## 24. Regressão aceitável

Uma métrica pode piorar se houver benefício necessário, por exemplo:

- autenticação SSR mais segura;
- imagem de melhor qualidade;
- acessibilidade.

Nesse caso registrar:

```txt
métrica
antes
depois
causa
benefício
mitigações avaliadas
aceite
```

Regressão sem explicação bloqueia a fase.

---

## 25. Ordem de otimização

Prioridade:

1. bug/regressão grave;
2. network/image excessiva;
3. waterfalls;
4. JS desnecessário;
5. render/interação lenta;
6. micro-otimizações.

Não gastar horas removendo 2 KB enquanto uma hero baixa 4 MB.

---

## 26. Ferramentas

Preferir ferramentas reproduzíveis:

- Lighthouse/Chrome;
- Playwright traces quando útil;
- Next build/bundle output;
- Vercel observability/log duration;
- browser Performance panel;
- ferramentas de rede.

Registrar versões quando números forem comparativos.

---

## 27. Evidências

Estrutura sugerida:

```txt
docs/modernizacao/baseline/performance/
├── legacy/       # Fase 0
├── modern/
│   ├── home/
│   ├── summary/
│   └── transcript/
└── comparison.md
```

Guardar resultados brutos importantes, não apenas screenshots de scores.

---

## 28. O que NÃO fazer

- cache público de conteúdo privado;
- remover validação para reduzir milissegundos;
- reduzir acessibilidade;
- comprimir imagens de forma destrutiva sem aprovação;
- instalar CDN/serviço novo sem necessidade;
- reescrever backend sem prova de gargalo;
- adicionar feature.

---

## 29. Gate de saída

A Fase 10 termina quando:

```txt
Home desktop/mobile medidos ✅
Resumo medido ✅
Transcrição inicial medida ✅
Infinite load medido ✅
Busca medido ✅
Speaker filter medido ✅
LCP/CLS registrados ✅
INP ou proxy corretamente identificado ✅
JS/CSS/requests/bytes registrados ✅
imagens auditadas ✅
waterfalls auditadas ✅
cache privado revisado ✅
bundle analisado ✅
comparação legado × moderno publicada ✅
sem regressão crítica não justificada ✅
budgets definidos quando úteis ✅
CI/build verde ✅
```

Documentar:

- resultados brutos;
- medianas;
- otimizações aplicadas;
- regressões aceitas e justificativas;
- budgets;
- dívidas restantes.

---

## 30. Próxima fase

Após o gate:

```txt
Fase 11 — Paridade Total
```

A aplicação passa então pela comparação formal requisito por requisito contra o legado e contra as mudanças deliberadamente aprovadas.