# Etapa 075 — Hardening de login e hierarquia em produção

Data: 2026-06-27

## Objetivo

Transformar o login Google em controle real de acesso para produção, mantendo a regra da mesa:

- DM (`master`) bate o martelo final de canon, publicações e vínculos de jogadores.
- Owner técnico (`owner`) consegue operar infraestrutura, mas a autoridade narrativa continua documentada como DM.
- Jogador (`player`) solicita vínculo do próprio login com perfil, Discord e personagens.
- Reviewer (`reviewer`) pode ajudar na triagem, sem aprovar canon final.
- Viewer (`viewer`) pode ler áreas liberadas, quando existir tela própria para isso.

## O que foi implementado nesta etapa

1. Criada a função Supabase `public.has_campaign_role_slug(campaign_slug text, allowed_roles text[])`.
2. Essa função valida o usuário autenticado via `auth.uid()` contra `profiles.auth_user_id` e `campaign_members.role`.
3. Criado `web/auth-fetch.js` para anexar `Authorization: Bearer <token Supabase>` automaticamente nas chamadas same-origin `/api/*` quando houver sessão Google ativa.
4. `web/index.html` passou a carregar `/auth-fetch.js` antes do app principal.
5. `npm run check:web` passou a validar também `web/auth-fetch.js`.

## Decisão de segurança

A proteção forte por `middleware.js` foi desenhada, mas não aplicada ainda. O revisor automático bloqueou a mudança porque ela passaria a exigir papéis em rotas críticas de produção antes de termos validação visual completa com usuários vinculados. O risco correto é: se o middleware entrar antes do bootstrap do DM e dos jogadores, o site pode carregar a página pública, mas bloquear sessões, áudio, jobs e ações de review.

Portanto, esta etapa deixou a base pronta para a trava sem mudar o comportamento do backend ainda.

## Política planejada para a próxima aprovação

Rotas públicas:

- `GET /api/health`
- `GET /api/auth-config`
- `GET /api/auth/me`

Rotas para qualquer perfil vinculado à campanha:

- `GET /api/sessions`

Rotas para DM, owner ou reviewer:

- `GET /api/session`
- `GET /api/audio-url`
- `GET /api/review-template`

Rotas somente DM ou owner:

- `GET /api/jobs`
- `GET /api/craig-map`
- `POST /api/uploads/craig-url`
- `POST /api/uploads/craig-complete`
- `POST /api/sessions/create`
- `POST /api/sessions/update`
- `POST /api/review-decisions/apply`
- `POST /api/publications/rebuild`
- `POST /api/craig-map/update`

## Bootstrap do DM

Yuhara ainda precisa entrar com Google e enviar a solicitação de vínculo na aba `Acesso`, escolhendo o perfil `Yuhara / renanyuhara / DM`.

Como ninguém deve conseguir se declarar DM sozinho, o primeiro vínculo do DM precisa ser aprovado por operador via banco ou por uma rotina bootstrap específica. Depois disso, o próprio DM aprova os demais vínculos pelo site.

## Próximas 10 etapas

1. Fazer Yuhara entrar com Google e criar a claim de vínculo com o perfil DM.
2. Aprovar a primeira claim de DM via banco com auditoria registrada.
3. Testar `/auth/me` e aba `Acesso` com o DM já vinculado.
4. Testar jogador sem vínculo: deve conseguir logar e solicitar vínculo, mas não operar conteúdo sensível.
5. Testar jogador vinculado: deve aparecer como player e acessar apenas telas liberadas.
6. Aplicar o middleware de papel em produção com aprovação explícita.
7. Validar anon: `/api/sessions`, `/api/session`, `/api/audio-url` e POSTs devem retornar 401/403.
8. Validar DM: upload Craig, criação/edição de sessão, aplicar decisões e rebuild de publicações devem funcionar.
9. Desenhar filtros por jogador para material próprio antes de liberar transcript completo para `player`.
10. Só depois ativar RLS nas tabelas antigas com políticas por papel, em migrações pequenas e reversíveis.
