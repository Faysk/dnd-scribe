# 19 — Fase 5: plano de execução de Auth e Shell

Status: **pré-planejado; execução depende da Fase 4 concluída**

## Objetivo

Migrar a moldura real do app público e a autenticação para a nova aplicação Next sem alterar regras de acesso da campanha e sem migrar ainda Home, arquivo, sessão ou transcrição.

Ao final da fase, um usuário real deve conseguir:

```txt
abrir Preview
→ autenticar com Discord ou Google
→ ter sessão SSR/cookie válida
→ ter campaignRole/capabilities resolvidos
→ chegar a um shell autenticado
→ alternar tema
→ abrir menu de usuário
→ sair
```

Usuário autenticado sem acesso aprovado deve continuar vendo o estado de **Acesso pendente**.

---

## 1. Contratos preservados

O legado já possui estes estados funcionais:

```txt
não autenticado
→ login

autenticado sem campaignRole
→ acesso pendente

autenticado com campaignRole
→ app da campanha
```

O novo app deve preservar a mesma semântica.

Também devem continuar existindo:

- Discord;
- Google;
- `profile`;
- `campaignRole`;
- `capabilities`;
- `capabilities.canOpenEdit`;
- logout;
- retry/revalidação de acesso pendente.

Nenhuma nova role ou permissão será inventada nesta fase.

---

## 2. Topologia de autenticação

Durante coexistência:

```txt
Browser
│
├── OAuth/Supabase Auth
│
└── Next App
    ├── cookie session via @supabase/ssr
    ├── Server Components
    ├── Route Handlers/Server Actions quando necessário
    └── BFF
        └── API legada
            └── Supabase/PostgreSQL
```

Regra:

> o browser não deve precisar chamar a API legada diretamente com Bearer token para navegar pelo novo app.

O BFF resolve a sessão no servidor e anexa o access token do usuário ao chamar a API legada que ainda espera `Authorization: Bearer`.

---

## 3. Pacote SSR

Usar a integração oficial vigente do Supabase para sessão em cookies.

Referência aprovada no planejamento:

- `@supabase/ssr` para frameworks SSR com sessão em cookies;
- `createBrowserClient` somente quando Client Component realmente precisar conversar com Supabase;
- `createServerClient` para Server Components, Route Handlers e ações server-side.

A versão instalada deve ser a estável mais recente compatível no momento da execução.

---

## 4. `proxy.ts` no Next 16+

No Next.js 16 a convenção `middleware.ts` foi renomeada/deprecada em favor de `proxy.ts`.

Portanto o plano da Fase 5 deve usar:

```txt
apps/web/proxy.ts
```

quando a integração SSR vigente do Supabase exigir refresh/cookie synchronization.

Responsabilidade do Proxy:

- manter/renovar tokens quando necessário;
- propagar cookies atualizados;
- permitir checks otimistas de navegação quando apropriado.

Não usar Proxy para:

- consultas lentas de domínio;
- buscar campaignRole no banco a cada request se isso puder ser resolvido no render/BFF;
- substituir autorização real.

Regra:

> Proxy mantém sessão; autorização de campanha continua no contrato de acesso da aplicação.

---

## 5. Verificação de identidade

Não confiar em cookie cru ou apenas em `getSession()` para proteger conteúdo no servidor.

Seguir a recomendação oficial vigente do Supabase para verificar claims/identidade no servidor, atualmente baseada em `getClaims()` para proteção de páginas e dados.

A implementação efetiva deve ser validada contra a documentação oficial na data da execução.

---

## 6. PKCE e callback

A autenticação SSR deve usar o fluxo adequado para servidor/cookies.

O `@supabase/ssr` usa PKCE por padrão no cenário SSR atual.

Estrutura esperada:

```txt
/auth/callback
```

Responsabilidade:

1. receber auth code;
2. trocar code por session;
3. persistir cookies;
4. redirecionar para destino seguro do app.

Não armazenar access token manualmente em localStorage como requisito da nova arquitetura.

---

## 7. Preview OAuth

O novo projeto Vercel possui hostname próprio durante Preview/Homologação.

Antes de testar login:

