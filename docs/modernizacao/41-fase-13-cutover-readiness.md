# 41 — Fase 13: Cutover readiness

Status: **PREPARAÇÃO TÉCNICA CONCLUÍDA — movimentação de domínio em standby Vercel**  
Data: **2026-09-04**

## Objetivo deste bloco

Preparar tudo que pode ser decidido, implementado e testado antes do release candidate final e antes de mover `dnd.faysk.dev`.

Nenhum domínio foi movido por este bloco.

## Topologia preparada

```txt
Browser
→ Next
├── rotas modernas locais
├── /api/web/*                 → BFF moderno local
└── fallback legado
    ├── /api/* restante
    ├── /edit*
    ├── /central-local*
    ├── /terms
    ├── /privacy
    ├── /linked-role
    └── /docs/api*
        ↓
DND_LEGACY_ORIGIN
        ↓
projeto legado
```

O fallback é configurado em `next.config.ts` como `rewrites().fallback`, portanto handlers/rotas locais do Next têm precedência antes do passthrough legado.

## Namespace BFF

O namespace canônico reservado é:

```txt
/api/web/*
```

A transcrição passa a usar:

```txt
/api/web/library/transcript
/api/web/library/download
```

Os handlers anteriores em `/api/library/*` continuam temporariamente existentes como compatibilidade interna durante a migração, mas o client moderno já aponta ao namespace reservado.

## Validação da origem legada

O helper do gateway rejeita:

- HTTP;
- credenciais na URL;
- path/query/hash;
- o domínio móvel `dnd.faysk.dev`;
- valor ausente/inválido.

Sem uma origem segura, o gateway não cria fallback externo.

Isso reduz o risco de self-loop depois do cutover.

## Inventário de rotas do projeto legado

Revalidado a partir do `vercel.json` atual:

### API / integrações

```txt
/api/v1/*
/api/integrations/*
/api/companion-release
/api/roll20-bridge/*
/api/roll20/*
/api/lore/*
/api/jobs/*
/api/discord/interactions
/api/pipeline-recover
/api/* restante
```

### Operacional/estático

```txt
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

### Crons legados

```txt
/api/pipeline-supervisor
/api/cron/discord-catch-up
```

Os crons permanecem no projeto legado e não são duplicados no Next.

## Permissions-Policy da Central Local

O legado exige:

```txt
Permissions-Policy: local-network=(self), loopback-network=(self)
```

O Next já possui regra específica preparada para `/edit*` e `/central-local*`, sobrepondo a política genérica de páginas normais.

A efetividade final dessa composição precisa ser confirmada no RC Vercel, porque headers em external rewrites fazem parte do gate de plataforma.

## Matriz de classificação congelada

| Path | Classe | Destino após cutover |
| --- | --- | --- |
| `/` | modern-local | Next |
| `/sessoes*` | modern-local | Next |
| `/auth/*` | modern-local | Next |
| `/api/web/*` | modern-local | BFF Next |
| `/api/*` restante | legacy-fallback | origem legada |
| `/edit*` | legacy-fallback | origem legada |
| `/central-local*` | legacy-fallback | origem legada |
| `/terms` | legacy-fallback | origem legada |
| `/privacy` | legacy-fallback | origem legada |
| `/linked-role` | legacy-fallback | origem legada |
| `/docs/api*` | legacy-fallback | origem legada |

## Smoke de cutover congelado

Executar imediatamente após movimento do domínio:

```txt
01 GET /
02 login real
03 Home
04 /sessoes
05 resumo recente
06 transcrição
07 busca
08 speaker filter
09 download
10 theme
11 logout/login
12 hash legado transcrição
13 hash legado resumo
14 /api/auth-config
15 API legada autenticada representativa
16 /edit
17 /central-local
18 /terms
19 /privacy
20 /docs/api
21 integração externa não destrutiva
22 mobile essencial
```

## Critério de rollback congelado

Rollback imediato se ocorrer qualquer um:

- auth quebrada;
- autorização incorreta;
- campanha inacessível;
- segredo exposto;
- BFF em loop;
- API crítica quebrada;
- Central Local operacionalmente quebrada;
- integração crítica quebrada;
- mobile severamente inutilizável;
- 5xx persistente sem correção simples/segura.

Rollback primário:

```txt
reassociar dnd.faysk.dev ao projeto legado
```

O projeto Next permanece disponível para diagnóstico.

## O que já está pronto sem Vercel

```txt
classificação de rotas          ✅
gateway em código               ✅
namespace /api/web              ✅
proteção anti-self-loop         ✅
headers Central Local preparados✅
inventário legado               ✅
crons explicitamente legados    ✅
smoke matrix                    ✅
critérios de rollback           ✅
feature freeze                  ✅
```

## Standby Vercel

Ainda depende da plataforma:

```txt
novo RC READY no SHA final
validar rewrites externos reais
validar headers reais do gateway
validar cookies/OAuth HTTPS
associar/mover dnd.faysk.dev
observar logs pós-movimento
executar/reverter domínio se necessário
```

Portanto **Fase 13 não é declarada executada**. Tudo anterior ao ato de plataforma está preparado.
