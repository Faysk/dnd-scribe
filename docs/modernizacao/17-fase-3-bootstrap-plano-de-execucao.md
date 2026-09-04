# 17 — Fase 3: plano de execução do bootstrap

Status: **pré-planejado; execução bloqueada até Fase 0 concluída**  
Dependência: **issue #21 fechado**

## Objetivo

Deixar o bootstrap do novo app público completamente especificado antes de escrever código, sem considerar a Fase 3 iniciada antes do gate da Fase 0.

Este documento é um plano de execução, não autorização para criar `apps/web` agora.

---

## 1. Snapshot tecnológico em 2026-09-04

Referência para o bootstrap, sujeita a revalidação no dia da execução:

| Tecnologia | Linha aprovada para validação |
| --- | --- |
| Node.js | 24 LTS |
| Next.js | 16.3.x Active LTS, com patch de segurança mais recente |
| React | 19.2.x |
| TypeScript | 7.0.x, condicionado a build/CI verde com a versão de Next escolhida |
| Tailwind CSS | 4.3.x |
| pnpm | última versão estável compatível com Node 24 |
| Supabase JS | última versão estável compatível com a API existente |
| `@supabase/ssr` | última versão estável vigente |
| Zod | última versão estável |
| Vitest | última versão estável compatível |
| Playwright | última versão estável compatível |

Política:

1. não usar `canary`, beta ou RC no bootstrap;
2. aplicar patch de segurança mais recente da linha escolhida;
3. não subir major só para dizer que está mais novo se o ecossistema alvo ainda não estiver compatível;
4. registrar as versões efetivamente instaladas no relatório da Fase 3;
5. CI e `next build` são o teste final de compatibilidade.

### Gate especial do TypeScript 7

TypeScript 7 está estável, mas a adoção no DnD Scribe deve passar por:

```txt
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Se houver incompatibilidade real atribuível ao framework/plugin e não ao código do projeto, usar temporariamente a versão estável mais recente oficialmente compatível e abrir ADR explicando a exceção. Não desativar typecheck para forçar a versão.

---

## 2. Estado do repositório que precisa ser preservado

O root atual não é um workspace moderno; ele também não é descartável.

Hoje o root possui scripts de produção como:

```txt
npm run build
npm run check
npm run check:web
npm run check:api
npm run check:workers
npm run check:monitoring
npm run check:egress
npm run check:companion
npm run check:roll20
npm run check:summary-api
```

O `build` atual executa `scripts/sync-public.js` e a Vercel de produção publica `public/`.

Consequência:

> converter o root para pnpm/workspace não pode quebrar o build legado ou mudar silenciosamente os scripts usados por produção.

---

## 3. Estratégia de workspace

Estrutura alvo inicial:

```txt
dnd-scribe/
├── apps/
│   └── web/
│       ├── app/
│       ├── components/
│       ├── features/
│       ├── lib/
│       ├── public/
│       ├── styles/
│       ├── tests/
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.ts
│       └── ...
├── api/
├── lib/
├── local-companion/
├── scripts/
├── tools/
├── web/                  # legado preservado
├── public/               # output do legado preservado
├── package.json          # scripts atuais preservados
└── pnpm-workspace.yaml
```

### Regra inicial

Não mover `api/`, `lib/`, `web/`, `local-companion/` ou scripts existentes na Fase 3.

O primeiro objetivo é **adicionar** `apps/web`, não reorganizar todo o monorepo.

---

## 4. Package manager sem quebrar produção

### Passo 1

Adicionar `pnpm-workspace.yaml` incluindo inicialmente apenas:

```yaml
packages:
  - 'apps/*'
