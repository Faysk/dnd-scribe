# 25 — Fase 11: plano de execução de Paridade Total

Status: **pré-planejado; execução depende da Fase 10 concluída**

## Objetivo

Provar de forma sistemática que a aplicação moderna preserva todas as capacidades obrigatórias do app público legado, exceto as mudanças de UX explicitamente aprovadas no roadmap.

Esta fase transforma “parece pronto” em uma matriz verificável.

---

## 1. Fontes de verdade

A avaliação usa conjuntamente:

- baseline da Fase 0;
- contratos documentados em `10-contratos-legado-app-publico.md`;
- matriz `06-matriz-de-paridade.md`;
- golden baseline visual;
- resultados de performance legado/moderno;
- ADRs aceitos;
- mudanças deliberadas de UX aprovadas.

Nenhum comportamento legado é descartado por memória subjetiva.

---

## 2. Classes de resultado

Cada item recebe um estado:

```txt
PASS
PASS — DELIBERATE CHANGE
FAIL
BLOCKED
NOT APPLICABLE
```

### PASS

Comportamento equivalente ou melhor sem alterar a capacidade.

### PASS — DELIBERATE CHANGE

Diferença prevista e aprovada, por exemplo:

```txt
sessão abre resumo, não transcrição
Home não lista o acervo inteiro
```

### FAIL

Regressão ou requisito ausente.

### BLOCKED

Não pôde ser testado por dependência externa. Não vale como aprovação final.

### NOT APPLICABLE

Somente quando o requisito realmente deixou de existir por decisão formal.

---

## 3. Paridade de autenticação

Validar:

```txt
Discord login
Google login
callback
sessão persistida
refresh
logout
pending access
recheck pending
profile
avatar
campaignRole
capabilities
canOpenEdit
401
403
```

A implementação interna mudou, mas o usuário continua recebendo os mesmos limites de acesso.

---

## 4. Paridade de tema

Validar:

```txt
system
light
dark
persistência da escolha
mudança do sistema quando preferência = system
sem flash relevante
```

Comparar identidade, não pixel-perfect de layout em telas deliberadamente redesenhadas.

---

## 5. Paridade de Home

A Home possui mudança deliberada.

### Legado

```txt
catálogo completo
```

### Moderno

```txt
CampaignHero
LatestSession
ArchiveStats
RecentSessions
```

Validar que capacidades de acesso não foram perdidas:

- sessão mais recente acessível;
- sessões recentes acessíveis;
- arquivo completo acessível em `/sessoes`;
- metadados relevantes preservados;
- imagens preservadas.

A ausência do catálogo completo na Home é `PASS — DELIBERATE CHANGE`, não FAIL.

---

## 6. Paridade do arquivo `/sessoes`

Validar contra catálogo legado:

- todas as sessões publicadas aparecem;
- nenhuma sessão estranha aparece;
- ordem correta;
- título;
- data;
- summary curto;
- cover;
- falas;
- participantes;
- duração;
- navegação.

Comparar IDs/conjunto de sessões programaticamente quando possível.

---

## 7. Paridade da página de sessão

Mudança deliberada:

```txt
/sessoes/[id]
→ resumo
```

Validar:

- título;
- data;
- arco;
- hero/cover fallback;
- summary;
- summaryFull;
- Markdown;
- sessão sem resumo;
- sessão inexistente;
- navegação para transcrição;
- retorno a `/sessoes`.

---

## 8. Paridade de Markdown

Escolher corpus representativo:

- resumo curto;
- resumo longo;
- headings;
- listas;
- links;
- blockquote;
- tabela/code se existirem no acervo.

Comparar conteúdo textual/estrutura.

Diferenças de CSS aprovadas podem existir; perda de conteúdo não.

Criar teste de corpus quando possível para detectar elementos não renderizados.

---

## 9. Paridade da transcrição

Checklist obrigatório:

```txt
primeira página
120 como baseline inicial
ordem cronológica
speaker
texto
timestamp
total
speakers list
cursor
nextCursor
infinite load
fallback manual
search
speaker filter
search + speaker
clear filters
empty
retry
append dedup
download .md
```

Teste com sessão longa real.

---

## 10. Comparação de dados da transcrição

Para queries fixas, comparar legado e moderno.

Exemplos:

```txt
q = termo conhecido
speaker = speaker conhecido
q + speaker
cursor page 1/2
```

Comparar pelo menos:

- total;
- IDs dos segmentos retornados;
- speaker;
- startMs;
- text.

Se BFF apenas retransmite contrato validado, diferenças inesperadas são bugs.

---

## 11. Download

Baixar o mesmo transcript no legado e no moderno.

Comparar:

- status;
- filename;
- content type;
- tamanho aproximado;
- conteúdo/hash quando contrato permitir equivalência byte-a-byte.

Se headers forem modernizados deliberadamente, conteúdo ainda precisa ser equivalente.

---

## 12. Links antigos

Conforme ADR 011:

```txt
/#/sessao/:id
/#/sessao/:id/resumo
```

Validar no candidato de homologação:

- redirect/replace correto;
- sem loop;
- ID preservado;
- back/forward coerente;
- hash desconhecido seguro.

---

## 13. Contratos legados fora do frontend

Conforme ADR 012, o cutover futuro precisa preservar rotas antigas.

Antes da homologação final, classificar/inventariar:

