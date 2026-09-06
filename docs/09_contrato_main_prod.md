# Contrato de produção — `main = prod`

Este documento é normativo.

## Regra

`main` é a única fonte de verdade da produção.

Não existem `v1`, `v2`, `legacy-home`, demo estática ou build manual competindo com o produto público.

## Superfícies

### 1. Frontend público

Fonte única:

```text
apps/web/
```

Responsável por:

- Home pública;
- arquivo de sessões;
- resumo de sessão;
- autenticação pública;
- navegação, tema e identidade TDA;
- metadata/Open Graph e compartilhamento social.

Nenhum outro diretório pode implementar a Home pública.

### 2. Serviço operacional

Fonte:

```text
api/
lib/
web/central-local/
web/roll20*.{html,js,css}
web/api-docs.*
web/assets/sessions/
```

Responsável por:

- APIs ainda não migradas para Next;
- jobs/integrações;
- Edit temporário;
- processamento local;
- assets históricos de sessão.

Ele não possui Home pública própria.

## Deploy desejado

```text
GitHub main
  ├─ Web / apps/web            -> produção pública
  └─ Serviço operacional/root  -> backend + Edit
```

Ambos devem ser produzidos a partir do mesmo commit de `main`.

O domínio `dnd.faysk.dev` deve servir o projeto Web diretamente. O serviço operacional deve ser acessado somente como origem de backend/Edit através de rewrites do Next.

## Proibido

- frontend público estático na raiz;
- `web/index.html` concorrendo com o Next;
- deploy manual permanente;
- projeto de produção sem vínculo com `main`;
- apontar o domínio para um gateway que encaminha a Home para um build antigo;
- manter código antigo “por segurança” dentro do caminho de produção;
- resolver rollback mantendo duas versões vivas.

## Rollback

Rollback é feito por:

1. revert do commit problemático; ou
2. promoção de um deployment anterior gerado da `main`.

A versão revertida continua sendo a única produção.

## Guardrails no repositório

`scripts/check-canonical-layout.js` impede a volta das antigas superfícies públicas.

O `build` do serviço operacional publica apenas uma allowlist explícita e falha se um `public/index.html` for gerado.

## Critério para considerar produção sincronizada

Uma publicação está correta quando:

- a `main` contém a mudança;
- CI está verde;
- frontend público foi construído do SHA atual da `main`;
- serviço operacional foi construído do SHA atual da `main`;
- `dnd.faysk.dev` mostra a versão do mesmo SHA.

Se qualquer um desses pontos falhar, `main = prod` está quebrado e a prioridade é corrigir o deploy antes de desenvolver novas features.
