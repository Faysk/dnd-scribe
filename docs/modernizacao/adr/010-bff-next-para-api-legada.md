# ADR 010 — BFF no Next para consumir a API legada durante a migração

Status: **Accepted**  
Data: **2026-09-04**

## Contexto

O novo app Next será executado em um projeto Vercel separado durante bootstrap e homologação, enquanto a API existente continuará sendo a fronteira canônica de dados do player.

Isso cria uma diferença importante em relação ao frontend legado: no app atual, browser e `/api/*` vivem na mesma origem. No Preview Next, a aplicação web e a API legada estarão em origens diferentes.

Fazer Client Components chamarem diretamente a API legada criaria dependência de CORS, espalharia tratamento de token pelo browser e acoplaria componentes visuais à topologia temporária de migração.

## Decisão

O novo app Next usará uma camada BFF (Backend for Frontend) server-side para falar com a API legada.

A regra é:

```txt
Browser
  ↓
Next.js
  ↓ server-side
legacy-api adapter
  ↓ Authorization: Bearer <access_token>
API legada
  ↓
Supabase/PostgreSQL
```

O browser não deve conhecer a origem da API legada.

### Server Components

Server Components podem consumir o adapter server-only diretamente quando não houver necessidade de interação client-side.

Exemplos:

- Home;
- arquivo de sessões;
- metadados de sessão;
- resumo.

### Client Components

Fluxos interativos devem chamar endpoints internos do novo app, que por sua vez usam o mesmo adapter server-only.

Exemplo para transcrição:

```txt
Client Component
  ↓
/api/player/transcript?...  (Next Route Handler)
  ↓
legacy-api adapter
  ↓
API legada /api/library-transcript
```

A nomenclatura interna pode ser refinada na implementação, mas a fronteira browser → Next → API legada é obrigatória durante a coexistência.

## Configuração

O novo projeto possuirá uma variável server-only equivalente a:

```txt
LEGACY_API_ORIGIN=https://dnd.faysk.dev
```

Essa origem não deve ser hardcoded nos componentes.

O token de acesso Supabase da sessão SSR deve ser encaminhado pelo adapter em:

```http
Authorization: Bearer <access_token>
```

Nenhuma service role ou chave privilegiada deve ser enviada ao browser ou usada para contornar as regras existentes de campaign access.

## Auth

O novo app usará Supabase Auth com SSR/cookies.

O adapter obtém a sessão autenticada no servidor e encaminha o access token do próprio usuário para a API legada.

Consequências:

- a API continua aplicando as regras atuais de `campaignRole` e `capabilities`;
- o Next não replica autorização de domínio por conta própria durante a primeira migração;
- Preview domains/callbacks necessários ao OAuth precisam estar autorizados no Supabase antes da homologação de auth.

## Cache

Respostas autenticadas não podem virar cache público compartilhado.

Por padrão, chamadas autenticadas ao adapter devem ser tratadas como privadas/dinâmicas até que uma política de cache segura e explícita seja validada.

O comportamento de cache da API legada permanece válido como segunda camada, mas não autoriza o Next a publicar conteúdo privado em cache global.

## Erros

O BFF deve preservar semanticamente os estados relevantes da API:

- `401` → sessão ausente/expirada;
- `403` → acesso à campanha não autorizado;
- `404` → recurso inexistente;
- `5xx` → falha de serviço.

A UI pode apresentar mensagens melhores, mas não deve transformar erro de autorização em estado de conteúdo vazio.

## Alternativas consideradas

### Browser chamando a API legada diretamente

Rejeitada porque adiciona CORS, expõe a topologia temporária e espalha token/fetch logic em Client Components.

### Next acessando Supabase diretamente desde o primeiro dia

Rejeitada durante a migração por violar o ADR 008 e duplicar regras já implementadas na API existente.

### Duplicar a API inteira dentro do novo projeto antes da UI

Rejeitada por aumentar escopo e risco, além de dificultar rollback.

## Consequências positivas

- CORS deixa de ser preocupação do frontend;
- topologia temporária fica escondida do browser;
- auth continua usando identidade real do usuário;
- Server Components podem buscar dados sem JavaScript client-side;
- Client Components possuem uma origem única e estável;
- trocar a implementação de dados depois fica concentrado no adapter/BFF.

## Custos e consequências negativas

- existe um hop adicional durante a coexistência;
- o novo app precisa de configuração da origem legada;
- Route Handlers serão necessários para interações client-side como paginação da transcrição;
- logs de erro precisam permitir distinguir falha do Next de falha da API legada.

## Critério para remover esta decisão

O BFF deixa de ser obrigatório somente quando uma migração posterior substituir formalmente os endpoints legados, com:

- testes de paridade;
- autorização equivalente;
- rollback definido;
- atualização deste ADR para `Superseded`.
