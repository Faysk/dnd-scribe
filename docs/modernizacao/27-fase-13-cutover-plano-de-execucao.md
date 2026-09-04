# 27 — Fase 13: plano de execução do Cutover

Status: **pré-planejado; execução depende da Fase 12 concluída**

## Objetivo

Transferir `dnd.faysk.dev` do projeto Vercel legado para o novo projeto Next de forma controlada, reversível e sem interromper os contratos legados que continuam fora do escopo da modernização.

Esta é a fase de maior risco operacional do roadmap.

A regra central é:

> mudar o dono do frontend público sem obrigar uma migração simultânea de API, Central Local, integrações, jobs e crons.

A topologia é definida pelo ADR 012.

---

## 1. Estado esperado antes do cutover

```txt
Projeto legado
├── dnd.faysk.dev              # ainda em produção
├── legacy.dnd.faysk.dev       # origem técnica estável
├── API antiga
├── Central Local/Edit
├── integrações/jobs
└── crons

Projeto Next
├── hostname de homologação
├── app público moderno completo
├── /api/web/* BFF moderno
├── gateway/passthrough testado
└── release candidate aprovado
```

A Fase 13 move somente o domínio público principal.

---

## 2. Pré-condições absolutas

Não iniciar se qualquer item abaixo estiver vermelho:

```txt
Fase 11 paridade = 100% obrigatória
Fase 12 homologação = aprovada
critical/high bugs = 0
release candidate fixo
CI moderno verde
CI legado verde
legacy origin saudável
gateway homologado
OAuth no domínio final preparado
rollback ensaiado
observabilidade dos dois projetos acessível
```

Não usar cutover para validar pela primeira vez uma configuração crítica.

---

## 3. Congelamento de mudanças

Antes da janela:

- congelar merges não relacionados;
- não atualizar dependências;
- não publicar feature;
- não fazer migration de banco;
- não alterar RLS;
- não mexer em crons;
- não alterar integrações externas salvo configuração necessária e já testada para o cutover.

Objetivo: reduzir variáveis.

---

## 4. Release candidate

Registrar:

```txt
commit SHA
build/deployment ID
Preview/Homolog URL
Node version
Next version
React version
TypeScript version
lockfile hash quando útil
```

O deploy que recebe produção precisa corresponder ao candidato homologado.

Se houver commit novo depois da homologação, o candidato anterior deixa de ser válido até reteste proporcional ao risco.

---

## 5. Inventário de rotas do legado

Antes da janela, repetir inventário real do projeto atual.

O baseline conhecido inclui pelo menos:

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

Além de APIs de:

- summaries;
- integrations/API keys;
- Roll20;
- lore;
- jobs;
- Discord interactions;
- pipeline recovery;
- companion release;
- outras rotas presentes no `vercel.json`/functions atuais.

Não depender apenas desta lista documental antiga: comparar com `main` e configuração Vercel no dia do cutover.

---

## 6. Classificação de rotas

Criar matriz final:

| Path/padrão | Classe | Destino após cutover | Smoke |
| --- | --- | --- | --- |
| `/` | modern-local | Next | obrigatório |
| `/sessoes*` | modern-local | Next | obrigatório |
| `/auth/*` | modern-local | Next | obrigatório |
| `/api/web/*` | modern-local | Next BFF | obrigatório |
| `/api/*` restante | legacy-passthrough | legacy origin | obrigatório por amostra crítica |
| `/edit*` | legacy-passthrough | legacy origin | obrigatório |
| `/central-local*` | legacy-passthrough | legacy origin | obrigatório |
| `/terms` | legacy-passthrough | legacy origin | obrigatório |
| `/privacy` | legacy-passthrough | legacy origin | obrigatório |
| `/linked-role` | legacy-passthrough | legacy origin | obrigatório |
| `/docs/api*` | legacy-passthrough | legacy origin | obrigatório |

Qualquer path sem classe precisa ser resolvido antes do cutover.

---

## 7. Gateway externo

Vercel suporta rewrites para destinos externos, mantendo a URL pública no browser.

A configuração final precisa garantir semanticamente:

```txt
rotas modernas locais
→ novo projeto

rotas antigas ainda não migradas
→ https://legacy.dnd.faysk.dev/...
```

### Namespace reservado

Rotas BFF modernas:

```txt
/api/web/*
```

precisam continuar locais.

O passthrough de `/api/*` não pode engolir esse namespace.

### Teste de precedência

Antes do cutover, testar explicitamente:

```txt
/api/web/teste conhecido
→ função Next local

/api/auth-config ou contrato legado conhecido
→ projeto legado
```

Não assumir precedência pela leitura do arquivo; comprovar no deployment de homologação.

---

## 8. Cache no gateway

Para APIs/rotas privadas legadas:

```txt
shared rewrite caching = desabilitado/conservador
```

Revalidar configuração Vercel vigente.

Não permitir que o gateway transforme:

```txt
private, user-specific
```

