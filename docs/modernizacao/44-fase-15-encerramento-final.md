> **Referência histórica — direção substituída em 2026-09-06.** O [reboot TDA](../reboot/README.md) define o plano vigente. Este documento preserva decisões/evidências do escopo anterior; versões, fases e declarações de conclusão abaixo não certificam o estado do reboot. Revalidar requisitos antes de reutilizá-los.

# Fase 15 — Encerramento final da modernização

Status: **MODERNIZAÇÃO: COMPLETA ✅**  
Data de encerramento: **2026-09-06**

## 1. Declaração final

As Fases 0–15 do roadmap de modernização do DnD Scribe estão encerradas.

O objetivo original foi cumprido: modernizar arquitetura, frontend público, autenticação, UX, segurança, acessibilidade, performance, testes e deploy sem iniciar prematuramente novas features de domínio.

Produção canônica:

```txt
https://dnd.faysk.dev
```

## 2. Topologia final

```txt
dnd.faysk.dev
├── /, /sessoes*, /login, /auth*, /_next/*
│   └── app Next moderno
├── /api/web/*
│   └── BFF Next
├── /edit*, /central-local*
│   └── operação legada preservada no mesmo domínio
└── /api/* restante, jobs, crons e integrações
    └── backend legado preservado
```

A coexistência é deliberada. Modernizar o produto público não exigia reescrever o pipeline operacional, companion local ou todas as APIs legadas.

## 3. Política final de acesso

A memória editorial publicada é pública:

```txt
sessões publicadas → público
resumo completo    → público
```

Material bruto/operacional é privado:

```txt
transcrição             → login + campaign.transcript.read
download da transcrição → login + campaign.transcript.read
revisão de fala         → campaign.transcript.read + campaign.content.edit
```

O painel de permissões administra de forma independente:

- Ver Edit;
- Editar conteúdo;
- Ver transcrições;
- Processar localmente;
- Acessar áudio.

O hardening final dessa política foi concluído no PR #42.

## 4. Marcos finais de produção

### Cutover

PR #41 colocou o frontend Next no fluxo de produção do domínio principal, mantendo as superfícies operacionais legadas disponíveis e o rollback preservado.

### Estabilização de autenticação/Edit

Após o cutover, problemas reais encontrados na homologação foram corrigidos no `main`, incluindo:

- restauração de `/api/auth/me`;
- compartilhamento da sessão SSR do Next com o Edit;
- permanência do Edit em `dnd.faysk.dev`, evitando uma segunda origem de autenticação.

### Permissão individual de transcrição

PR #42:

```txt
final head: df80213c8ad47df156b5226c1eff6aab86a5a50c
merge main: 91fa1f88316d68e421813ad227dac76e6eea83e8
```

A migração de banco criou `campaign.transcript.read` e `transcript_viewer`, com backfill dos membros atuais para preservar compatibilidade antes de permitir revogação individual.

## 5. Gate final de CI

No head final do PR #42, antes do merge:

```txt
CI raiz                  ✅
Companion regression     ✅
TypeScript strict        ✅
ESLint                   ✅
Vitest                   ✅
Next production build    ✅
Client bundle audit      ✅
Bundle inventory         ✅
Playwright multi-browser ✅
```

A matriz E2E cobre:

- Desktop Chromium;
- Desktop Firefox;
- Desktop WebKit;
- Mobile Chromium;
- Mobile WebKit.

## 6. Deployment final verificado

Gateway/root production deployment:

```txt
ID: dpl_2uGjfMAEWF1KpTdQGEbVKALYUjWN
state: READY
target: production
main SHA: 91fa1f88316d68e421813ad227dac76e6eea83e8
alias: dnd.faysk.dev
Node Functions: 12
```

Build confirmado com:

```txt
Node 24.x
pnpm 11.25.0
legacy index omitido no cutover
output publicado com sucesso
```

## 7. Smoke final em produção

Executado contra `dnd.faysk.dev` após o deployment final.

| Superfície | Resultado |
| --- | --- |
| `/` | 200 — Home Next moderna e pública |
| `/sessoes` | 200 — 11 sessões públicas |
| sessão real `rmDsxh640RR4` | memória pública disponível |
| `/login` | 200 — Discord e Google disponíveis |
| transcrição anônima | redireciona para login preservando `next` |
| `/api/library-transcript` sem sessão | 401 |
| `/api/session-download` sem sessão | 401 |
| `/api/web/health` | 200, `ready: true` |
| `/edit/` | 200 |
| `/api/v1/health` | 200 |

`/api/web/health` confirmou:

