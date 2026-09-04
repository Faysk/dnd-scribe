# ADR 012 — Origem legada estável e gateway no cutover

Status: **Accepted**  
Data: **2026-09-04**

## Contexto

O domínio de produção atual:

```txt
https://dnd.faysk.dev
```

não hospeda apenas o frontend público legado.

O mesmo projeto Vercel atual também atende contratos operacionais que precisam sobreviver à modernização, incluindo:

```txt
/api/*
/edit
/edit/*
/central-local
/central-local/*
/terms
/privacy
/linked-role
/docs/api
/docs/api/*
```

Além disso, o projeto atual executa funções, integrações e crons que não pertencem ao escopo de migração do app público.

Durante as Fases 5–8, o novo app precisa consumir a API legada por um BFF server-side.

Uma implementação ingênua poderia configurar:

```txt
DND_LEGACY_ORIGIN=https://dnd.faysk.dev
```

Isso funcionaria enquanto `dnd.faysk.dev` ainda apontasse para o projeto antigo, mas quebraria no cutover da Fase 13: depois que o domínio passasse para o novo projeto Next, o BFF passaria a chamar a si próprio e poderia entrar em loop ou atingir a rota errada.

Existe outro risco: simplesmente mover `dnd.faysk.dev` para o novo projeto faria desaparecer todas as rotas antigas que continuam necessárias, caso o novo projeto não as encaminhasse explicitamente.

Portanto a topologia de cutover precisa ser definida antes da primeira integração BFF real.

---

## Decisão

O projeto Vercel legado receberá uma **origem técnica estável e independente do domínio público principal** antes da primeira integração real do BFF.

Nome recomendado:

```txt
https://legacy.dnd.faysk.dev
```

O nome final pode variar por disponibilidade ou convenção operacional, mas deve cumprir os mesmos requisitos deste ADR.

O novo app nunca usará `https://dnd.faysk.dev` como origem interna da API legada.

Usará variável server-only equivalente a:

```txt
DND_LEGACY_ORIGIN=https://legacy.dnd.faysk.dev
```

Fluxo durante migração:

```txt
Browser
→ novo app Next (Preview/Homologação)
→ BFF Next
→ legacy.dnd.faysk.dev
→ projeto Vercel legado
→ API/Supabase
```

Fluxo após cutover:

```txt
Browser
→ dnd.faysk.dev
→ novo projeto Next
│
├── páginas modernas
│
├── BFF moderno
│   └── legacy.dnd.faysk.dev
│       └── projeto legado
│
└── contratos legados preservados
    └── external rewrites/proxy
        └── legacy.dnd.faysk.dev
```

---

## 1. Responsabilidade dos domínios

### `dnd.faysk.dev`

Após o cutover será a origem pública principal.

Responsável por:

- Home moderna;
- `/sessoes`;
- páginas modernas de sessão;
- BFF do app web;
- compatibilidade de URLs antigas;
- gateway para rotas legadas que ainda precisam conservar o hostname público histórico.

### `legacy.dnd.faysk.dev`

Permanece apontando para o projeto Vercel atual/legado.

Responsável por:

- API antiga;
- Central Local/Edit;
- jobs/funções antigas;
- integrações;
- documentação/rotas auxiliares antigas;
- crons existentes;
- qualquer contrato que ainda não tenha sido migrado explicitamente.

Essa origem técnica não vira nova navegação pública do jogador. É infraestrutura de coexistência.

---

## 2. Gateway no novo projeto após cutover

O novo projeto deve preservar contratos históricos por external rewrites/proxy para a origem legada.

Vercel suporta rewrites para destinos externos mantendo a URL original no browser.

Exemplos conceituais:

```txt
/api/legacy-passthrough/*
→ legacy.dnd.faysk.dev/...
```

E, para contratos públicos históricos que não tenham implementação local moderna:

```txt
/edit/*
→ legacy.dnd.faysk.dev/edit/*

/central-local/*
→ legacy.dnd.faysk.dev/central-local/*

/terms
→ legacy.dnd.faysk.dev/terms

/privacy
→ legacy.dnd.faysk.dev/privacy

/linked-role
→ legacy.dnd.faysk.dev/linked-role

/docs/api/*
→ legacy.dnd.faysk.dev/docs/api/*
```

