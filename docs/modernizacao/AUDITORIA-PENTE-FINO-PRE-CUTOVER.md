# Auditoria pente-fino pré-cutover — modernização

Data: 2026-09-05  
Escopo: PR #40 (`modernizacao/resumos-publicos`) e superfícies críticas da modernização antes de homologação/cutover.

## Resultado executivo

**Status técnico do código auditado: APROVADO PARA MERGE DO PR #40, condicionado aos checks do commit final permanecerem verdes.**

O cutover de `dnd.faysk.dev` continua fora deste PR e ainda depende da homologação operacional/final prevista no roadmap.

A política de acesso validada é:

| Superfície | Visitante | Logado sem membership | Membro aprovado |
|---|---:|---:|---:|
| Home | ✅ | ✅ | ✅ |
| Arquivo de sessões publicadas | ✅ | ✅ | ✅ |
| Resumo completo publicado | ✅ | ✅ | ✅ |
| Transcrição | ❌ | ❌/pendente | ✅ |
| Download/material bruto | ❌ | ❌/pendente | ✅ |
| Ferramentas internas | ❌ | conforme role | conforme role |

Princípio: **memória editorial publicada é pública; material operacional/bruto continua privado e autorizado por role/membership.**

## 1. Gate de qualidade

No commit auditado antes deste relatório (`1c681b05abede3cbf009db9dbe343b17c552616d`):

- CI legado: ✅
- Web Next CI: ✅
- Typecheck: ✅
- Lint: ✅
- Unit tests: ✅
- Build Next: ✅
- Auditoria de bundle client: ✅
- Medição de bundle: ✅
- Playwright Chromium/Firefox/WebKit desktop: ✅
- Playwright mobile Chromium/WebKit: ✅
- E2E parity smoke: ✅
- Preview Vercel: ✅ READY

O commit deste relatório deve repetir os checks obrigatórios antes do merge.

## 2. Vercel / infraestrutura

### Corrigido

O projeto legado excedia o limite Hobby de 12 Serverless Functions. Foram removidos wrappers redundantes que apenas delegavam para `api/[...path].js`, preservando as rotas e suas checagens de autorização.

Resultado:

- antes: 13 funções;
- depois: **7 funções**;
- folga atual: **5 funções** dentro do teto Hobby.

Rotas consolidadas no catch-all:

- `/api/auth/me`;
- `/api/ingest/craig`;
- `/api/publications/rebuild`;
- `/api/review-decisions/apply`;
- `/api/sessions/create`;
- `/api/sessions/update`.

O Preview do commit `1c681b05...` ficou `READY` com `lambdaRuntimeStats.nodejs = 7`.

### Toolchain

Foi eliminado drift entre CI e Vercel:

- Node: `24.x`;
- pnpm: `11.25.0` fixado em `packageManager`;
- CI e Vercel passam a usar a mesma versão de pnpm.

## 3. Memória pública — minimização de dados

O endpoint público `GET /api/public-library` foi auditado e endurecido.

### Permitido publicamente

- `sourceSessionId`;
- `title`;
- `sessionDate`;
- `arc`;
- `summary`;
- `hasSummary`;
- `coverImageUrl`;
- `heroImageUrl`;
- `summaryFull` somente no detalhe da sessão.

### Explicitamente não exposto

- transcrição;
- segmentos;
- participantes;
- contagens de falas;
- duração;
- IDs internos do banco;
- metadata bruta;
- timestamps operacionais como `updatedAt`.

A consulta pública exige:

- campanha `yuhara-main`;
- `status = 'published'`;
- parâmetros SQL bindados;
- retorno por allowlist.

### Limites alinhados servidor/cliente

- catálogo: 500 sessões;
- resumo curto: 4.000 caracteres;
- resumo completo: 200.000 caracteres;
- `sourceSessionId`: 220 caracteres;
- URL de arte: 2.048 caracteres.

A medição do banco mostrou que o maior resumo publicado no momento tem aproximadamente 64,8 mil caracteres, portanto 200 mil mantém margem ampla sem aceitar payload editorial de 1 MB.

## 4. Banco / Supabase

Projeto auditado: DND Scribe.

### Tabelas sensíveis

Foram inspecionadas:

- `sessions`;
- `transcript_segments`;
- `participants`;
- `campaign_members`;
- `profiles`.

Resultado:

- RLS habilitado: ✅;
- nenhum grant direto para `anon`: ✅;
- nenhum grant direto de tabela para `authenticated`: ✅;
- acesso de serviço permanece restrito a `postgres`/`service_role` conforme ACL.

Isso confirma que tornar resumos públicos **não abriu leitura direta das tabelas sensíveis no browser**.

### SECURITY DEFINER

Os advisors sinalizam funções `SECURITY DEFINER`. As funções analisadas possuem ACL restrita e checagens internas de `auth.uid()`/roles para os fluxos de claim/review/diretório.

Decisão desta auditoria: **não alterar automaticamente**. Revogar ou converter sem redesenho de autorização poderia quebrar fluxos legítimos. Manter como item de hardening futuro com testes específicos de privilégio.

### Outros advisors

- leaked-password protection: aviso existente; baixa relevância enquanto o fluxo de login permanecer OAuth-only, mas deve ser reavaliado se email/senha for habilitado;
- FKs sem índice/índices pouco usados: registrar como higiene/performance do legado, sem criar índices às cegas antes de evidência de workload.

