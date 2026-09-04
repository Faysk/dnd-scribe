# 14 — Topologia de Preview e coexistência na Vercel

Status: **decisão documental aprovada para bootstrap**  
Data: **2026-09-04**

## Objetivo

Definir como o novo app Next.js poderá nascer em `apps/web` sem colocar em risco o deploy atual do DnD Scribe, que hoje compartilha o mesmo projeto Vercel com frontend estático, API serverless, Central Local, rewrites e crons.

Nenhum projeto novo foi criado e nenhuma configuração Vercel foi alterada nesta etapa.

---

## 1. Estado real observado

Team Vercel:

```txt
Nome: DND
Slug: dndscribe
ID: team_r8ASBmnk3arIV9YwBkbqplKE
Plano: hobby
```

Projeto atual:

```txt
Nome: dnd-scribe
ID: prj_f9dVc7yr981wW9TkX0KbjeMrbSUm
Framework: nenhum preset detectado/configurado
Node: 24.x
GitHub: Faysk/dnd-scribe
```

Domínios observados:

```txt
dnd.faysk.dev
dnd-scribe-amber.vercel.app
dnd-scribe-dndscribe.vercel.app
dnd-scribe-git-main-dndscribe.vercel.app
```

A produção e previews de branches já são gerados pelo Git integration atual.

Foi confirmado também que commits da branch de documentação geram Preview Deployments no mesmo projeto, com alias de branch.

---

## 2. Problema de coexistência

Hoje o projeto Vercel raiz assume:

```txt
npm run build
→ scripts/sync-public.js
→ public/
```

O `vercel.json` atual também preserva rotas e funções que não pertencem ao futuro frontend Next.

Se alterarmos diretamente esse projeto para:

```txt
Root Directory = apps/web
Framework = Next.js
```

antes do cutover, o risco é deixar de construir/servir corretamente:

- frontend legado;
- `/api/*` existente;
- Central Local/Edit;
- rewrites;
- crons;
- funções operacionais;
- arquivos/runtime auxiliares.

Portanto o projeto Vercel de produção não deve ser convertido para Next durante o bootstrap.

---

## 3. Decisão

A Fase 3 deve usar **um segundo projeto Vercel temporário para o novo app `apps/web`**, ligado ao mesmo repositório GitHub e configurado com root directory específico para a aplicação Next.

Topologia:

```txt
GitHub: Faysk/dnd-scribe
│
├── Projeto Vercel atual: dnd-scribe
│   ├── root/build legado
│   ├── dnd.faysk.dev
│   ├── API atual
│   ├── Central Local
│   └── produção atual
│
└── Projeto Vercel de modernização
    ├── Root Directory: apps/web
    ├── Next.js
    ├── Preview Deployments
    └── sem domínio de produção principal durante bootstrap
```

Nome sugerido, não criado nesta etapa:

```txt
dnd-scribe-web-next
```

O nome final pode variar sem afetar a decisão arquitetural.

---

## 4. Por que separar projetos

### Blast radius

Bootstrap, mudança de framework e ajustes de build ficam isolados.

### Produção intacta

`dnd.faysk.dev` continua apontando para o produto atual até o cutover aprovado.

### Rollback simples

Enquanto a modernização estiver em Preview, rollback equivale a continuar usando o projeto atual.

### Mesma origem Git

Vercel permite projetos diferentes ligados ao mesmo repositório/monorepo e configuração por root directory.

### CI independente

O novo app pode ganhar seus checks sem precisar remover os checks operacionais atuais.

---

## 5. O que o segundo projeto NÃO fará

Durante bootstrap ele não assumirá:

- `dnd.faysk.dev`;
- crons atuais;
- Central Local;
- workers existentes;
- API operacional inteira;
- armazenamento/processamento local;
- funções Discord/Roll20.

Ele é o ambiente da nova **UI pública dos jogadores**.

---

## 6. Acesso aos dados durante Preview

ADR 008 mantém a API existente como fronteira canônica de dados do player durante a migração.

O Preview Next precisa consumir dados sem ampliar CORS ou expor secrets.

Direção aprovada:

```txt
Browser
  ↓
Next app de Preview
  ↓ server-side
bridge/proxy controlado
  ↓
API existente do dnd.faysk.dev
  ↓
Supabase
```

### Regra

Evitar que componentes client chamem diretamente `https://dnd.faysk.dev/api/...` com uma política CORS aberta.

A chamada preferida parte da camada server do Next.

---

## 7. Auth durante coexistência

O legado aceita `Authorization: Bearer <Supabase access token>`.

O novo app pretende usar auth SSR/cookies.

A coexistência precisa permitir:

```txt
Supabase session no novo app
→ servidor Next obtém/valida sessão
→ extrai/renova token quando necessário
→ chama API legada com Bearer
```

Esse bridge é temporário e deve ser encapsulado em um único serviço de dados, não espalhado pelos componentes.

Exemplo conceitual futuro:

```txt
apps/web/src/lib/dnd-api/
  auth.ts
  sessions.ts
  transcript.ts
```

O formato exato só será implementado na Fase 5.

---

## 8. Variáveis de ambiente do projeto novo

Copiar somente o conjunto necessário.

