# Fundação web e hospedagem gratuita

> Status: base implementada e validada localmente; destino externo pendente. Responsável: implementador e proprietário. Revisão: 2026-09-06.

## Decisões desta entrega

O proprietário autorizou alterações diretamente em main para iniciar o reboot. Inicialmente exigiu Node 26, mas depois aceitou Node 24 para preservar a hospedagem gratuita. A [exceção vigente](node24-gratuito.md) substitui essa exigência. Um runner local no WSL pode ser usado se necessário. Nenhum plano pago, recurso externo novo ou mudança de DNS faz parte desta entrega.

O projeto continua único: `apps/web` é a aplicação pública e o futuro Edit integrado. A fundação preserva as rotas existentes e a ponte temporária para a API/operador antigo. Não confundir o contêiner pronto com a remoção do legado: ainda é preciso portar os domínios de backend e o Edit por fluxo.

## O que foi implementado

- Node 24.20.0 por exceção aprovada, pnpm 12.3.4 e demais dependências diretas web nas versões verificadas. [Matriz](versoes.md).
- TypeScript 7 substitui o alias antigo. Biome 2.5.12 substitui ESLint porque o parser typescript-eslint atual declara suporte até TypeScript 6. Nenhuma opção de ignorar erros de tipos ou recurso experimental foi habilitada.
- Next standalone em Docker com etapas separadas, processo sem root e contexto permitido por lista explícita. Nenhum `.env`, áudio ou lore privado é copiado.
- Ícones Apple/Open Graph usam SVGs locais oficiais; não dependem do domínio antigo durante o build. A marca acompanha o tema do sistema e a escolha explícita de tema.
- `/api/live` verifica o processo. `/api/web/health` preserva compatibilidade e informa Node, SHA/ref/ambiente independentes do provider. `ready` é somente validação de configuração, explicitamente identificada; não certifica banco, storage ou integrações disponíveis.
- CI em Node 24 para main/Preview, incluindo compilação e smoke do contêiner em produção. A suíte Playwright anterior continua em modo dev; o smoke de produção é uma verificação adicional, não uma alegação de E2E completo do novo hosting.
- Dependabot diário sem exclusão global de majors. Atualizações continuam exigindo revisão e testes. `node tools/check_web_versions.mjs` compara versões diretas com npm/Node oficiais sem alterar arquivos.
- Inventário de backend compara bytes com finais de linha LF, evitando falso crescimento do monólito em Windows.

## Executar

Instalar a versão de Node indicada em `.node-version` e pnpm indicado em `packageManager`. Na raiz: `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm web:quality`. `pnpm dev` abre desenvolvimento; `pnpm build` compila a aplicação; `pnpm start` usa `next start` para teste local. No Windows, usar `pnpm.cmd` caso o shim PowerShell instalado não encaminhe comandos corretamente.

Produção portátil:

```sh
docker build -t tda-web:local .
docker run --rm -p 127.0.0.1:3100:3000 -e APP_ENV=production tda-web:local
node tools/smoke_container.mjs
```

O contêiner inicia o servidor standalone diretamente; não usa `next dev`. `PORT` pode ser informado pelo hosting. `APP_COMMIT_SHA`, `APP_COMMIT_REF` e `APP_ENV` identificam o ambiente. Configuração pública Supabase é incorporada pelo Next no build; trocar de projeto Supabase exige um novo build configurado. O valor padrão atual continua sendo o projeto existente. Não usar essa imagem com dados reais como homologação isolada do Edit.

O legado segue acessível pela origem técnica documentada. Rewrites são calculados no build: mudança de origem também requer recompilar. Não apontar a origem legada para o domínio público, evitando loop no cutover.

## Caminho gratuito proposto

