# 12 — Inventário de deploy e dependências do legado

Status: **baseline verificado em código**  
Data da auditoria: **2026-09-04**

## Objetivo

Registrar como o app público atual é construído e publicado, quais dependências estão em uso e quais limites de coexistência precisam ser respeitados quando o novo app Next.js nascer.

Este documento existe para evitar um erro específico: modernizar o frontend público e, sem perceber, quebrar Central Local, APIs, crons, integrações ou publicação que compartilham o mesmo repositório/Vercel.

---

## 1. Build atual

No `package.json` da raiz:

```json
{
  "scripts": {
    "build": "node scripts/sync-public.js"
  }
}
```

O build não compila um framework web hoje.

`scripts/sync-public.js` transforma `web/` em conteúdo público para deploy, incluindo cópia de arquivos necessários para `public/` e dependências vendorizadas usadas pela aplicação estática.

Modelo conceitual atual:

```txt
web/
  ↓ npm run build
scripts/sync-public.js
  ↓
public/
  ↓
Vercel static output
```

Consequência:

- `apps/web` não pode simplesmente ser adicionado e assumido como produção;
- o build raiz atual tem responsabilidades além da futura aplicação Next;
- a estratégia de coexistência precisa ser definida antes do bootstrap/deploy de Preview.

---

## 2. Runtime atual

`package.json` declara:

```json
{
  "engines": {
    "node": "24.x"
  }
}
```

A modernização já adotou como política:

- Node LTS mais recente suportado no momento de cada fase;
- sem Current/experimental apenas por novidade;
- upgrades passam por CI antes de produção.

No momento deste baseline, Node 24 já está alinhado com a direção de modernização, portanto não existe necessidade de trocar runtime apenas para “parecer moderno”.

---

## 3. Dependências Node atuais da raiz

Dependências declaradas:

```txt
@supabase/supabase-js  2.111.0
dompurify              3.4.12
marked                 18.0.7
pg                     8.16.3
```

### Papel atual

#### `@supabase/supabase-js`

Usado por:

- auth no browser;
- operações Supabase no servidor quando aplicável;
- Storage/admin em rotas server-side com chave privilegiada.

A modernização preserva Supabase, mas o novo app deverá separar explicitamente:

```txt
browser client
server client
admin/service client
```

Nenhuma chave privilegiada pode migrar para bundle client-side.

#### `marked`

Usado para renderização do Markdown de resumo no frontend legado.

No build atual há cópia vendorizada para o conteúdo estático.

O novo app pode substituir a forma de renderização, desde que mantenha o acervo Markdown e a sanitização.

#### `dompurify`

Usado para sanitizar HTML gerado pelo Markdown no browser legado.

No novo app a sanitização continua requisito, mesmo que a biblioteca ou local de execução mude.

#### `pg`

Usado no backend/API para acesso PostgreSQL direto.

Não é responsabilidade da modernização do player remover `pg` do backend existente.

---

## 4. Dependências carregadas pelo browser legado

`web/index.html` carrega:

```txt
/theme.js
/library.css
Supabase JS 2 via CDN
/vendor/marked.umd.js
/vendor/purify.min.js
/library.js
```

Isso significa que o baseline de performance atual inclui uma aplicação essencialmente estática + JS client-side, e não deve ser comparado ao novo app apenas por número de arquivos gerados.

A comparação correta deve medir experiência e bytes realmente enviados.

---

## 5. Vercel atual

O projeto atual usa Vercel para:

- frontend público;
- APIs serverless;
- rotas operacionais;
- rewrites/redirects;
- crons definidos no projeto.

O `vercel.json` atual declara build/output compatível com o site estático produzido em `public/`.

Pontos críticos existentes:

- `outputDirectory` atual aponta para `public`;
- build atual é `npm run build`;
- existem rewrites para API e integrações;
- existem regras específicas para Central Local/Edit;
- funções em `api/**/*.js` possuem configuração própria;
- `lore-runtime/**` é incluído para funções que dependem desse conteúdo;
- existem crons de produção que não pertencem ao frontend público moderno.

A migração do frontend NÃO autoriza remover essas regras por simplificação.

---

## 6. Central Local / Edit

O mesmo deploy possui rotas operacionais ligadas à Central Local.

Conceitualmente:

```txt
/central-local
/edit
/edit/*
```

