# 33 — Fase 5: execução de Auth e App Shell

Status: **implementação em andamento; homologação OAuth/Preview ainda depende da infraestrutura externa**

Data: 2026-09-04

## Escopo implementado

A Fase 5 introduz a moldura autenticada da nova aplicação sem migrar Home, arquivo de sessões, resumo ou transcrição.

Incluído nesta execução:

- `@supabase/ssr` com sessão em cookies;
- client browser e server separados;
- `proxy.ts` do Next 16 para sincronização/refresh de cookies;
- `getClaims()` como verificação de identidade antes de proteger conteúdo;
- `getSession()` usado somente depois da verificação para obter o access token necessário ao BFF;
- callback OAuth PKCE em `/auth/callback`;
- login Discord/Google;
- logout server-side;
- BFF server-side para `/api/auth/me` legado;
- runtime validation do contrato `profile`, `campaignRole` e `capabilities`;
- estados `anonymous`, `pendingAccess` e `authorized`;
- shell editorial com marca, navegação incompleta sem link quebrado, tema e menu de usuário;
- `canOpenEdit` preservado com bridge temporária para o Edit legado;
- tema `system/light/dark` persistido com a mesma chave `dnd-scribe-theme`;
- inicialização de tema antes da hidratação para reduzir flash;
- helpers de redirect seguro e validação rígida de `DND_LEGACY_ORIGIN`;
- testes unitários dos contratos/config/redirect;
- smoke E2E da superfície de login sem secrets no CI.

## Revalidação oficial em 2026-09-04

A implementação foi revalidada contra a documentação vigente antes do código:

- Next.js 16 usa `proxy.ts` como convenção atual;
- Supabase SSR recomenda `@supabase/ssr`, clientes browser/server separados e Proxy para refresh de cookies;
- Supabase recomenda `getClaims()` para proteger páginas/dados;
- `getSession()` não é usado como prova de identidade, apenas para recuperar o token bruto após validação;
- `@supabase/ssr` usa PKCE por padrão em SSR e o callback troca o code por sessão;
- versão estável observada durante a execução: `@supabase/ssr` 0.12.6.

## Configuração necessária no Preview

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
DND_LEGACY_ORIGIN
```

`DND_LEGACY_ORIGIN` é server-only, precisa usar HTTPS e é rejeitado se apontar para `https://dnd.faysk.dev`.

Opcional:

```txt
DND_LEGACY_EDIT_ORIGIN
```

Durante coexistência, a bridge de Edit usa `https://dnd.faysk.dev/edit/` quando o env opcional não existe.

## Compatibilidade com o gate da Fase 3

Enquanto os envs de Auth não estiverem configurados, `/` continua mostrando exatamente o Preview técnico usado pelo gate da Fase 3. Isso evita quebrar o issue #27 enquanto a infraestrutura separada ainda não existe.

## Segurança

- service role/secret key não entram no app browser;
- token não é persistido manualmente em localStorage;
- browser não recebe `DND_LEGACY_ORIGIN`;
- Bearer token é montado somente server-side;
- mensagens do BFF não incluem token;
- upstream público móvel é recusado por código;
- fetch de auth usa `cache: no-store`;
- redirect pós-OAuth aceita apenas path same-origin.

## Gate ainda externo

A implementação de código não fecha sozinha a Fase 5. Permanecem obrigatórios em Preview real:

- projeto Vercel separado do issue #27;
- origem técnica legada estável e TLS;
- envs configurados no projeto novo;
- redirect URL de homologação adicionado ao Supabase sem remover redirects legados;
- login Discord real;
- login Google real;
- callback/cookies/refresh reais;
- pending access com usuário real;
- capabilities/canOpenEdit com usuário real;
- logout real;
- visual regression dark/light/desktop/mobile.

Produção `dnd.faysk.dev` continua intocada.