### Permitidas no app Next conforme necessidade

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL
```

E variáveis server-only específicas para bridge, se realmente necessárias.

### Não copiar por padrão

- service role;
- DB password;
- R2 secrets;
- OpenAI secret;
- Discord bot token;
- Roll20 secrets;
- cron secret;
- credenciais operacionais sem uso no app público.

Regra:

> um segredo só entra no novo projeto Vercel quando existir código server-side aprovado que precise dele.

---

## 9. Domínios

### Durante desenvolvimento

Usar domínio Preview gerado pela Vercel.

### Durante homologação

Opcionalmente usar um subdomínio explícito, por exemplo:

```txt
next.dnd.faysk.dev
```

Isso só deve ser configurado se facilitar testes da mesa e OAuth.

### Produção

`dnd.faysk.dev` só muda de destino na Fase 13 — Cutover.

---

## 10. OAuth redirect URLs

Um segundo domínio de Preview cria implicação em OAuth.

Antes de autenticação real da Fase 5, registrar/validar no Supabase os redirect URLs necessários para:

- Preview estável de homologação, se usado;
- localhost;
- produção atual;
- futura produção Next.

Não é recomendável cadastrar redirects arbitrários e amplos sem necessidade.

Para previews efêmeros, preferir fluxo controlado/documentado e verificar as capacidades atuais do Supabase antes de abrir wildcard.

---

## 11. Git e branches

O projeto atual já gera preview para branches.

O projeto Next separado também poderá acompanhar branches do mesmo repositório.

Estratégia sugerida:

```txt
main
→ produção legado até cutover
→ Preview/production policy do novo projeto controlada

feat/modernizacao-*
→ Preview novo app
```

A existência de deploy do novo projeto não significa promoção automática para `dnd.faysk.dev`.

---

## 12. PRs de documentação já demonstraram o fluxo

A infraestrutura atual criou Preview Deployments para commits da branch `docs/modernizacao-roadmap` e produção para o merge em `main`.

Isso valida que o Git integration está operacional.

Também foi observado que o PR #19 foi posteriormente mergeado em `main`; commits documentais adicionais feitos após esse merge precisam de um novo PR para entrar no branch principal.

---

## 13. Plano de criação do projeto Next

A criação efetiva pertence à Fase 3 e deve ocorrer somente após o gate mínimo.

Checklist operacional futuro:

1. `apps/web` existe e builda localmente;
2. criar segundo projeto Vercel no team `DND`;
3. ligar ao repo `Faysk/dnd-scribe`;
4. configurar Root Directory `apps/web`;
5. framework Next.js;
6. Node LTS compatível;
7. copiar apenas env necessário;
8. gerar Preview;
9. executar smoke sem auth;
10. depois integrar auth/bridge nas fases previstas.

Nenhum passo acima foi executado durante esta documentação.

---

## 14. Estratégia de cutover futura

A topologia separada reduz risco, mas a decisão final de produção ainda precisa ser tomada na Fase 13.

Caminhos possíveis:

### Promover o projeto Next e mover o domínio

```txt
dnd.faysk.dev
→ projeto Next
```

mantendo serviços legados em outro hostname/projeto conforme necessário.

### Consolidar depois

Somente se houver benefício e após separar claramente frontend e serviços.

A modernização não deve assumir hoje que todo o projeto Vercel atual será deletado no cutover.

---

## 15. Rollback

Antes do domínio principal ser movido:

```txt
rollback = continuar usando produção atual
```

Depois do cutover:

- manter projeto legado intacto pelo período de estabilização;
- documentar aliases/domínios anteriores;
- ter deployment legado READY conhecido;
- permitir apontar o domínio de volta caso exista regressão crítica.

O deployment de produção atual observado deve ser registrado no momento do cutover novamente, pois o ID muda ao longo do tempo.

---

## 16. Requisitos de segurança

- não abrir CORS global para viabilizar Preview;
- não copiar secrets indiscriminadamente;
- auth do Preview continua exigindo membership da campanha;
- conteúdo privado não deve virar cache público;
- chamadas ao backend legado devem usar HTTPS;
- cookies devem usar configurações seguras adequadas ao ambiente;
- logs do Preview não devem imprimir token de sessão.

---

## 17. Critério de revisão desta decisão

Reavaliar se:

- Vercel mudar significativamente suporte/limites de monorepo;
- o plano atual impedir o segundo projeto necessário;
- a API for extraída para serviço independente antes da Fase 3;
- houver custo operacional inesperado.

Até lá, isolamento por segundo projeto é a topologia preferida.

---

## 18. Gate

- [x] projeto Vercel real auditado;
- [x] team auditado;
- [x] domínios atuais registrados;
- [x] Preview de branch atual confirmado;
- [x] produção atual confirmada separadamente de previews;
- [x] risco de converter projeto atual documentado;
- [x] segundo projeto como estratégia de isolamento definido;
- [x] fronteira de dados alinhada ao ADR 008;
- [x] regra de env/secrets definida;
- [ ] projeto Next criado — Fase 3;
- [ ] Preview Next validado — Fase 3.

Os itens pendentes são implementação, não pendência desta decisão documental.
