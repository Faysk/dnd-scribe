# 31 — Execução da Fase 3 — Bootstrap

Status: **EM EXECUÇÃO**  
Data de início: **2026-09-04**  
Branch: `modernizacao/fase-3-bootstrap`  
PR: **#25**

## Objetivo

Criar a nova fundação do app público em paralelo ao legado, sem migrar ainda Home, auth, sessões ou transcrição e sem tocar na produção atual.

## Implementado

```txt
pnpm-workspace.yaml
apps/web/
.github/workflows/web-next-ci.yml
```

O `apps/web` contém:

- Next.js App Router;
- React;
- TypeScript strict;
- Tailwind CSS 4 via PostCSS;
- shell técnico de Preview;
- Vitest;
- Playwright;
- ESLint;
- CI isolado.

O root legado permanece usando npm e os scripts existentes. `web/`, `api/`, `lib/`, Central Local, workers e pipeline não foram movidos.

## Stack efetivamente validada em CI

| Tecnologia | Versão |
| --- | --- |
| Node.js | 24.20.0 no GitHub Actions |
| pnpm | 11.25.0 |
| Next.js | 16.3.3 |
| React | 19.2.7 |
| TypeScript | 6.0.3 |
| Tailwind CSS | 4.3.0 |
| Vitest | 5.0.0 |
| Playwright | 1.62.1 |

### TypeScript 7

A primeira tentativa usou TypeScript 7.0.2.

Resultado:

```txt
tsc --noEmit ✅
ESLint        ❌
```

A falha não estava no código do DnD Scribe. `typescript-eslint@8.69.0`, usado pelo `eslint-config-next@16.3.3`, informou explicitamente que ainda não suporta TS 7.0.

ADR 013 define TypeScript 6.0.3 como bridge temporária, sem desativar lint ou typecheck.

## pnpm 11 e scripts de build

O primeiro install falhou porque pnpm 11 detectou o script de build de `unrs-resolver@1.12.2` como não aprovado.

A decisão foi explícita:

```yaml
allowBuilds:
  unrs-resolver: false
```

O bootstrap não precisa executar esse postinstall. Após a configuração, a instalação passou sem aprovar execução arbitrária de script.

## CI do novo app

Workflow de referência:

```txt
Web Next CI — run 33899799630
```

Resultado:

```txt
Install workspace dependencies ✅
Typecheck                     ✅
Lint                          ✅
Unit tests                    ✅
Next build                    ✅
Playwright Chromium install   ✅
E2E smoke                     ✅
Lockfile artifact             ✅
```

O E2E valida que o App Router sobe e renderiza:

```txt
Modernização — Preview técnico
Fase 3 · bootstrap em validação
```

## Regressão do legado

O workflow legado também passou no mesmo PR:

```txt
App checks                 ✅
Companion regression tests ✅
Python syntax              ✅
```

Portanto, o bootstrap não quebrou o build público atual nem os checks operacionais existentes.

## Lockfile

O CI produziu um `pnpm-lock.yaml` reproduzível e o preservou como artifact `web-next-pnpm-lock`.

Pendência antes do gate final:

1. persistir o lockfile no repositório;
2. mudar CI de `--no-frozen-lockfile` para `--frozen-lockfile`;
3. rodar o gate novamente.

## Vercel

A integração Vercel atual do repositório continuou verde, mas ainda aponta ao projeto legado `dnd-scribe`.

Inventário confirmado durante a execução:

```txt
Team: DND / dndscribe

Projetos:
- dnd-scribe
- caos
```

Ainda **não existe** o segundo projeto Vercel planejado para `apps/web`.

O gate da Fase 3 exige um projeto separado, com Root Directory `apps/web`, antes de considerar o bootstrap encerrado.

A integração disponível nesta execução permite consultar projetos/deploys, mas não expõe criação de projeto; portanto esse passo permanece como ação externa de infraestrutura, sem alterar `dnd.faysk.dev`.

## Origem legada

ADR 012 continua vigente.

Antes do primeiro BFF real da Fase 5 deve existir uma origem estável equivalente a:

```txt
DND_LEGACY_ORIGIN=https://legacy.dnd.faysk.dev
```

O domínio público móvel `dnd.faysk.dev` nunca será usado como upstream interno do BFF.

## Gate atual

```txt
apps/web criado                       ✅
App Router                            ✅
TypeScript strict                     ✅
Tailwind 4                            ✅
Vitest                                ✅
Playwright                            ✅
CI Next                               ✅
CI legado                             ✅
lockfile gerado                       ✅
lockfile versionado/frozen            ⬜
projeto Vercel separado               ⬜
Preview do projeto separado           ⬜
origem legada definida/planejada      ✅
origem legada saudável antes do BFF   → obrigatório antes da Fase 5
```

Resultado:

```txt
FASE 3 = EM EXECUÇÃO
```

A Fase 4 ainda não deve ser considerada iniciada até os itens de lockfile e Preview separado serem resolvidos.
