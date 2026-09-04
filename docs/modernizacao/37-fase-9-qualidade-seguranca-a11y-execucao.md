# 37 — Fase 9: execução de Qualidade, Segurança e Acessibilidade

Status: **implementação concluída; gate de CI pendente**  
Branch: `modernizacao/fase-9-qualidade-seguranca-a11y`

## Escopo auditado

A revisão transversal cobriu o Web Next já funcional após a Fase 8:

```txt
Auth/Shell
Home
/sessoes
/sessoes/[id]
/sessoes/[id]/transcricao
BFF de transcrição
download .md
Markdown
Dark/Light
Supabase/RLS
CI
```

Nenhuma feature futura de domínio foi adicionada.

## Mudanças aplicadas

### Fronteiras de input

Os parâmetros da transcrição deixaram de ser truncados silenciosamente no BFF. Valores acima do contrato agora são rejeitados com `400`.

Limites alinhados ao backend legado:

```txt
sourceSessionId: 220
cursor: 1200
q: 120
speaker: 120
```

O client usa os mesmos limites para evitar divergência entre UI e servidor.

### BFF / SSRF / resiliência

O helper de upstream agora:

- aceita apenas a allowlist de endpoints legados usados pelo Web Next;
- mantém a origem exclusivamente em `DND_LEGACY_ORIGIN` server-only;
- aplica timeout de 12 segundos;
- não retransmite cookies/headers do upstream;
- não registra Authorization, query ou conteúdo privado;
- registra apenas categoria, pathname fixo, status e duração quando o upstream falha.

O adapter de auth recebeu o mesmo timeout e logging mínimo seguro.

### Logout / CSRF

`POST /auth/logout` agora exige `Origin` igual à origem do request. POST cross-origin ou sem `Origin` é rejeitado com `403`.

### Headers

O Next passa a emitir:

```txt
Cross-Origin-Opener-Policy: same-origin-allow-popups
Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Frame-Options: DENY
X-Permitted-Cross-Domain-Policies: none
Strict-Transport-Security: max-age=31536000   # produção
```

CSP foi deliberadamente adiada. O App Router/React injeta scripts necessários ao runtime e uma política correta exige estratégia de nonce. Não foi aceita uma CSP cosmética baseada em `unsafe-inline` apenas para marcar checklist.

### Client bundle

Foi adicionado um gate pós-build que varre `.next/static` e falha se encontrar marcadores server-only como:

```txt
DND_LEGACY_ORIGIN
DND_LEGACY_EDIT_ORIGIN
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
service_role
```

### Acessibilidade

- `#content` agora é programaticamente focável em login, pending access, erro de auth e Preview sem env;
- skip link ganha cobertura E2E real por teclado;
- transcrição expõe `aria-busy`, status atômico, associação de filtros ao resultado e mensagens de loading;
- reduced motion, reflow em 320px, landmarks, H1 e nomes acessíveis ganham testes E2E.

O CSS já possuía foco visível e redução de movimento; a fase adiciona evidência automatizada para esses comportamentos.

## Contraste medido

Relações principais calculadas a partir dos tokens atuais:

| Combinação | Razão aproximada |
| --- | ---: |
| Dark foreground / canvas | 16.05:1 |
| Dark soft / canvas | 11.06:1 |
| Dark muted / canvas | 6.56:1 |
| Dark accent / canvas | 9.15:1 |
| Light foreground / canvas | 15.35:1 |
| Light soft / canvas | 7.56:1 |
| Light muted / canvas | 5.04:1 |
| Light accent / canvas | 5.51:1 |
| Light accent-contrast / accent-strong | 4.64:1 |
| Light muted / surface | 4.53:1 |

Os textos normais auditados permanecem em AA. `light muted / surface` é o caso mais próximo do limite e deve permanecer no radar de regressão visual.

## Supabase / RLS

Projeto auditado: `DND Scribe` (`dmrqnbdvbkfqzctcerbx`).

Achados:

- as tabelas centrais da campanha possuem RLS habilitado;
- várias tabelas aparecem como `RLS Enabled No Policy`, porém também não concedem privilégios diretos a `anon`/`authenticated` — comportamento deny-by-default compatível com a fronteira atual via backend/service role;
- as funções `SECURITY DEFINER` expostas a `authenticated` foram inspecionadas individualmente;
- funções de revisão verificam role no próprio corpo;
- helpers de identidade/role operam sobre `auth.uid()`;
- diretórios filtram dados conforme membership/role;
- nenhuma alteração de DDL foi feita apenas para silenciar advisor.

### Dívidas registradas

**SEC-01 — SECURITY DEFINER RPC surface — medium**  
Algumas funções possuem `EXECUTE` para `authenticated`. Não foi demonstrado bypass no fluxo auditado, mas a superfície é maior que o necessário para o novo Web. Revisar/revogar RPCs não consumidos somente após mapear consumidores legados.

**SEC-02 — Leaked password protection — info**  
O advisor informa proteção de senhas vazadas desativada. O Web atual usa OAuth Discord/Google, portanto não bloqueia a migração. Deve ser habilitada antes de qualquer login por senha.

**SEC-03 — CSP com nonce — medium**  
Adiada para uma implementação compatível com Next/React sem `unsafe-inline` generalizado. Não há critical/high aberto associado: React escapa texto, Markdown possui renderer seguro e URLs externas auditadas.

## TypeScript

O app permanece em:

```txt
strict = true
noEmit = true
```

Não foi introduzido `ignoreBuildErrors`, `@ts-ignore` ou bypass equivalente.

## CI acrescentado

O pipeline Web Next agora inclui:

```txt
install frozen
typecheck
lint
unit tests
build
audit do client bundle
Playwright Chromium
E2E funcional + segurança + a11y crítica
```

## Matriz de achados

| ID | Categoria | Severidade | Status |
| --- | --- | --- | --- |
| SEC-01 | Supabase RPC | medium | documentado / não blocker |
| SEC-02 | Auth password | info | documentado / não aplicável ao OAuth atual |
| SEC-03 | CSP | medium | adiado com justificativa |
| SEC-04 | Logout cross-origin | high | corrigido |
| SEC-05 | BFF sem timeout | medium | corrigido |
| SEC-06 | BFF input truncado | medium | corrigido |
| SEC-07 | Upstream path genérico | medium | corrigido com allowlist |
| A11Y-01 | Skip target inconsistente | medium | corrigido |
| A11Y-02 | Loading da transcrição | low | corrigido |
| SUPPLY-01 | Client bundle sem gate de segredo | medium | corrigido |

Resultado esperado para o gate após CI:

```txt
critical abertos = 0
high abertos = 0
```

## Pendências que exigem ambiente/homologação posterior

- auditoria visual completa dark/light em telas reais;
- teclado manual completo com sessão autenticada;
- zoom 200% nas páginas autenticadas reais;
- inspeção de cookies emitidos em Preview HTTPS;
- métricas de performance em ambiente equivalente.

Esses itens continuam nos gates de Performance, Paridade e Homologação; não justificam enfraquecer os checks automatizáveis desta fase.
