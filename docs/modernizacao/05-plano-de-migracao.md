# 05 — Plano de migração

Status: **plano de execução incremental**

## Objetivo

Migrar o app público atual para a nova arquitetura sem interromper o uso da mesa e sem combinar a migração com novas features de domínio.

## Estratégia

A modernização será feita em paralelo ao frontend legado.

```txt
Produção atual
→ frontend legado

Preview
→ novo app

Paridade aprovada
→ cutover

Estabilização
→ legado deixa de ser necessário para uso normal
```

## Regra de ouro

Não trocar simultaneamente:

- frontend;
- API;
- banco;
- auth;
- pipeline local.

Quanto mais camadas mudarem ao mesmo tempo, mais difícil será descobrir a origem de regressões.

## Etapa A — Congelar contratos atuais

Antes do bootstrap do novo app:

- listar endpoints usados pelo app público;
- registrar parâmetros;
- registrar payloads relevantes;
- registrar estados de erro;
- registrar comportamento de auth;
- registrar rotas e redirects;
- congelar screenshots de referência.

Não é necessário documentar cada detalhe interno da API, apenas o contrato necessário para reproduzir o app público.

## Etapa B — Criar novo app em paralelo

Criar `apps/web` sem alterar a rota de produção.

Primeiros requisitos:

```txt
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Todos devem funcionar antes de migrar uma tela real.

## Etapa C — Design system antes das telas

Reproduzir:

- canvas;
- superfícies;
- cores;
- tipografia;
- buttons;
- inputs;
- cards;
- menu;
- theme switch;
- loading/error/empty states.

Objetivo: evitar reconstruir a identidade visual de forma diferente em cada página.

## Etapa D — Auth e shell

Migrar primeiro a moldura comum:

- login;
- acesso pendente;
- campanha atual;
- perfil;
- capabilities;
- header;
- theme;
- user menu.

Só seguir para dados de sessão quando usuários reais autenticarem corretamente no Preview.

## Etapa E — Home

A nova Home passa a ser `/`.

Implementar apenas:

- hero editorial;
- última sessão;
- estatísticas atuais;
- sessões recentes;
- CTA para `/sessoes`.

Não adicionar conteúdo simulado de áreas futuras.

## Etapa F — Arquivo `/sessoes`

Migrar a grid cronológica completa.

Preservar:

- imagens;
- datas;
- títulos;
- resumo curto;
- metadata.

Essa tela deve ser capaz de substituir a responsabilidade da Home antiga.

## Etapa G — Sessão com resumo default

Criar:

```txt
/sessoes/[id]
```

O resumo completo deve abrir diretamente.

A nova página deve preservar:

- hero;
- arco;
- título;
- data;
- duração;
- número de falas;
- resumo curto/completo;
- ação para abrir transcrição;
- download, quando aplicável.

## Etapa H — Transcrição

Criar:

```txt
/sessoes/[id]/transcricao
```

Migrar o comportamento atual sem regressões.

### Requisitos obrigatórios

- busca por texto;
- speaker filter;
- contador de resultados;
- cursor/paginação;
- carregamento progressivo;
- limpeza de filtros;
- download `.md`;
- empty state;
- retry;
- loading state.

## Etapa I — Redirecionamentos e compatibilidade

Durante o cutover, avaliar redirects das rotas antigas:

```txt
/#/sessao/:id
/#/sessao/:id/resumo
```

Como hash não é enviado ao servidor, compatibilidade pode exigir lógica client-side temporária ou página de bridge.

Isso deve ser testado com links antigos reais antes do deploy.

## Etapa J — CI e regressão

Antes de produção:

- typecheck;
- lint;
- unit tests;
- E2E;
- visual regression;
- build;
- smoke test do Preview.

Nenhum desses checks deve substituir proteções existentes de API, companion ou local-first. Eles são complementares.

## Etapa K — Homologação

Executar com usuários reais:

### Desktop

- dark;
- light.

### Mobile

- dark;
- light.

### Conteúdo

- sessão mais recente;
- sessão antiga;
- resumo grande;
- transcrição grande;
- busca com resultados;
- busca sem resultados;
- filtro speaker;
- download.

## Etapa L — Cutover

Pré-requisitos:

- matriz de paridade 100% nos itens obrigatórios;
- Preview aprovado;
- env de produção validado;
- rollback documentado;
- smoke test pronto;
- nenhum bug crítico/alto aberto.

Após deploy:

1. login;
2. Home;
3. `/sessoes`;
4. sessão recente;
5. resumo;
6. transcrição;
7. busca;
8. download;
9. tema;
10. logout.

## Etapa M — Estabilização

Durante o período de estabilização:

- não iniciar roadmap de features;
- corrigir regressões;
- comparar performance real;
- revisar erros;
- validar mobile;
- validar auth;
- revisar feedback da mesa.

## Etapa N — Legado

O frontend legado só deve ser removido ou arquivado quando:

- produção nova estiver estável;
- rollback operacional não depender mais dele;
- documentação indicar claramente qual app é canônico;
- arquivos antigos não forem necessários para ferramentas locais.

Não apagar histórico técnico útil apenas para “limpar” o repo.

## Política de rollback

Rollback precisa existir antes do cutover.

Deve documentar:

- qual deploy anterior restaurar;
- quais migrations são reversíveis;
- quais mudanças de banco são compatíveis com o legado;
- quais env vars precisam ser preservadas;
- como validar o retorno.

Idealmente, a modernização inicial evita migrations destrutivas justamente para tornar rollback simples.

## Risco principal

O maior risco não é a tecnologia nova. É aumentar o escopo no meio da migração.

Qualquer pedido de feature deve ser registrado para o roadmap posterior, salvo se for necessário para paridade, segurança ou estabilidade.