são tratados por regras específicas existentes.

Durante a modernização do player:

- Central Local permanece fora do escopo funcional;
- suas rotas precisam continuar funcionando;
- o novo App Router não deve capturar acidentalmente caminhos operacionais;
- qualquer mudança em rewrites precisa de smoke test separado.

---

## 7. API serverless atual

A API principal está concentrada em:

```txt
api/[...path].js
```

além de funções/jobs auxiliares.

Essa API atualmente cobre muito mais do que a biblioteca pública, incluindo partes operacionais e integrações.

Decisão de modernização já registrada:

> não reescrever API e frontend ao mesmo tempo sem necessidade.

Na primeira migração, o novo app pode consumir contratos existentes de leitura enquanto o frontend é substituído.

Mover endpoints para Route Handlers/Server Actions do Next é decisão posterior e deve exigir:

1. contrato documentado;
2. paridade testada;
3. ganho real de complexidade/segurança;
4. rollback simples.

---

## 8. Local-first preservado

A modernização do app público não altera a decisão local-first.

Continuam fora do frontend player:

- ZIP Craig original;
- FLAC por participante;
- modelo Whisper;
- transcrição pesada/local quando aplicável;
- fila de processamento;
- GPU/CPU do operador;
- artefatos regeneráveis pesados.

O app público recebe apenas conteúdo necessário para consulta compartilhada.

Qualquer mudança no deploy web que faça o sistema voltar a depender de upload/processamento pesado em nuvem é regressão arquitetural, não modernização.

---

## 9. Variáveis de ambiente existentes

`.env.example` já separa grupos relevantes.

### App

```txt
NEXT_PUBLIC_APP_NAME
NEXT_PUBLIC_APP_URL
```

A presença desses nomes não significa que o projeto atual já seja Next; eles podem ser reutilizados pela nova aplicação quando fizer sentido.

### Supabase público

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_PUBLISHABLE_KEY
SUPABASE_PROJECT_REF
SUPABASE_JWKS_URL
```

### Supabase privilegiado/server

```txt
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_PASSWORD
DATABASE_URL
DATABASE_POOLER_URL
SUPABASE_POOLER_URL
DATABASE_DIRECT_URL
```

### Outros grupos existentes

- OpenAI/custos;
- Cloudflare R2;
- Vercel;
- GitHub workflows;
- Google OAuth;
- Discord OAuth/bot/webhooks;
- Roll20;
- Cron.

### Regra para `apps/web`

A nova aplicação deve declarar explicitamente quais variáveis ela pode ler.

Especialmente:

```txt
Client Components/browser
→ apenas variáveis públicas necessárias

Server Components/Route Handlers
→ variáveis server-side necessárias

Admin/service credentials
→ nunca serializadas ou importadas por módulo client
```

O fato de uma variável existir no ambiente Vercel do monorepo não autoriza seu uso no frontend.

---

## 10. Risco de migração do output Vercel

Hoje existe uma premissa simples:

```txt
Vercel build
→ public/
```

Next.js possui seu próprio output/build pipeline.

Portanto, antes da Fase 3 é obrigatório decidir como o Preview da nova aplicação coexistirá com o deploy legado.

Opções conceituais a avaliar:

### Opção A — segundo projeto Vercel temporário

```txt
Projeto Vercel atual
→ produção legado