- configurar redirect URL permitido no Supabase para o hostname de homologação escolhido;
- evitar wildcard amplo desnecessário;
- confirmar Discord/Google retornando ao callback correto;
- manter `dnd.faysk.dev` intacto;
- não remover redirects usados pelo legado.

Se cada Preview efêmero tornar OAuth impraticável, usar um hostname de homologação estável para esta fase em vez de cadastrar dezenas de URLs voláteis.

---

## 8. Clientes Supabase

Estrutura alvo aproximada:

```txt
apps/web/lib/supabase/
├── client.ts
├── server.ts
└── proxy.ts-helper      # nome real definido na implementação
```

### `client.ts`

Uso apenas em Client Components que realmente precisem de SDK browser.

### `server.ts`

Cria client baseado em cookies da request/render corrente.

### helper do Proxy

Centraliza refresh/copy de cookies conforme padrão oficial vigente.

Evitar múltiplas implementações de cookie handling espalhadas pelo projeto.

---

## 9. BFF de acesso à campanha

O shell precisa resolver o contrato existente:

```http
GET /api/auth/me?campaignSlug=yuhara-main
Authorization: Bearer <user_access_token>
```

No novo app:

```txt
Server Component/layout
→ BFF helper
→ access token da sessão server-side
→ API legada /api/auth/me
→ profile + campaignRole + capabilities
```

Resultado deve ser tipado e validado em runtime.

Estrutura sugerida:

```txt
lib/api/auth.ts
lib/api/contracts/auth.ts
```

Não expor o payload cru como estado global sem necessidade.

---

## 10. Modelo de estado do shell

O shell deve trabalhar com um modelo simples:

```txt
AuthState
├── anonymous
├── pendingAccess
└── authorized
```

Para `authorized`, carregar:

```txt
user
profile
campaignRole
capabilities
```

A UI não deve precisar inferir autorização a partir de email, provider ou presença de avatar.

---

## 11. Layouts e rotas

Estrutura possível:

```txt
app/
├── layout.tsx
├── (auth)/
│   └── login/
│       └── page.tsx
├── auth/
│   └── callback/
│       └── route.ts
└── (campaign)/
    ├── layout.tsx
    └── page.tsx        # shell técnico nesta fase
```

A estrutura final pode variar, mas precisa separar claramente:

- fluxo público de auth;
- callback;
- layout autenticado da campanha.

Não criar ainda `/sessoes` funcional se isso antecipar a Fase 6.

---

## 12. Header

Composição alvo nesta fase:

```txt
[D20] DnD Scribe
      Arquivo da campanha

Início  Sessões                 Tema  Avatar
```

Como Home/arquivo ainda não estão migrados, destinos podem permanecer desabilitados/placeholder técnico apenas durante o desenvolvimento interno; o Preview usado para aprovação da fase não deve apresentar links quebrados.

Quando os destinos não existirem ainda, preferir shell sem navegação funcional incompleta.

---

## 13. User menu

O menu deve preparar/parificar:

- avatar;
- nome do perfil;
- role quando útil;
- theme preference ou acesso ao controle de tema;
- link `Editar` somente se `canOpenEdit` e se o destino legado continuar sendo o comportamento aprovado durante coexistência;
- logout.

Se `Editar` apontar ao legado durante a modernização, documentar explicitamente que é uma bridge temporária.

Não criar nova Central Local nesta fase.

---

## 14. Theme toggle

Usar a infraestrutura da Fase 4.

Estados:

```txt
system
light
dark
```

Requisitos:

- sem flash perceptível de tema incorreto;
- preferência persistida;
- keyboard acessível;
- label claro;
- ícone não é a única fonte de significado.

---

## 15. Login

A tela deve preservar a simplicidade do produto.

Conteúdo mínimo:

- marca DnD Scribe;
- indicação de acesso à campanha;
- botão Discord;
- botão Google;
- loading;
- erro/retry.

Não transformar login em landing page comercial.

---

## 16. Acesso pendente

Estado obrigatório.

Deve conter:

- mensagem de que a conta está autenticada, mas ainda não aprovada para a campanha;
- identidade básica do usuário quando útil;
- ação `Verificar novamente`;
- logout;
- tratamento de erro.