As regras finais serão geradas a partir do inventário real antes do cutover.

---

## 3. `/api/*` exige namespace explícito

O novo app também precisará de Route Handlers/BFF próprios.

Portanto não é seguro criar uma regra cega:

```txt
/api/* → legacy
```

se o novo projeto possuir endpoints locais dentro do mesmo namespace.

Decisão:

> endpoints BFF do novo app usarão namespace reservado e explícito.

Nome recomendado:

```txt
/api/web/*
```

Exemplos:

```txt
/api/web/transcript
/api/web/session-download
/api/web/access/revalidate
```

Contratos históricos que continuarem existindo em `/api/*` e não forem implementados localmente serão encaminhados para a origem legada.

A implementação deve garantir precedência inequívoca:

```txt
1. rotas locais modernas conhecidas
2. passthrough legado
```

Não depender de comportamento de roteamento implícito sem teste.

---

## 4. BFF não usa passthrough público

O BFF server-side do app moderno deve chamar diretamente:

```txt
${DND_LEGACY_ORIGIN}/api/...
```

Não deve chamar:

```txt
https://dnd.faysk.dev/api/...
```

nem chamar o endpoint público de passthrough do próprio projeto.

Motivos:

- evita auto-loop;
- reduz hops;
- torna a dependência explícita;
- facilita testes Preview/produção;
- permite mover o domínio principal sem alterar upstream interno.

---

## 5. Crons permanecem no projeto legado

Os crons configurados no projeto atual continuam sendo responsabilidade daquele projeto enquanto a API/pipeline correspondente for legada.

O novo projeto não deve duplicar esses crons na modernização apenas porque passa a possuir o domínio principal.

Duplicação poderia gerar:

- jobs executados duas vezes;
- custos duplicados;
- race conditions;
- efeitos de negócio duplicados.

Migração de cron só ocorrerá em roadmap/fase explicitamente dedicada e com idempotência validada.

---

## 6. Webhooks e integrações existentes

Integrações externas podem já apontar para URLs como:

```txt
https://dnd.faysk.dev/api/...
```

O cutover não pode presumir que todos esses consumidores serão reconfigurados no mesmo instante.

Portanto o gateway do novo projeto deve preservar esses paths por passthrough para `legacy.dnd.faysk.dev` enquanto o contrato permanecer legado.

Isso permite mover o domínio principal sem exigir big-bang de todas as integrações.

---

## 7. Cookies e autenticação

A origem técnica legada não deve receber cookies do novo app por acidente além do que for necessário.

O BFF autentica chamadas à API legada com o access token do usuário resolvido server-side, preservando o contrato Bearer atual.

Cuidados:

- `DND_LEGACY_ORIGIN` é server-only;
- cookies da aplicação moderna não devem ser proxyados indiscriminadamente ao upstream;
- headers sensíveis devem ser allowlisted/construídos explicitamente;
- `Authorization` enviado ao legado deve vir da sessão validada do usuário;
- respostas com `Set-Cookie` do legado não devem ser retransmitidas automaticamente ao browser sem necessidade documentada.

---

## 8. Cache de rewrites externos

Rotas autenticadas e APIs privadas não podem ganhar cache compartilhado por causa do gateway.

Na configuração do passthrough, a implementação deve preservar/desabilitar caching quando necessário e respeitar headers privados do upstream.

Para endpoints sensíveis, a preferência é comportamento conservador:

```txt
sem cache compartilhado
```

até existir prova de que determinado contrato é público/cacheável.

---

## 9. Health checks

Antes de qualquer cutover, devem existir smoke checks independentes:

```txt
legacy origin direta
→ health/API responde

novo domínio público
→ página moderna responde

novo domínio /api legado
→ passthrough responde

novo domínio /edit
→ legado responde

BFF moderno
→ chama legacy origin sem loop
```

A Fase 13 não pode depender apenas de “a Home abriu”.

---

## 10. Sequência operacional

### Antes da integração BFF real

1. criar/associar origem técnica estável ao projeto legado;
2. validar TLS;
3. testar APIs nessa origem;
4. definir `DND_LEGACY_ORIGIN` no projeto novo;
5. testar BFF usando exclusivamente a origem técnica.