em cache compartilhado.

Rotas estáticas auxiliares podem seguir headers do upstream se seguros.

---

## 9. Headers no gateway

Revisar:

- `Authorization`;
- cookies;
- `Set-Cookie`;
- host/origin;
- cache headers;
- Content-Type;
- CORS;
- Permissions-Policy em `/edit`/Central Local;
- headers necessários para local-network/loopback behavior existente.

O novo gateway precisa preservar os headers especiais que hoje permitem a Central Local funcionar.

Não deixar essa validação para depois do domínio mover.

---

## 10. Legacy origin

Antes da janela:

```txt
https://legacy.dnd.faysk.dev
```

ou hostname final equivalente deve possuir:

- DNS resolvendo;
- TLS válido;
- deployment legado correto;
- API respondendo;
- Edit/Central Local respondendo;
- nenhum redirect automático para `dnd.faysk.dev` que cause loop.

### Smoke direto

Testar diretamente na origem técnica:

```txt
/auth-config ou health não sensível
API autenticada de leitura
/edit ou health equivalente
```

---

## 11. BFF antes do domínio mover

Confirmar via logs/configuração que todas as chamadas server-side modernas usam:

```txt
DND_LEGACY_ORIGIN
```

Nunca:

```txt
https://dnd.faysk.dev
```

### Teste anti-loop

No hostname de homologação:

- BFF chama origem legada;
- resposta retorna uma vez;
- logs não mostram requisições recursivas;
- trace/header de debug seguro pode comprovar upstream em homologação.

---

## 12. OAuth e domínio final

Antes de mover o domínio, preparar redirect/callback permitido para:

```txt
https://dnd.faysk.dev/auth/callback
```

Sem remover ainda o callback do legado/homologação que possa ser necessário para rollback.

Validar providers:

- Discord;
- Google.

### Rollback de OAuth

Se o domínio voltar ao projeto legado, os redirects antigos precisam continuar válidos durante a janela de estabilização.

Não remover configurações antigas no mesmo minuto do cutover.

---

## 13. Cookies no domínio final

Validar após promoção/movimento:

- Secure;
- SameSite;
- Path;
- Domain;
- sessão persistida;
- logout;
- refresh.

Sessões do legado e do novo app podem não ser compatíveis.

É aceitável exigir novo login no primeiro acesso após cutover se isso for consequência segura/documentada, mas não deve ser surpresa operacional.

Preferência: testar previamente comportamento real dos cookies no hostname final quando a plataforma permitir.

---

## 14. Imagens e hosts remotos

Antes da janela:

- `remotePatterns` finais;
- URLs Supabase/storage;
- covers/hero da sessão mais recente;
- sessão antiga;
- avatar.

Após cutover, confirmar que a mudança de domínio não altera política de imagem/CSP.

---

## 15. Crons

Crons permanecem no projeto legado.

Checklist:

```txt
crons legado ativos ✅
crons não duplicados no projeto novo ✅
paths upstream continuam respondendo na legacy origin ✅
nenhum cron depende exclusivamente do domínio público movido sem passthrough ✅
```

Se um cron atual chama `dnd.faysk.dev/...`, o gateway deve preservar o contrato ou a configuração precisa ser alterada e testada antes.

---

## 16. Webhooks e integrações externas

Inventariar consumidores externos conhecidos de:

```txt
https://dnd.faysk.dev/api/...
```

Exemplos potenciais do projeto atual:

- Discord interactions;
- Roll20;
- integrations API;
- companion;
- tooling externo.

O gateway deve manter paths antigos funcionando.

Quando possível, disparar teste não destrutivo antes/depois do cutover.

---

## 17. Backups

Como esta modernização não deve exigir migration destrutiva de banco no cutover, backup é defesa adicional, não mecanismo principal.

Antes da janela:

- confirmar estado/backup aplicável do Supabase;
- registrar commit do legado;
- registrar deployment legado atual;
- registrar configurações de domínio/gateway relevantes;
- guardar matriz de env sem valores secretos.

Não copiar secrets para documentação.

---

## 18. Observabilidade

Abrir antes da janela:

```txt
logs projeto Next
logs projeto legado
Vercel deployment status
Supabase logs/health quando necessário
```

Ter filtros preparados para:

- 5xx;
- 401/403 inesperados;
- `/api/web/*`;
- legacy passthrough;
- auth callback;
- transcript;
- image errors.

---

## 19. Janela de mudança

Escolher período em que:

- responsável está disponível;
- há tempo para smoke + rollback;
- não ocorre sessão crítica imediatamente sem margem;
- serviços externos podem ser observados.

Não fazer cutover minutos antes da mesa começar só porque “parece rápido”. 😂

---

## 20. Passo a passo do cutover

### Etapa A — confirmar legado

```txt
legacy origin health ✅
produção atual health ✅
crons/integrations sem alerta ✅
```

### Etapa B — confirmar novo candidato