## 5. Auth / autorização

### Validado

- redirect pós-login aceita somente caminho interno seguro;
- caminhos `//...`/origens externas são rejeitados;
- transcrição canônica usa rota privada e exige token antes do proxy;
- rota legada de transcript delega para o boundary privado;
- download exige token e não devolve erro interno bruto ao cliente;
- membership/role permanece validado no backend legado;
- usuário autenticado sem membership não perde acesso aos resumos públicos.

## 6. Gateway / cutover reversível

Validado:

- namespace canônico do BFF Next em `/api/web/*`;
- fallbacks legados permanecem explícitos e estreitos;
- origem legada exige HTTPS;
- self-loop para `dnd.faysk.dev` é rejeitado;
- URL com credenciais/path/query/hash é rejeitada;
- assets históricos recebem fallback apenas no namespace necessário.

O cutover do domínio não foi realizado nesta auditoria.

## 7. Arte e conteúdo não confiável

URLs de arte passam por normalização HTTPS + allowlist de hosts:

- `dmrqnbdvbkfqzctcerbx.supabase.co`;
- `dnd.faysk.dev`;
- `raw.githubusercontent.com`.

Markdown usa o renderer sanitizado existente; testes de Markdown/security permanecem verdes.

## 8. Headers / segurança web

Ativos no Next:

- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `X-Frame-Options: DENY`;
- `Permissions-Policy` restritiva;
- `Cross-Origin-Opener-Policy: same-origin`.

### CSP

Não há CSP completa neste momento. Não foi adicionada uma policy genérica durante o pente-fino porque uma CSP robusta para Next/Supabase deve ser desenhada com nonce/hash e validada contra todos os fluxos; uma policy permissiva apenas para “marcar checkbox” teria pouco valor.

Classificação: **hardening futuro, não blocker do PR #40**.

## 9. Performance / build

- Home e `/sessoes` são dinâmicos de propósito;
- isso evita fetch da API pública durante `next build`;
- sessões recém-publicadas aparecem sem exigir redeploy do frontend;
- prefetch custoso já foi reduzido em fase anterior;
- bundle segue auditado no CI;
- conteúdo público pode usar cache CDN curto (`s-maxage=60`, `stale-while-revalidate=300`);
- rotas privadas continuam dependentes de auth/token e não usam o contrato público.

## 10. Acessibilidade

Corrigido durante a auditoria:

- bridge de hash legado passou a testar o boundary privado atual em vez de copy antiga;
- skip link foi estabilizado no WebKit: hash/history é atualizado antes e o foco no `#content` ocorre por último;
- matriz multi-browser/multi-viewport voltou a passar integralmente.

## 11. Achado editorial pré-cutover

**Requer revisão humana antes de tornar o arquivo público em produção.**

A sessão publicada de **15/08/2026 — “O Gato Prometido e o Coração-Raiz”** possui `summary_short` com texto de bastidor/conversa editorial (incluindo comentário sobre “O Passado de Poppe” e uma frase jocosa), em vez de uma descrição pública limpa da sessão.

Classificação:

- segurança: não crítico;
- código: não blocker;
- qualidade editorial pública: **blocker de conteúdo para o cutover**.

Não foi alterado automaticamente nesta auditoria para não reescrever conteúdo editorial de produção sem revisão humana.

## 12. Riscos aceitos / backlog de hardening

Não bloqueiam o merge do PR #40:

1. desenhar CSP com nonce/hash e testes;
2. revisar periodicamente funções `SECURITY DEFINER` e privilégios mínimos;
3. ligar leaked-password protection se autenticação por senha entrar no escopo;
4. revisar FKs/índices com métricas reais após estabilização;
5. manter contagem de funções Vercel abaixo do teto Hobby com margem;
6. benchmark autenticado e homologação humana permanecem gates das fases finais do roadmap, não deste PR isoladamente.

## 13. Checklist GO / NO-GO

### Para merge do PR #40

- [x] política público/privado implementada;
- [x] endpoint público minimizado;
- [x] transcrição/download continuam privados;
- [x] RLS/ACL sensíveis auditados;
- [x] redirects/auth boundaries auditados;
- [x] Vercel abaixo do limite de funções;
- [x] toolchain CI/Vercel alinhada;
- [x] CI legado verde no commit pré-relatório;
- [x] Web Next CI verde no commit pré-relatório;
- [x] Preview Vercel READY no commit pré-relatório;
- [ ] checks do commit final deste relatório verdes.

### Para cutover de `dnd.faysk.dev`

- [ ] sanear o `summary_short` editorial da sessão 15/08/2026;
- [ ] executar homologação humana/visual prevista no roadmap;
- [ ] validar OAuth/membership com sessão real no Release Candidate;
- [ ] concluir benchmark autenticado pendente, se ainda aplicável ao gate formal;
- [ ] executar smoke RC contra o Preview final;
- [ ] registrar evidência de rollback/cutover;
- [ ] só então mover o domínio e iniciar janela de estabilização.

## Conclusão

A modernização ficou materialmente mais segura e previsível após o pente-fino: menos funções serverless, toolchain determinística, contrato público menor, limites coerentes, E2E estável e boundaries público/privado confirmados.

**O PR #40 pode ser mergeado quando o commit final repetir os checks verdes. O domínio de produção deve continuar no legado até a homologação/cutover formal.**