Projeto Vercel novo
→ apps/web Preview/modernização
```

Vantagens:

- isolamento forte;
- não mexe no build de produção durante bootstrap;
- rollback trivial enquanto Preview estiver separado.

Custos:

- variáveis de ambiente duplicadas/controladas;
- configuração de domínio só no cutover;
- APIs existentes precisam ser acessíveis de forma segura pelo Preview.

### Opção B — mesmo projeto com build/rewrite de coexistência

Vantagens:

- menos projetos;
- mesma origem potencial.

Riscos:

- mexer cedo no `vercel.json` atual;
- colisão entre output estático, Next e rotas operacionais;
- maior blast radius.

### Situação documental atual

A opção final ainda não deve ser assumida como implementada.

A recomendação de risco para bootstrap é favorecer isolamento de Preview, mas a decisão precisa virar ADR antes da Fase 3.

---

## 11. Risco de same-origin API

O legado consulta:

```txt
/api/...
```

na mesma origem.

Se o Preview Next estiver em outro projeto/domínio, existem duas estratégias gerais:

1. o Preview chama a API de produção explicitamente;
2. o Preview fornece proxy/bridge server-side controlado para a API existente.

Não deve ser habilitado CORS amplo apenas para facilitar a migração.

Antes do bootstrap, documentar:

- origem do Preview;
- como o token de usuário chega à API;
- quais endpoints podem ser chamados;
- como evitar exposição de credenciais;
- como preservar cookies/sessão se SSR auth for ativado.

---

## 12. Autenticação e migração de sessão

O legado usa access token Supabase no browser e `Authorization: Bearer` para a API.

A arquitetura alvo quer SSR/cookies.

Isso cria duas camadas durante coexistência:

```txt
Nova UI Next
→ sessão SSR/cookie
→ ainda pode precisar apresentar Bearer compatível à API legada
```

Esse bridge deve ser tratado como contrato de migração e removido/refinado apenas quando a API correspondente também evoluir.

Não alterar auth, API e frontend simultaneamente sem testes reais de usuário aprovado e acesso pendente.

---

## 13. `package.json` e workspaces futuros

Hoje a raiz é um único pacote npm operacional.

A arquitetura alvo propõe:

```txt
apps/web
```

com `pnpm`/workspace.

Ao introduzir workspace, preservar scripts operacionais da raiz ou fornecer aliases equivalentes.

Scripts atuais relevantes não podem desaparecer acidentalmente, incluindo famílias como:

```txt
check
check:web
check:api
check:workers
check:roll20
check:monitoring
check:egress
check:summary-api
check:companion
sync:public
smoke:routes
```

A modernização pode reorganizar scripts, mas CI e operação existentes precisam continuar executáveis durante coexistência.

---

## 14. CI atual e futuro

O repositório já possui GitHub Actions para diferentes partes do produto.

A modernização deve adicionar checks do novo app sem substituir checks atuais no primeiro momento.

Estratégia conceitual:

```txt
checks legado/operacionais
+
checks apps/web
```

Checks alvo do novo app:

```txt
install
lint
typecheck
unit tests
build
E2E
visual tests
Preview smoke
```

Só após estabilização pode ser decidido quais checks legados do frontend público deixaram de ter valor.

---

## 15. Regras de dependência durante a modernização

### Permitidas quando necessárias à fase

- Next.js;
- React;
- TypeScript;
- Tailwind;
- integração SSR oficial vigente do Supabase;
- Zod;
- Vitest;
- Playwright;
- tooling de lint/format.

### Explicitamente adiadas

- Tiptap;
- React Flow / XYFlow;
- bibliotecas de grafo;
- editor colaborativo;
- upload avançado de galeria;
- dependências de feature de personagens/NPCs.

Regra:

> dependência sem uso no roadmap atual não entra “para preparar o futuro”.

---

## 16. Política de versões

A documentação não congela patch version por meses.

Na abertura de cada fase de implementação:

1. verificar versão estável/LTS vigente;
2. verificar compatibilidade entre runtime/framework/libs;
3. registrar versões efetivamente instaladas;
4. executar CI;
5. evitar canary/beta/RC em produção;
6. priorizar patches de segurança.

Depois do cutover, adotar automação de atualização controlada, como Renovate ou Dependabot, somente após política definida.

---

## 17. Itens que precisam de ADR antes do bootstrap

- [ ] topologia do Preview Vercel para `apps/web`;
- [ ] estratégia de acesso do Preview às APIs legadas same-origin;
- [ ] integração exata de auth SSR/cookies durante coexistência;
- [ ] estratégia de workspace/pnpm sem quebrar scripts operacionais da raiz.

As três primeiras podem ser consolidadas em um ADR de coexistência/deploy se a decisão for única.

---

## 18. Gate deste inventário

- [x] build estático atual identificado;
- [x] output `public/` identificado;
- [x] runtime atual identificado;
- [x] dependências raiz identificadas;
- [x] browser dependencies identificadas;
- [x] API compartilhada identificada;
- [x] Central Local reconhecida como dependência de deploy a preservar;
- [x] grupos de env identificados;
- [x] riscos de coexistência documentados;
- [x] scripts/checks operacionais reconhecidos;
- [ ] ADR de topologia de Preview/coexistência aprovado.

O último item bloqueia o início oficial da Fase 3, mas não invalida o baseline da Fase 0.
