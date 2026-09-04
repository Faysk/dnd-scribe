# 13 — Inventário Supabase e fronteira de dados

Status: **baseline verificado em ambiente real**  
Data da auditoria: **2026-09-04**  
Projeto: **DND Scribe** (`dmrqnbdvbkfqzctcerbx`)

## Objetivo

Registrar o estado real do Supabase que sustenta o DnD Scribe antes da modernização do app público e definir quais partes pertencem à fronteira de dados da migração.

Este documento é somente auditoria. Nenhuma tabela, policy, função ou configuração foi alterada.

---

## 1. Projeto Supabase

Estado observado:

```txt
Nome: DND Scribe
Região: eu-central-2
Status: ACTIVE_HEALTHY
PostgreSQL: 17
```

A modernização preserva Supabase/PostgreSQL como infraestrutura de dados e autenticação.

---

## 2. Visão geral do schema `public`

Todas as tabelas listadas no schema `public` estão com RLS habilitado.

Contagens relevantes observadas no baseline:

| Tabela | Linhas | Papel atual |
| --- | ---: | --- |
| `campaigns` | 1 | campanha |
| `profiles` | 5 | perfis vinculados a auth/mesa |
| `campaign_members` | 4 | membership e role simples da campanha |
| `sessions` | 11 | catálogo e resumos das sessões |
| `participants` | 18 | participantes por sessão |
| `transcript_segments` | 30.857 | transcrição publicada/consultável |
| `publications` | 4 | publicações derivadas |
| `canon_candidates` | 159 | candidatos de canon/revisão |
| `quote_candidates` | 68 | falas candidatas |
| `outtake_candidates` | 75 | bastidores/outtakes |
| `profiles_characters` / `profile_characters` | 3 | vínculo perfil ↔ personagem |
| `permission_catalog` | 23 | catálogo de permissões |
| `role_definitions` | 15 | papéis do sistema |
| `role_permissions` | 48 | permissões por papel |
| `role_assignments` | 16 | atribuições de papéis |
| `entities` | 0 | estrutura futura/experimental já existente |
| `entity_mentions` | 0 | menções futuras/experimentais |

Além disso existem tabelas operacionais de áudio, jobs, cache, Craig, uso de IA, auditoria, Roll20 e integrações.

### Nota de escopo

A existência de `entities`, `entity_mentions` e `profile_characters` NÃO libera as features futuras de personagens/NPC/lore neste roadmap.

Essas estruturas são apenas parte do estado real do banco e serão reavaliadas quando o roadmap de features começar.

---

## 3. Núcleo de leitura do app público

A cadeia principal usada pelo player hoje é conceitualmente:

```txt
campaigns
  ↓
campaign_members / profiles
  ↓
sessions
  ├── participants
  └── transcript_segments
```

O frontend público não consulta essas tabelas diretamente no browser para montar a biblioteca. Ele usa a API server-side existente.

Esse limite é importante para a modernização.

---

## 4. `campaigns`

Campos relevantes observados:

```txt
id uuid PK
name text
slug text UNIQUE
description text nullable
metadata jsonb
created_at timestamptz
```

O frontend atual usa o slug lógico:

```txt
yuhara-main
```

A modernização pode remover o hardcode do componente, mas não precisa transformar multi-campanha em feature nesta etapa.

---

## 5. `profiles`

Campos relevantes:

```txt
id uuid PK
auth_user_id uuid → auth.users
email
avatar_url
display_name
discord_id
discord_handle
roll20_name
default_character_name
metadata
last_sign_in_at
```

Essa tabela é parte da ponte entre identidade autenticada e identidade da mesa.

O novo app não deve duplicar esse conceito em uma segunda tabela de perfil só por causa do framework novo.

---

## 6. `campaign_members`

Campos principais:

```txt
campaign_id
profile_id
role
```

Roles permitidos pelo check atual:

```txt
owner
master
player
reviewer
viewer
```

