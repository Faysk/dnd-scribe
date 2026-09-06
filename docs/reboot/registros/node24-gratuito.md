# Exceção aprovada: Node 24 para hospedagem gratuita

> Status: decisão aprovada; base ajustada, validação vinculada ao commit. Responsável: proprietário e implementador. Revisão: 2026-09-06.

O proprietário aceitou Node 24 se necessário para manter produção gratuita. Esta decisão substitui a exigência anterior de Node 26 em produção. A política geral de últimas versões permanece: a exceção cobre o runtime e seus tipos, não uma redução geral das dependências.

## Escolha

- Node **24.20.0**, última release 24.x no [índice oficial](https://nodejs.org/dist/index.json), consultado em 2026-09-06.
- `@types/node` **24.13.3**, última release estável da linha 24 no [registro oficial do pacote](https://registry.npmjs.org/@types%2fnode). Os tipos acompanham as APIs disponíveis no runtime.
- Vercel volta a ser o destino preferido. A [documentação de runtimes](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) lista 24.x e informa que a plataforma controla patches/minors. Local/CI/Docker fixam 24.20.0; não presumir patch idêntico em Functions sem conferir o deployment.
- pnpm 12, Next 16, React 19, TypeScript 7 e demais dependências ficam nas versões atuais já escolhidas.

## Implementação

`.node-version`, `.nvmrc`, engines dos dois pacotes, Docker e smoke usam a linha 24. O CI lê `.node-version`. O verificador de versões exige a última release 24.x, reporta a exceção e continua mostrando a última upstream; não oculta a existência do Node 26. Dependabot ainda pode propor mudança de major, mas promoção além de 24 exige rever o suporte gratuito.

Deploys por Git foram reabilitados somente para main e Preview nas configurações Vercel. Isso não cria novos projetos nem muda DNS. Na inspeção atual, `dnd-scribe` está ligado ao GitHub, mas `dnd-scribe-web-next` ainda está sem vínculo Git. A unificação da publicação do frontend permanece um item do reboot; reabilitar a integração do projeto raiz não certifica que todo o frontend novo esteja no domínio.

Render/Docker permanecem alternativas portáteis; não há necessidade de mudar de hosting apenas para usar Node 26. A proposta Render anterior não foi provisionada. Não criamos plano pago nem runner WSL. Gratuidade depende também de respeitar franquias do provider, independentemente do runtime.

## Aceite e revisão

Validar instalação com lockfile, tipos, lint, unitários, build e smoke de produção sob Node 24. O CI nas branches permanentes registra os resultados do commit. Resultado de build/deploy Vercel deve ser conferido separadamente, incluindo origem, SHA e runtime; não confundir CI aprovado com site atualizado.

Validação local em 2026-09-06: instalação, tipos, lint, 51 testes unitários, build e auditoria do bundle aprovados em Node 24.20.0. Checks gerais do repositório aprovados. Build Docker Linux também aprovado; o smoke de produção verifica a linha 24.

Rever a exceção quando a Vercel oferecer uma linha mais recente gratuitamente ou quando 24 perder suporte. Nenhuma migração de dados faz parte desta alteração.