### Antes do cutover

1. inventariar novamente todas as rotas do projeto legado;
2. classificar cada uma como `modern-local`, `legacy-passthrough` ou `retirada deliberada`;
3. criar rewrites do gateway;
4. smoke test no hostname de homologação;
5. confirmar crons somente no legado;
6. confirmar integrações externas;
7. preparar rollback.

### Cutover

1. confirmar legacy origin saudável;
2. mover/associar `dnd.faysk.dev` ao projeto novo;
3. executar smoke matrix completa;
4. observar logs dos dois projetos;
5. reverter domínio se contratos críticos falharem.

---

## 11. Rollback

Rollback precisa ser simples:

```txt
mover dnd.faysk.dev de volta ao projeto legado
```

Como `legacy.dnd.faysk.dev` nunca saiu do projeto antigo, o backend legado continua disponível durante todo o processo.

Isso reduz drasticamente o risco de um cutover irreversível.

O novo projeto pode continuar acessível pelo hostname de homologação enquanto o domínio principal volta ao legado.

---

## 12. Alternativas consideradas

### A. BFF chamar `dnd.faysk.dev` durante migração

Rejeitada.

Cria dependência circular no instante do cutover e torna a origem interna dependente do domínio público que está sendo movido.

### B. Mover domínio e migrar todas as APIs/funções ao mesmo tempo

Rejeitada.

É exatamente o big-bang que o roadmap evita.

### C. Manter o projeto legado como gateway e reescrever páginas modernas para o projeto novo

Tecnicamente possível e compatível com estratégia de migração incremental.

Não escolhida como topologia final porque:

- o projeto legado continuaria dono do domínio principal mesmo após modernização do app;
- prolongaria acoplamento do frontend novo à configuração antiga;
- tornaria futura retirada do projeto legado outro cutover relevante.

Pode ser usado como fallback operacional temporário se a execução revelar restrição inesperada.

### D. Alterar todos os webhooks/consumidores externos no dia do cutover

Rejeitada como requisito.

O gateway preserva contratos e permite migração gradual.

---

## 13. Consequências positivas

- elimina risco de self-loop do BFF;
- preserva API/Central Local/integrações no cutover;
- separa domínio público de origem interna;
- rollback do domínio fica simples;
- permite modernizar frontend sem migrar backend simultaneamente;
- mantém crons antigos isolados;
- cria caminho claro para futura remoção gradual do legado.

---

## 14. Custos

- um hostname técnico adicional;
- configuração de DNS/domínio na Vercel;
- necessidade de manter matriz de rotas de passthrough;
- observabilidade em dois projetos;
- atenção a headers/cache/cookies no proxy;
- o projeto legado continua existindo após o cutover do frontend.

Esses custos são deliberados e menores que o risco de um big-bang.

---

## 15. Critério para retirada do gateway legado

Não faz parte deste roadmap remover todos os contratos antigos.

Uma rota só deixa de ser encaminhada ao legado quando:

1. possui implementação moderna equivalente ou foi formalmente aposentada;
2. consumidores foram identificados;
3. testes passam;
4. logs confirmam ausência de tráfego inesperado quando aplicável;
5. rollback existe.

O frontend legado pode ser aposentado antes de todas as APIs auxiliares antigas.

---

## 16. Relação com as fases

### Fase 3

Preparar env/configuração e registrar o hostname técnico; não precisa ainda consumir dados reais.

### Fase 5

BFF de auth/access já deve usar `DND_LEGACY_ORIGIN`.

### Fases 6–8

Todos os adapters usam a origem técnica.

### Fase 11

Paridade inclui contratos legacy-passthrough.

### Fase 12

Homologação testa rotas modernas + contratos legados através do gateway.

### Fase 13

Executa a mudança do domínio e ativa a topologia final.

### Fases 14–15

Monitora e documenta dependências legadas restantes.

---

## 17. Referência de plataforma

A Vercel suporta external rewrites para proxy de caminhos para um domínio externo mantendo a URL original. A configuração exata deve ser revalidada na documentação oficial durante a Fase 13, inclusive comportamento de cache, headers e precedência de rotas.

Este ADR define a topologia; não congela um snippet de `vercel.json` hoje.
