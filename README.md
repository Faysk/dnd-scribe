# TDA — Tem Dado Aqui

Site, arquivo e ferramentas da campanha de D&D.

## Reboot — direção vigente

O proprietário definiu um reboot por entregas, preservando os dados: primeiro Home, sessões e resumos; depois Edit integrado e operação completa; novas funcionalidades por último.

**Destino final: 100% cloud, com o PC do proprietário desligado**, incluindo transcrição, Edit, dados, jobs e recuperação. A máquina pessoal só pode ajudar temporariamente em lotes pesados/repetitivos. Essa direção substitui o plano local-first anterior: [decisão e aceite](docs/reboot/registros/operacao-cloud.md).

- [Documentação e índice do reboot](docs/reboot/README.md)
- [Roadmap e critérios de aceite](docs/reboot/10-roadmap-e-aceite.md)
- [Política de versões mais recentes](docs/reboot/03-stack-e-atualizacoes.md)
- [Estado, riscos e decisões abertas](docs/reboot/11-estado-riscos-e-decisoes.md)

As seções abaixo descrevem a estrutura atual e regras anteriores compatíveis. A fundação web usa Node 24 por exceção aceita para hospedagem gratuita e mantém contêiner de produção. Migração de dados e publicação integrada continuam pendentes; veja [operação da base](docs/reboot/registros/fundacao-web.md).

> **Regra principal: `main = produção`.**
>
> Tudo que está em `main` é a versão final. Não mantemos uma segunda versão pública do frontend dentro do repositório.

## Estrutura canônica

```text
apps/web/           ÚNICO frontend público (Next.js)
api/                APIs e jobs de backend ainda hospedados no serviço operacional
lib/                domínio/backend compartilhado
web/central-local/  Edit/operador temporário, não é frontend público
web/assets/sessions/arte histórica das sessões enquanto o storage não for unificado
local-companion/    legado local temporário; será substituído por operação cloud
integrations/       integrações externas (Roll20 etc.)
supabase/           migrations e configuração de dados
docs/               documentação atual
```

## O que NÃO existe mais

Foram removidas as antigas demos/frontends estáticos da raiz e o antigo `web/index.html`.

Não recrie:

- `index.html`, `pitch.html`, `app.js`, `data.js` ou `styles.css` na raiz;
- `css/`, `js/` ou `assets/` da antiga demo;
- `web/index.html` ou os módulos do antigo frontend público.

O CI executa `scripts/check-canonical-layout.js` e falha se uma dessas superfícies antigas voltar.

## Frontend público

O produto público é somente:

```text
apps/web
```

Comandos:

```bash
pnpm --dir apps/web dev
pnpm --dir apps/web typecheck
pnpm --dir apps/web lint
pnpm --dir apps/web test
pnpm --dir apps/web build
```

A identidade atual é **TDA — Tem Dado Aqui**.

## Edit / operador

Enquanto o Edit ainda não foi migrado para Next, a superfície operacional permanece isolada em:

```text
web/central-local/
```

Ela existe apenas para edição, processamento local, integrações e permissões. Não deve ganhar páginas públicas novas.

## Deploy

Contrato de produção: `docs/09_contrato_main_prod.md`.

Resumo:

1. `main` é a única branch de produção.
2. o frontend público deve ser construído diretamente de `apps/web` na `main`;
3. o serviço operacional deve ser construído da mesma `main`;
4. nenhum domínio público pode apontar para build manual ou commit antigo;
5. rollback é feito por commit/revert, nunca mantendo duas versões concorrentes no código.

## Validação geral

```bash
npm run check
pnpm --dir apps/web typecheck
pnpm --dir apps/web lint
pnpm --dir apps/web test
pnpm --dir apps/web build
```