```txt
release candidate deployment READY ✅
CI ✅
Home homologada ✅
BFF via legacy origin ✅
gateway no candidato ✅
```

### Etapa C — mover/associar domínio

Mover `dnd.faysk.dev` para o novo projeto usando mecanismo vigente da Vercel.

Registrar horário exato.

### Etapa D — smoke imediato

Executar a matriz da seção 21.

### Etapa E — observar

Monitorar logs e erros por janela intensiva inicial.

### Etapa F — decisão

```txt
saudável → manter e entrar em estabilização
blocker → rollback
```

---

## 21. Smoke matrix imediata

Ordem recomendada:

1. `GET /` sem sessão → login/fluxo esperado;
2. login real;
3. Home autenticada;
4. `/sessoes`;
5. sessão recente → resumo;
6. transcrição;
7. busca conhecida;
8. speaker filter;
9. download `.md`;
10. theme toggle;
11. logout/login novamente;
12. link antigo `/#/sessao/:id`;
13. link antigo `/#/sessao/:id/resumo`;
14. `/api/auth-config` legado via gateway;
15. API legada autenticada representativa via gateway;
16. `/edit`/Central Local;
17. `/terms`;
18. `/privacy`;
19. `/docs/api`;
20. integração externa crítica não destrutiva;
21. mobile fluxo essencial.

Registrar status e duração aproximada.

---

## 22. Critérios de rollback imediato

Rollback é preferível a hotfix apressado quando houver:

- login quebrado;
- campanha inacessível;
- dados de usuário/campanha errados;
- falha de autorização;
- segredo exposto;
- BFF em loop;
- `/api/*` crítico quebrado;
- Discord/webhook crítico quebrado;
- Central Local inacessível quando operacionalmente necessária;
- transcrição essencialmente inutilizável;
- regressão severa em mobile;
- 5xx persistente sem causa simples e segura.

---

## 23. Rollback operacional

Conforme ADR 012, o caminho principal é:

```txt
mover dnd.faysk.dev de volta ao projeto legado
```

A origem:

```txt
legacy.dnd.faysk.dev
```

continua no projeto antigo durante todo o processo.

### Após rollback

Executar smoke do legado:

- Home antiga;
- login;
- sessão;
- transcrição;
- `/api/*`;
- `/edit`;
- integrações críticas.

O projeto Next permanece disponível no hostname de homologação para investigação.

---

## 24. O que NÃO fazer durante incidente

- alterar banco sem diagnóstico;
- desabilitar auth;
- abrir CORS global;
- colocar service role no browser;
- remover validação;
- apontar BFF ao próprio domínio para “testar”;
- editar múltiplas configs simultaneamente sem registro;
- insistir no novo deploy quando rollback é mais seguro.

---

## 25. Compatibilidade de hash

ADR 011 precisa estar ativo no domínio final.

Verificar diretamente após cutover.

Não remover a bridge na Fase 13.

---

## 26. SEO/robots/cache

Mesmo sendo app autenticado, revisar:

- metadata;
- robots behavior se aplicável;
- cache de páginas privadas;
- CDN;
- stale assets.

Evitar que páginas privadas passem a ser publicamente indexáveis por mudança de arquitetura.

---

## 27. DNS e propagação

Usar mecanismo recomendado pela Vercel para mover/associar domínio.

Registrar:

- estado anterior;
- estado novo;
- horário;
- eventuais TTL/propagações relevantes.

Não presumir troca instantânea em todos os resolvers se DNS externo estiver envolvido.

---

## 28. Comunicação

Para um projeto pequeno, comunicação pode ser simples, mas deve existir.

Antes:

```txt
janela de atualização
possível novo login
```

Após sucesso:

```txt
novo app em produção
como reportar problema
```

Após rollback:

```txt
legado restaurado
nenhuma ação necessária pelo usuário
```

Não anunciar features que não fazem parte da modernização.

---

## 29. Evidência do cutover

Criar registro com:

```txt
data/hora
responsável
commit/deployment novo
deployment legado
legacy origin
mudança de domínio
smoke results
logs/erros observados
rollback necessário? sim/não
issues abertas
```

Sem secrets.

---

## 30. Gate de saída

A Fase 13 termina quando:

```txt
dnd.faysk.dev → projeto Next ✅
legacy.dnd.faysk.dev → projeto legado ✅
Home moderna produção ✅
auth produção ✅
/sessoes ✅
resumo ✅
transcrição ✅
busca/filtro/download ✅
legacy hash bridge ✅
/api legado via gateway ✅
/edit/central-local via gateway ✅
rotas auxiliares legadas ✅
webhooks/integrations críticos ✅
crons somente legado ✅
sem BFF loop ✅
logs saudáveis ✅
rollback continua disponível ✅
smoke documentado ✅
```

A aplicação nova está então em produção, mas a modernização ainda **não terminou**.

---

## 31. Próxima fase

Imediatamente após sucesso:

```txt
Fase 14 — Estabilização
```

O feature freeze permanece ativo.