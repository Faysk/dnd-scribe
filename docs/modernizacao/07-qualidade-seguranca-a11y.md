# 07 — Qualidade, segurança e acessibilidade

Status: **requisitos transversais da modernização**

## Objetivo

Garantir que a modernização melhore a manutenção sem perder proteções já existentes nem criar uma aplicação mais frágil.

## TypeScript

A nova aplicação deve usar:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

Regras:

- evitar `any` sem justificativa;
- tipos de API e banco devem ser explícitos;
- entradas externas nunca são confiadas apenas porque passaram pelo compilador;
- `unknown` + validação é preferível a casts silenciosos.

## Validação em runtime

Usar Zod ou solução equivalente estável para fronteiras:

- query params;
- route params;
- formulários;
- payloads de APIs quando o contrato não for garantido pelo mesmo runtime;
- env vars;
- dados externos.

## Auth

Requisitos:

- sessão do usuário disponível no servidor quando apropriado;
- cookies configurados segundo a integração oficial vigente;
- logout invalida estado corretamente;
- acesso pendente continua distinguível de usuário não autenticado;
- `campaignRole` e `capabilities` continuam respeitados;
- nenhuma regra de autorização depende exclusivamente de esconder botão.

## Supabase e RLS

A modernização não desativa RLS para facilitar desenvolvimento.

Revisar:

- políticas necessárias ao app público;
- acesso de leitura por membro da campanha;
- permissões de edição já existentes;
- ausência de bypass indevido;
- separação entre chave pública e chaves privilegiadas.

## Segredos

Nunca expor ao browser:

- `service_role`;
- tokens administrativos;
- credenciais do companion;
- segredos de workers;
- paths locais sensíveis.

## Headers e browser security

Revisar conforme a aplicação real:

- CSP;
- `Referrer-Policy`;
- `X-Content-Type-Options`;
- frame policy quando aplicável;
- permissões de origem para recursos externos;
- regras de imagens remotas;
- CORS apenas onde necessário.

Não adicionar header apenas para marcar checklist; cada política precisa ser compatível com Supabase, embeds e recursos usados.

## Sanitização de Markdown

Os resumos atuais continuam sendo conteúdo publicado.

A nova renderização deve:

- impedir HTML/script não confiável;
- preservar Markdown existente;
- evitar `dangerouslySetInnerHTML` sem sanitização ou pipeline seguro;
- ter teste com payloads maliciosos básicos.

## Dependências

Política:

- versões estáveis;
- patches de segurança prioritários;
- atualização automatizada por Renovate/Dependabot quando configurado;
- CI obrigatório antes de merge;
- não usar dependência grande sem necessidade funcional.

## Acessibilidade

### Estrutura

- landmarks semânticos;
- heading hierarchy coerente;
- links para navegação, buttons para ações;
- skip link;
- `main` identificável.

### Teclado

Todos os fluxos críticos devem funcionar sem mouse:

- login;
- header;
- user menu;
- theme switch;
- abrir sessão;
- tabs;
- busca da transcrição;
- speaker filter;
- download;
- paginação/fallback.

### Foco

- foco sempre visível;
- foco não deve ficar preso em menu fechado;
- dialogs/drawers futuros não fazem parte deste roadmap, mas primitivas usadas devem ser acessíveis;
- mudança de rota precisa manter comportamento previsível.

### Labels

- inputs com label real ou nome acessível;
- icon buttons com `aria-label`;
- selects com contexto;
- imagens informativas com `alt`.

### Estados dinâmicos

Quando necessário:

- loading anunciado;
- erro anunciado;
- quantidade de resultados atualizada de forma não invasiva;
- mensagens de retry legíveis.

### Contraste

Medir dark e light separadamente.

Não assumir que dourado/bronze funciona em todos os fundos.

### Movimento

Respeitar:

```css
@media (prefers-reduced-motion: reduce)
```

Transições devem continuar funcionais sem animação.

## Testes unitários

Prioridade inicial:

- formatadores de data;
- formatadores de duração;
- normalização de título;
- construção de rotas;
- schemas Zod;
- transformações de payload;
- lógica de filtros que não dependa do DOM.

## Testes E2E

Fluxos mínimos:

```txt
login -> home
home -> sessão
home -> /sessoes
sessão -> resumo
sessão -> transcrição
transcrição -> busca
transcrição -> speaker filter
transcrição -> limpar filtro
transcrição -> download
tema -> light/dark
user menu -> logout
```

## Regressão visual

Playwright deve capturar estados representativos em:

- desktop;
- mobile;
- dark;
- light.

Diferenças deliberadas são aprovadas e atualizam baseline. Diferença inesperada bloqueia merge até revisão.

## CI

Checks do novo web app:

```txt
install
typecheck
lint
unit tests
build
E2E crítico
```

Testes visuais podem ser separados por custo/tempo, mas devem existir antes do cutover.

Os checks existentes do repo para API, workers, monitoring, Roll20 e companion não devem ser removidos como efeito colateral da modernização.

## Observabilidade

Antes do cutover, definir como identificar:

- erro de renderização;
- falha de auth;
- erro de endpoint;
- erro de transcrição/paginação;
- problema de asset/image;
- erro de deploy.

Evitar coletar conteúdo sensível desnecessariamente em logs.

## Definition of Done

- TypeScript strict verde;
- validação runtime nas fronteiras relevantes;
- auth revisada;
- RLS revisada;
- segredos ausentes do client bundle;
- sanitização de Markdown validada;
- keyboard navigation validada;
- dark/light com contraste revisado;
- E2E crítico verde;
- CI verde;
- nenhuma regressão crítica de segurança ou a11y conhecida.