```txt
/api/*
/edit/*
/central-local/*
/terms
/privacy
/linked-role
/docs/api/*
```

Para cada path representativo:

```txt
modern-local
legacy-passthrough
retirada deliberada
```

Nesta fase o gateway pode ser testado no hostname de homologação sem mover `dnd.faysk.dev`.

---

## 14. Paridade de erros

Comparar capacidades, não texto exato.

Cenários:

```txt
401
403
404 sessão
500 upstream
timeout
transcript load-more error
sem resultados
sem sessões
imagem ausente
```

Requisitos:

- erro compreensível;
- retry quando apropriado;
- sem segredo;
- sem tela branca;
- estado já carregado preservado quando aplicável.

---

## 15. Paridade acessível

Não é suficiente preservar bugs de acessibilidade do legado.

O moderno deve no mínimo manter e preferencialmente melhorar:

- skip link;
- keyboard;
- focus visible;
- labels;
- ARIA correto;
- contraste;
- reduced motion.

A melhoria é `PASS`, mesmo que não seja pixel-perfect.

---

## 16. Paridade visual

Separar telas em duas categorias.

### Categoria A — paridade/refinamento

Exemplos:

- login;
- pending access;
- header;
- transcrição enquanto ferramenta.

Comparação visual mais próxima do legado.

### Categoria B — mudança deliberada

- Home;
- página de sessão resumo-first.

Avaliar:

- mesma identidade;
- cores/tokens;
- tipografia;
- densidade;
- cards;
- imagens;
- não genericização.

Não bloquear porque posição de elementos deliberadamente mudou.

---

## 17. Desktop e mobile

Cada fluxo obrigatório deve ser marcado em ambos quando aplicável.

Matriz mínima:

```txt
Desktop Chromium
Desktop Firefox
Desktop WebKit/Safari engine
Mobile Chromium em viewport oficial
Mobile WebKit em viewport oficial
```

Não é necessário repetir todo cenário combinatorial se uma feature não varia, mas os fluxos principais precisam de cobertura real.

---

## 18. Browsers

Objetivo:

- Chromium;
- Firefox;
- WebKit.

Problemas específicos devem ser classificados.

Bloqueadores:

- login quebrado;
- layout inutilizável;
- transcrição sem scroll/interação;
- download impossível;
- tema quebrado;
- navegação essencial falhando.

---

## 19. Performance como requisito de paridade

Importar resultado da Fase 10.

A matriz deve registrar:

```txt
Home legacy vs modern
Summary legacy vs modern
Transcript legacy vs modern
Search/filter legacy vs modern
```

Regressões aceitas precisam referenciar justificativa da Fase 10.

---

## 20. Automação vs manual

### Automatizar

Tudo que for determinístico:

- rotas;
- auth mocks/contracts;
- session IDs;
- dados;
- busca/filtro;
- download;
- links hash;
- a11y básica;
- visual snapshots.

### Manual

Onde julgamento humano importa:

- qualidade visual;
- leitura longa;
- OAuth real;
- uso real mobile;
- percepção de hierarquia.

Nenhum dos dois substitui o outro.

---

## 21. Matriz canônica

Atualizar `06-matriz-de-paridade.md` ou gerar documento derivado de execução.

Campos recomendados:

```txt
ID
Área
Requisito
Legado
Moderno
Tipo de mudança
Automated test
Manual evidence
Status
Issue
```

Todos os requisitos obrigatórios devem chegar a PASS.

---

## 22. Evidência por FAIL

Todo FAIL abre issue ou referência equivalente com:

- passos;
- esperado;
- obtido;
- screenshot/log;
- severidade;
- responsável/status.

Não corrigir silenciosamente e esquecer de atualizar a matriz.

---

## 23. Feature freeze

Qualquer ideia percebida durante comparação que não seja regressão recebe:

```txt
future feature
```

Não entra no PR de paridade.

Exemplos:

- “seria legal filtrar sessões por arco”;
- “poderia ter busca global”;
- “vamos adicionar NPC aqui”.

Essas ideias pertencem ao roadmap pós-modernização.

---

## 24. Release candidate

Ao final da fase, marcar um commit exato como candidato de homologação.

Registrar:

```txt
commit SHA
Preview URL
versões de runtime/framework
data
matriz commit/version
```

Fase 12 deve testar esse candidato, não uma branch movendo a cada minuto sem rastreabilidade.

Correções após achados de homologação geram novo candidato e nova identificação.

---

## 25. Gate de saída

A Fase 11 termina quando:

```txt
matriz funcional 100% obrigatória PASS ✅
auth parity ✅
theme parity ✅
Home deliberate change aprovada ✅
/sessoes completo ✅
summary parity ✅
Markdown corpus ✅
transcript parity ✅
download parity ✅
legacy hash bridge ✅
legacy gateway matrix preparada ✅
error states ✅
a11y parity/melhoria ✅
visual matrix ✅
desktop ✅
mobile ✅
Chromium/Firefox/WebKit críticos ✅
performance findings incorporados ✅
0 FAIL obrigatório ✅
release candidate identificado ✅
```

`BLOCKED` em requisito obrigatório impede o gate até resolução ou decisão formal de escopo.

---

## 26. Próxima fase

Após o gate:

```txt
Fase 12 — Homologação
```

A partir daí a mesa testa o release candidate como produto, não como coleção de testes técnicos.