A ação de revalidação consulta novamente o contrato de acesso sem exigir novo login.

---

## 17. Cache e privacidade

Rotas autenticadas não podem ser tratadas como conteúdo público cacheável.

Cuidados:

- resposta que atualiza cookies de sessão não deve entrar em cache compartilhado;
- evitar ISR em rotas que podem realizar refresh de auth;
- respeitar headers privados/no-store quando aplicável;
- nunca permitir que resposta com `Set-Cookie` de um usuário seja reutilizada para outro.

A política detalhada deve seguir a versão vigente do `@supabase/ssr` e da Vercel no momento da implementação.

---

## 18. Segurança

Proibições:

- `SUPABASE_SECRET_KEY`/service role no client bundle;
- guardar token em logs;
- incluir Bearer token em mensagem de erro;
- confiar apenas em conteúdo client-side para autorização;
- usar `campaignRole` recebido do browser como fonte de verdade;
- ampliar redirect OAuth indiscriminadamente.

Logs de auth devem ser sanitizados.

---

## 19. Erros e observabilidade

Tratar separadamente:

```txt
falha ao iniciar Supabase
falha OAuth
callback inválido
sessão expirada
API legada indisponível
401 da API legada
403 sem campaignRole
payload inválido
```

Nenhum desses cenários deve resultar apenas em tela branca.

Erros não sensíveis podem ser logados server-side com request context mínimo.

---

## 20. Testes

### Unitários

- normalização de AuthState;
- validação dos contratos de `/api/auth/me`;
- helpers de redirect seguro;
- helpers de BFF.

### E2E

No mínimo:

```txt
anonymous → login
login aprovado → shell
login sem role → acesso pendente
pending → verificar novamente
authorized → menu
authorized → theme toggle
logout → login
```

OAuth real pode exigir testes de integração/homologação separados dos E2E determinísticos de CI.

### Segurança

Testar:

- rota autenticada sem cookie;
- cookie inválido;
- API legada 401;
- API legada 403;
- capability ausente;
- retorno OAuth com redirect externo não permitido.

---

## 21. Visual regression

Capturar pelo menos:

```txt
login-dark-desktop
login-light-desktop
pending-dark-desktop
pending-light-desktop
shell-dark-desktop
shell-light-desktop
login-mobile
pending-mobile
shell-mobile
user-menu-open
```

Comparar com baseline do legado quando houver tela equivalente.

---

## 22. O que NÃO fazer

- implementar Home final;
- carregar lista real de sessões na entrada;
- migrar resumo;
- migrar transcrição;
- trocar regras de roles/capabilities;
- alterar RLS por conveniência do frontend;
- migrar API legada;
- remover login legado;
- mudar domínio de produção;
- adicionar Pessoas/Mundo/Lore.

---

## 23. Gate de saída

A Fase 5 termina quando:

```txt
Discord login Preview ✅
Google login Preview ✅
PKCE/callback/cookies ✅
sessão SSR válida ✅
Proxy de refresh ✅
profile ✅
campaignRole ✅
capabilities ✅
pending access ✅
user menu ✅
theme system/light/dark ✅
logout ✅
BFF sem token no browser ✅
E2E crítico ✅
visual regression ✅
typecheck/lint/test/build ✅
produção legado intacta ✅
```

Documentar ao final:

- configuração OAuth adicionada para Preview;
- arquivos de auth criados;
- estratégia de cookies;
- comportamento de refresh;
- bridges temporárias;
- riscos/dívidas;
- checks executados.

---

## 24. Referências oficiais para revalidação na execução

Revalidar especialmente:

- Next.js 16+ `proxy.ts`;
- Supabase SSR com cookies;
- recomendação vigente de `getClaims()` para proteção;
- PKCE/callback;
- cache headers em refresh de sessão.

A documentação oficial pode evoluir; este plano define o comportamento desejado, não congela snippets externos.

---

## 25. Próxima fase

Após o gate:

```txt
Fase 6 — Home e Arquivo de Sessões
```

A partir daí o shell autenticado começa a receber conteúdo real da campanha.