O frontend público atual utiliza `campaignRole` como uma das decisões de acesso.

A modernização precisa preservar a semântica de “usuário autenticado mas ainda sem membership aprovado”.

---

## 7. Sistema de roles e permissions já existente

Além de `campaign_members.role`, o banco possui um modelo mais granular:

```txt
permission_catalog
role_definitions
role_permissions
role_assignments
dm_tenures
```

Isso demonstra que o backend já possui conceitos de autorização mais ricos que a UI pública atual expõe.

Regra de migração:

> o novo frontend deve consumir capabilities/autorização consolidadas pelo backend em vez de reconstruir lógica de permissão no browser a partir de tabelas internas.

Não duplicar RBAC em componentes React.

---

## 8. `sessions`

Campos relevantes observados:

```txt
id uuid PK
campaign_id uuid
title text
slug text nullable
session_date date
arc text
status text
summary_short text
summary_full text
source_system text
source_session_id text
started_at timestamptz
ended_at timestamptz
duration_ms integer
metadata jsonb
created_at
updated_at
```

Estados aceitos atualmente:

```txt
planned
recording
uploaded
processing
ready_for_review
reviewing
approved
published
archived
failed
```

A página moderna de sessão deve continuar tratando `source_session_id`/identificador publicado com cuidado porque links legados usam esse valor.

---

## 9. `participants`

Campos relevantes:

```txt
session_id
profile_id
player_name
character_name
role
audio_track_label
source_track_key
discord_handle
discord_id
participant_status
character_aliases[]
needs_review
metadata
```

No app público moderno, o número de participantes pode continuar vindo de agregação server-side/API.

A primeira modernização não precisa expor toda essa estrutura ao browser.

---

## 10. `transcript_segments`

A tabela contém atualmente cerca de 30 mil segmentos e é uma das estruturas de volume relevante para o player.

Campos principais para leitura pública:

```txt
id
session_id
participant_id
speaker_profile_id
character_name
speaker_name
speaker_role
start_ms
end_ms
text
source_sequence
track_key
```

Existem diversos campos técnicos/revisão adicionais que não precisam ser serializados para a UI pública.

Regra importante:

> o novo app deve continuar recebendo um DTO reduzido para leitura de transcrição, não um `SELECT *` exposto ao client.

Isso melhora:

- segurança;
- estabilidade de contrato;
- payload;
- independência entre schema operacional e UI.

---

## 11. Publicações e conteúdo derivado

`publications` possui:

```txt
session_id
publication_type
content
format
visibility
status
approved_by
metadata
```

Tipos aceitos incluem:

```txt
recap_short
recap_full
canon_changes
timeline
quotes
outtakes_public
master_notes
player_version
other
```

Isso reforça que o banco já diferencia conteúdo bruto, revisado e publicado.

Na modernização, a UI pública deve continuar consumindo conteúdo aprovado/publicável, sem atalhar a camada de revisão.

---

## 12. Estruturas futuras já presentes, mas congeladas

### `entities`

Existe hoje com zero linhas.

Tipos permitidos:

```txt
pc
npc
location
item
organization
faction
arc
concept
song
quest
other
```

Também já há `visibility` e `summary`.

### `entity_mentions`

Existe com zero linhas e relações possíveis com:

- sessão;
- segmento;
- evento Roll20.

### `profile_characters`

Existe com três vínculos e campos como:

```txt
profile_id
campaign_id
character_name
aliases[]
status
player_note
metadata
```

### Decisão desta auditoria

Essas tabelas NÃO serão expandidas ou remodeladas durante a modernização do frontend.

Quando o roadmap de features começar, elas serão tratadas como material existente a avaliar, não como schema final obrigatório.

---

## 13. RLS: estado observado

Todas as tabelas `public` retornadas pela auditoria possuem:

```txt
rls_enabled = true
```

Porém, o Security Advisor do Supabase reporta em diversas tabelas:

```txt
RLS Enabled No Policy
```