```json
{
  "ok": true,
  "ready": true,
  "surface": "dnd-scribe-web-next",
  "runtime": {
    "supabaseConfigured": true,
    "legacyOriginConfigured": true
  }
}
```

O Edit em produção retornou a política final:

```txt
Permissions-Policy:
camera=(), geolocation=(), microphone=(), payment=(), usb=(),
local-network=(self), loopback-network=(self)
```

A busca por respostas 5xx no deployment final durante a verificação não encontrou ocorrências.

## 8. Homologação humana

O proprietário do projeto participou diretamente da homologação em produção e confirmou os fluxos críticos durante o cutover:

- navegação do frontend moderno;
- login real;
- reconhecimento da sessão pelo Edit;
- painel de permissões.

Problemas observados nessa homologação foram tratados como regressões de produção e corrigidos antes deste encerramento.

## 9. Encerramento da Fase 14 e exceção à janela padrão

O runbook `42-fase-14-estabilizacao-runbook.md` estabelece **sete dias corridos** como janela padrão de estabilização.

Essa janela não transcorreu integralmente entre o cutover e este documento.

Em **2026-09-06**, o proprietário do projeto solicitou explicitamente levar a modernização ao encerramento de 100%. A janela padrão foi, portanto, **comprimida/dispensada por decisão explícita do proprietário**, com base nas seguintes evidências:

- cutover real já ativo;
- homologação humana em produção;
- problemas de auth/Edit encontrados e corrigidos;
- CI completo verde;
- E2E multi-browser verde;
- deployment final READY;
- smoke final das superfícies críticas verde;
- nenhuma resposta 5xx encontrada no deployment final durante a verificação;
- rollback preservado.

Essa exceção não apaga o runbook nem simula sete dias inexistentes. O monitoramento posterior passa a fazer parte da operação normal do produto e deixa de bloquear a modernização.

## 10. Rollback preservado

O cutover não exigiu apagar o legado nem executar migração destrutiva.

O gateway mantém a coexistência e deployments anteriores continuam disponíveis como referência de rollback. O caminho de retorno permanece operacionalmente possível por reversão do gateway/deployment.

Não foi executado um rollback destrutivo apenas para produzir evidência documental; a reversibilidade foi preservada pelo desenho e pelos artefatos anteriores.

## 11. Dívidas aceitas

Nenhuma das dívidas abaixo bloqueia o encerramento por decisão do proprietário:

1. **Vercel Hobby — 12/12 Node Functions no projeto raiz.** Novos endpoints não devem continuar crescendo um arquivo por Function sem consolidação, mudança de arquitetura ou plano.
2. **CSP completo.** Um CSP com nonce/hash continua como hardening futuro; não foi adicionado um CSP fictício/permissivo apenas para marcar checklist.
3. **Supabase SECURITY DEFINER.** Helpers de autorização existentes merecem revisão de privilégio dedicada, com testes específicos, antes de alterações.
4. **Password protection.** Proteção contra senhas vazadas deve ser ativada/revisitada caso autenticação por senha entre no produto; o fluxo atual é OAuth.
5. **Índices/FKs.** Ajustes de performance de banco devem ser baseados em workload real, não em criação/remoção cega de índices.
6. **Depreciação Node no legado.** Há warning relacionado a `url.parse()` em código legado; não houve falha funcional associada durante a verificação.
7. **Benchmark autenticado formal.** O gate automatizado de bundle/performance e a homologação real foram aceitos como suficientes para o encerramento; benchmark autenticado aprofundado passa a acompanhamento operacional.
8. **Polish editorial.** Conteúdo editorial pode continuar sendo refinado sem reabrir o roadmap técnico de modernização.

## 12. Definition of Done final

- [x] baseline/freeze;
- [x] arquitetura e ADRs;
- [x] Next/React/TypeScript modernos;
- [x] design system;
- [x] dark/light;
- [x] auth SSR real;
- [x] Home moderna;
- [x] arquivo de sessões;
- [x] resumo público;
- [x] transcrição privada;
- [x] permissões explícitas;
- [x] segurança/a11y;
- [x] performance/bundle gates;
- [x] paridade multi-browser;
- [x] homologação real;
- [x] cutover em produção;
- [x] rollback preservado;
- [x] estabilização aceita;
- [x] documentação final;
- [x] **MODERNIZAÇÃO: COMPLETA**.

## 13. Fechamento de escopo

Este roadmap não deve ser reaberto para acomodar novas features.

A partir deste ponto, expansões como Pessoas/NPCs, lore, timeline, relações, galerias, busca global e outras experiências da campanha pertencem a **um novo roadmap de produto**.

```txt
MODERNIZAÇÃO DO DND SCRIBE
0 → 15
100% CONCLUÍDA ✅
```