**CI:** manter executores padrão Ubuntu do GitHub para este repositório público. Seu uso é gratuito segundo a [documentação GitHub](https://docs.github.com/en/actions/concepts/billing-and-usage). Não provisionamos executor WSL agora. Caso seja necessário depois, restringir a jobs confiáveis e não executar código de forks externos na máquina pessoal. Artifacts são retidos por 7 dias somente em falhas.

**Alternativa histórica ao destino preferido Vercel:** Render Free com Docker, configuração revisável em `deploy/render.free.yaml`, deploy automático desligado inicialmente e nenhum banco criado. O plano permite domínio próprio e TLS, mas dorme após 15 minutos sem tráfego, demora aproximadamente um minuto ao acordar e compartilha 750 horas mensais por workspace. Preview deve funcionar sob demanda, não como uma segunda instância sempre ligada. Há limites de tráfego/build; sem cartão ou com os limites adequados, excesso pode suspender serviço/build. Revisar a conta e impedir cobranças antes de ativar. O próprio Render recomenda o plano para hobby/testes, não produção com exigência de disponibilidade. [Limites oficiais](https://render.com/docs/free).

Manter banco e storage existentes durante a transição. O disco do contêiner é descartável; não guardar uploads nele. Não usar o Postgres gratuito do Render para migrar a campanha: expira em 30 dias. O plano é uma proposta, sem conta/deployment confirmado. Compilar via GitHub/WSL é independente de hospedar: não remove limites de tráfego ou disponibilidade do hosting.

## Validações e limites

Validação histórica do bootstrap Node 26 em 2026-09-06: consulta de 19 versões diretas/runtime, instalação com lockfile, tipos, lint, 51 testes unitários, build Windows/Linux, auditoria do bundle e checks do legado aprovados. Docker iniciou Node 26.8.1 sem root e passou o smoke HTTP de páginas, PNGs, headers e negação de transcrição anônima. Home mostrou sessões publicadas no navegador do contêiner, sem erros de console; a leitura usa a API pública existente.

Playwright local: 91 aprovados e 4 ignorados (limitações WebKit já existentes). Uma primeira execução sem os navegadores atuais falhou; após instalar as versões corretas houve um timeout de navegação com 14 workers. A execução final com 2 workers passou integralmente. CI remoto deve ser consultado no commit publicado. Nenhuma sessão privada foi editada, backup restaurado ou migração aplicada. R0 não está integralmente concluído. R1 tem a fundação técnica, mas precisa do ambiente externo e isolamento. R2 ainda precisa do aceite visual/editorial e continuidade pública; R3–R5 permanecem no roadmap. `lore/pipipi` continua pendente da fonte.

## Publicação e rollback

### Tentativa da Home em 2026-09-06

Publicação autorizada pelo proprietário. O projeto frontend `dnd-scribe-web-next` foi configurado com raiz `apps/web`. O candidato `cc6147e` compilou, mas falhou no empacotamento Vercel por ausência de `next-server.js.nft.json` ao combinar adapter e standalone ([incidente upstream](https://github.com/vercel/next.js/issues/96646)). O domínio não foi promovido.

Correção `aaa2579`: usar o empacotamento nativo quando `VERCEL=1`, mantendo standalone para Docker. Enviada a main e Preview. A tentativa seguinte foi rejeitada com `api-deployments-free-per-day`: limite gratuito de 100 deployments, orientação do provider para tentar em 24 horas. Não houve publicação da Home atualizada nem contratação de plano. Após liberar a cota: compilar o candidato sem atribuir domínio, validar páginas/dados/login, promover e conferir SHA no health público. A compilação corrigida na Vercel permanece pendente; CI isolado não substitui essa prova.

A reabilitação anterior de deploy por Git foi substituída: todas as branches agora usam publicação deliberada, conforme [política vigente](../04-git-ambientes-e-publicacao.md). A integração do frontend e seu resultado publicado ainda exigem verificação separada. Antes de mudar DNS: validar origem gratuita e limites, configurar metadata/env/OAuth, testar navegação e login no ambiente candidato, reconciliar dados e só então promover o domínio. A base não está publicada no domínio só porque foi enviada a main.

Rollback de código: reverter o commit da fundação preservando o histórico. Rollback de domínio: voltar ao deployment anterior verificado. Não aplicar rollback de banco, pois a fundação não muda seu schema/dados. Preview deverá receber a mesma correção antes de novas promoções.