Isso significa, em termos práticos, que RLS está habilitado mas não existe policy direta para roles da Data API nessas tabelas.

Esse estado não deve ser interpretado automaticamente como vulnerabilidade. Em vários casos ele equivale a “nega tudo para acesso direto via Data API”, enquanto o backend server-side usa credenciais/fluxos próprios.

### Consequência para a modernização

A nova aplicação NÃO deve começar a ler tabelas diretamente do browser usando Supabase apenas porque agora estamos usando Next.js.

Fazer isso exigiria uma revisão deliberada de policies e da fronteira de autorização.

Durante a migração, a API existente permanece a fonte canônica de dados do player até decisão posterior.

---

## 14. Security Advisor — pontos de revisão

A auditoria de segurança também retornou warnings para funções `SECURITY DEFINER` executáveis pelo role `authenticated`.

Funções citadas incluem, entre outras:

```txt
access_directory(campaign_slug)
current_profile_id()
has_campaign_role(...)
has_campaign_role_slug(...)
review_profile_claim(...)
review_table_note(...)
submit_profile_claim(...)
table_notes_directory(...)
```

Isso NÃO será alterado neste PR documental.

Antes de adotar acesso direto por RPC no novo app, revisar para cada função:

1. se `EXECUTE` por `authenticated` é intencional;
2. se a função valida escopo internamente;
3. se pode ser `SECURITY INVOKER`;
4. se deveria sair do schema exposto;
5. se o novo app sequer precisa chamá-la diretamente.

Referência do advisor:

https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

---

## 15. Leaked password protection

O Security Advisor também reportou:

```txt
Leaked Password Protection Disabled
```

Como o fluxo principal do app usa OAuth Discord/Google, isso não bloqueia a modernização.

Mesmo assim deve entrar na revisão de segurança da Fase 9 caso autenticação por senha esteja ou venha a estar habilitada.

Referência:

https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

---

## 16. Fronteira de dados aprovada para a migração

Durante as fases iniciais:

```txt
Browser / React Client Components
        ↓
Next Server Components / server layer
        ↓
API pública existente do DnD Scribe
        ↓
Supabase/PostgreSQL
```

Não aprovado nesta etapa:

```txt
Browser
  ↓ direto
Supabase public tables
```

para substituir os contratos de sessão/transcrição existentes.

Isso evita que a modernização do frontend se transforme simultaneamente em redesign de RLS e backend.

---

## 17. Tipos TypeScript

O Supabase suporta geração de tipos TypeScript a partir do schema real.

Quando o bootstrap começar, os tipos gerados podem ser úteis para código server-side e tooling.

Mas é importante separar:

```txt
Database Row Type
≠
Public API DTO
≠
View Model de UI
```

A UI não deve ficar acoplada a todas as colunas do banco.

---

## 18. Implicações para o roadmap futuro

A auditoria revela que o banco já possui embriões de várias ideias futuras:

- entidades;
- personagens associados a perfis;
- visibilidade;
- roles/permissões;
- publicações;
- canon;
- menções.

Isso é positivo, mas não muda o feature freeze.

Quando a modernização estiver 100% encerrada, o próximo roadmap deverá começar com uma auditoria específica dessas estruturas antes de criar migrations novas.

---

## 19. Gate deste inventário

- [x] projeto real identificado;
- [x] região/status/Postgres registrados;
- [x] schema `public` inventariado;
- [x] tabelas principais do player detalhadas;
- [x] RLS habilitado confirmado;
- [x] ausência de policies diretas em várias tabelas registrada;
- [x] Security Advisor consultado;
- [x] funções SECURITY DEFINER sinalizadas para revisão;
- [x] fronteira de dados da migração definida;
- [x] estruturas futuras registradas sem quebrar feature freeze;
- [ ] políticas/RPCs revisadas tecnicamente na Fase 9 antes de qualquer ampliação de acesso direto.

A pendência final é deliberadamente posterior e não bloqueia a documentação da Fase 0.