```

### Passo 2

Manter o `package.json` root funcional com npm durante coexistência, a menos que a troca completa seja comprovadamente segura.

Isto significa que, no início, é aceitável:

```txt
produção legado → npm
apps/web → pnpm
```

O objetivo do roadmap não é padronizar cada ferramenta do repositório a qualquer custo.

### Passo 3

Depois de `apps/web` estável, avaliar se o root passa a ser gerenciado por pnpm sem alterar comportamento. Essa decisão pode ocorrer depois da Fase 3.

---

## 5. Criação do `apps/web`

Quando o gate liberar:

1. criar diretório `apps/web`;
2. inicializar Next com App Router;
3. habilitar TypeScript;
4. habilitar Tailwind;
5. evitar conteúdo/template visual padrão desnecessário;
6. remover assets demo do scaffold;
7. configurar `src/` apenas se houver decisão explícita — a estrutura documentada usa `app/` diretamente;
8. não instalar Tiptap, XYFlow ou dependências futuras.

### Estrutura mínima esperada

```txt
apps/web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   └── ui/
├── features/
│   ├── auth/
│   ├── sessions/
│   └── transcript/
├── lib/
│   ├── api/
│   ├── auth/
│   ├── env/
│   ├── supabase/
│   └── validation/
├── public/
├── tests/
├── next.config.ts
├── package.json
├── tsconfig.json
├── eslint.config.*
├── playwright.config.*
└── vitest.config.*
```

Diretórios vazios não precisam ser criados apenas para satisfazer o desenho. Criar quando houver primeiro arquivo real.

---

## 6. TypeScript

Requisitos de bootstrap:

```txt
strict = true
noEmit = true
```

Não permitir no build:

- `ignoreBuildErrors`;
- configuração equivalente que transforme erro de tipo em warning;
- `any` global como solução de migração;
- `@ts-ignore` sem justificativa localizada.

### Tipos de domínio da Fase 3

Criar somente tipos necessários para infraestrutura, por exemplo:

```txt
AuthSession
ApiError
CampaignAccess
RuntimeEnv
```

Não antecipar tipos de NPC, Lore, Relation etc.

---

## 7. Variáveis de ambiente

O novo app deve separar claramente:

### Expostas ao browser

Apenas valores realmente públicos, com prefixo apropriado do framework.

### Server-only

- URL/base da API legada quando necessário;
- secrets de sessão/integração, se algum for introduzido;
- qualquer chave privilegiada.

### Regra

`SUPABASE_SERVICE_ROLE_KEY` ou equivalente privilegiado nunca entra em client bundle.

Criar validação de env server-side e client-side separadas.

Nenhum `.env` real entra no Git.

---

## 8. BFF e API legada

A Fase 3 não migra os endpoints da biblioteca.

Fronteira:

```txt
Browser
→ Next
→ adapter/BFF server-side
→ https://dnd.faysk.dev/api/*
```

Endpoints iniciais a suportar posteriormente:

```txt
/api/auth-config
/api/auth/me
/api/library-sessions
/api/library-summary
/api/library-transcript
/api/session-download
```

### No bootstrap

Não é necessário integrar todos os endpoints ainda.

É suficiente estruturar:

```txt
lib/api/client-server.ts
lib/api/contracts.ts
```

sem duplicar domínio ou chamadas reais antes das fases correspondentes.

---

## 9. Auth

A implementação real de login pertence à Fase 5.

Na Fase 3 somente preparar:

- dependências oficiais de Supabase necessárias;
- estrutura `lib/supabase/server.ts` e `client.ts` apenas se houver uso real de bootstrap;
- documentação de callback/redirect para o novo hostname de Preview;
- variáveis necessárias no projeto Vercel separado.

Não mexer nas configurações OAuth de produção antes do Preview existir.

---

## 10. Tailwind e CSS

Tailwind entra como ferramenta de composição.

A Fase 3 não tenta recriar a Home.

Criar apenas:

- `globals.css` mínimo;
- reset/base do framework;
- estrutura para tokens semânticos;
- nenhuma paleta genérica substituindo a identidade atual.

A implementação completa de tokens dark/light começa na Fase 4.

---

## 11. Qualidade desde o primeiro commit

Scripts mínimos em `apps/web/package.json`:

```txt
dev
build
start
lint
typecheck
test
test:e2e
```

Gate local:

```txt
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Playwright pode começar com um smoke test simples do shell de bootstrap. Não precisa testar features que ainda não existem.

---

## 12. CI da Fase 3

Workflow separado do legado inicialmente.

Pipeline:

```txt
checkout
→ setup Node 24 LTS
→ setup pnpm
→ install apps/web
→ typecheck
→ lint
→ unit tests
→ build
→ smoke/e2e mínimo
```

O CI existente do legado continua rodando.

A nova pipeline não substitui `npm run check` do root nesta fase.

---

## 13. Vercel — segundo projeto

Conforme ADR 009:

```txt
Projeto atual:
  dnd-scribe
  dnd.faysk.dev
  legado + API + Central Local

Novo projeto:
  dnd-scribe-web-next (nome final pode variar)
  Root Directory = apps/web
  Preview/Homologação
```

### Requisitos antes do primeiro deploy

- Root Directory correto;
- Node 24 LTS;
- framework detectado como Next.js;
- variáveis mínimas configuradas;
- nenhum domínio de produção associado;
- Git branch/PR Preview habilitado;
- proteção de Preview definida conforme necessidade da equipe.

### Proibição

Não apontar `dnd.faysk.dev` para o projeto novo na Fase 3.

---

## 14. Primeiro conteúdo do app

O bootstrap deve renderizar somente um shell neutro de verificação, algo equivalente a:

```txt
DnD Scribe
Modernização — Preview técnico
```

Isso não é a nova Home e não deve virar design definitivo.

Objetivo:

- confirmar build;
- confirmar App Router;
- confirmar CSS;
- confirmar deploy;
- confirmar CI.

---

## 15. O que NÃO fazer na Fase 3

- migrar Home;
- migrar login;
- migrar sessão;
- migrar transcrição;
- criar API nova;
- mover banco;
- alterar RLS;
- remover frontend legado;
- mexer em `dnd.faysk.dev`;
- criar Pessoas/Mundo/Lore;
- instalar Tiptap;
- instalar XYFlow;
- redesenhar componentes.

---

## 16. Gate de saída

A Fase 3 termina somente quando:

```txt
install ✅
typecheck ✅
lint ✅
test ✅
build ✅
e2e smoke ✅
Preview Vercel separado ✅
produção legado intacta ✅
CI legado intacto ✅
```

E houver documentação registrando:

- versões efetivamente instaladas;
- branch/PR;
- deployment Preview;
- scripts;
- resultado dos checks;
- problemas encontrados;
- rollback (remoção de `apps/web`/novo projeto sem tocar em produção).

---

## 17. Próxima fase

Somente após o gate acima:

```txt
Fase 4 — Design System
```

É nela que a identidade visual atual passa a ser reconstruída em componentes e tokens modernos.
