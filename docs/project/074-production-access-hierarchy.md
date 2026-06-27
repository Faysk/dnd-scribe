# 074 - Production access hierarchy

Data: 2026-06-27

## Decisao de produto

O fluxo correto para vincular login, jogador, Discord e personagens e:

1. Jogador entra com Google.
2. Jogador solicita vinculo com um perfil existente ou pede criacao de novo perfil.
3. Jogador informa nick Roll20/Craig, Discord ID/handle, personagens e nota para o DM.
4. DM aprova ou rejeita.
5. Ao aprovar, o sistema vincula `auth_user_id` ao `profile`, registra personagens e tenta ligar participantes da sessao por Roll20/Discord.

O DM continua sendo a autoridade final de canon e acesso narrativo. Jogador pode sugerir o proprio vinculo e personagens, mas isso nao vira verdade operacional sem aprovacao do DM.

## Hierarquia

- `owner`: operador tecnico/manutencao do sistema.
- `master`: DM; aprova canon, vinculos, bastidores e alteracoes sensiveis.
- `player`: jogador; revisa o proprio material e solicita vinculos/personagens.
- `reviewer`: ajuda revisao de mesa, sem bater martelo de canon.
- `viewer`: leitura controlada.

## Banco

Migração aplicada:

- `access_claims_model`

Criado/adicionado:

- `profiles.discord_handle`
- `profile_characters`
- `profile_claims`
- `current_profile_id()`
- `has_campaign_role(uuid, text[])`
- `access_directory(text)`
- `submit_profile_claim(...)`
- `review_profile_claim(...)`

RLS foi ligado nas tabelas novas:

- `profile_characters`
- `profile_claims`

As tabelas existentes ainda continuam sem RLS total nesta etapa, porque ligar RLS em tudo de uma vez pode bloquear producao. O hardening completo fica como uma etapa explicita com janela de teste.

## Front

Arquivos adicionados:

- `web/access.js`
- `web/access.css`

`web/index.html` agora carrega esses assets e a UI injeta a aba `Acesso` no app.

## Estado dos perfis

Perfis conhecidos:

- Yuhara / `renanyuhara` / DM: perfil existe, login Google ainda nao vinculado.
- Renan / `faysk` / Dandelion: perfil ja vinculado ao Google.
- Arthur / `arutorux` / Astel: perfil existe, login pendente.
- Fernanda / `sunnrq` / Screacky: perfil existe, login pendente.
- Random / `thomaz_17590`: perfil convidado, sem papel fixo.

Personagens iniciais registrados em `profile_characters`:

- Dandelion
- Astel
- Screacky

## Bootstrap do DM

Para o DM aprovar vinculos pela interface, primeiro o perfil do Yuhara precisa ser vinculado ao Google real dele.

Fluxo seguro:

1. Yuhara entra com Google no site.
2. Abre a aba `Acesso`.
3. Seleciona o perfil `Yuhara - renanyuhara`.
4. Envia a solicitacao.
5. Um operador com acesso ao banco aprova a primeira solicitacao ou executa um bootstrap controlado.
6. Depois disso, Yuhara aprova os proximos jogadores pelo proprio site.

Nao foi implementada auto-aprovacao de DM porque qualquer pessoa poderia tentar se declarar Yuhara se soubesse os dados publicos do perfil.

## Proxima etapa de seguranca

Antes de abrir para todos os jogadores, fazer hardening em duas partes:

1. API Vercel exigir login e role para rotas sensiveis.
2. RLS nas tabelas existentes com politicas ou acesso exclusivamente por RPC/backend.

A tentativa de ligar RLS em todas as tabelas foi bloqueada pela revisao automatica por risco de blast radius. A decisao certa e fazer isso em uma etapa isolada, com teste de health, sessoes, upload e jobs imediatamente depois.
