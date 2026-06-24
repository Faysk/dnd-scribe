# 09 — Modelo de Dados Supabase

## Objetivo

Criar uma base relacional e auditável para sessões, arquivos, transcrições, eventos, candidatos e publicações.

## Entidades principais

```txt
campaigns
profiles
campaign_members
sessions
participants
recording_files
audio_chunks
transcript_segments
roll20_events
session_markers
segment_classifications
canon_candidates
quote_candidates
outtake_candidates
review_decisions
entities
entity_mentions
publications
audit_log
```

## Campanhas

Guarda a campanha principal.

Campos:

- id
- name
- slug
- description
- created_at

## Profiles

Usuários do sistema.

Campos:

- id
- display_name
- discord_id
- roll20_name
- default_character_name
- created_at

## Campaign members

Controle de permissão por campanha.

Roles:

```txt
owner
master
player
reviewer
viewer
```

## Sessions

Representa uma sessão.

Campos principais:

- title
- session_date
- arc
- status
- summary_short
- summary_full
- created_by

Status:

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
```

## Recording files

Arquivos da sessão.

Tipos:

```txt
craig_track
craig_info
obs_backup
roll20_chat
discord_log
manual_notes
transcript_raw
processed_json
publication
```

## Transcript segments

Cada trecho transcrito.

Campos:

- session_id
- speaker_user_id
- character_name
- source_file_id
- start_ms
- end_ms
- text
- raw_confidence

## Roll20 events

Eventos vindos do Roll20.

Tipos:

```txt
scene
canon_marker
quote_marker
ooc_marker
roll
combat_start
combat_end
turn_change
page_change
sync
```

## Session markers

Marcadores vindos de Craig, Discord, Roll20 ou site.

Campos:

- source
- marker_type
- text
- approx_start_ms
- created_by

## Segment classifications

Resultado da IA ao classificar segmentos.

Campos:

- segment_id
- segment_type
- canon_relevance
- confidence
- needs_review
- reason

## Canon candidates

Fatos candidatos a canon.

Campos:

- title
- claim
- candidate_type
- status
- confidence
- related_entities
- source_segment_ids
- source_roll20_event_ids
- reviewer_notes
- approved_by
- approved_at

## Quote candidates

Falas marcantes.

Campos:

- quote_text
- character_name
- speaker_user_id
- context
- status
- approved_for_public

## Outtake candidates

Bastidores/cortes.

Campos:

- title
- description
- start_ms
- end_ms
- sensitivity_level
- status
- approved_by_all

## Entities

NPCs, lugares, itens, organizações, conceitos.

Tipos:

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
```

## Publications

Materiais gerados.

Tipos:

```txt
recap_short
recap_full
canon_changes
timeline
quotes
outtakes_public
master_notes
player_version
```

## Audit log

Tudo que for aprovado/rejeitado/corrigido deve gerar log.

Campos:

- action
- table_name
- record_id
- old_value
- new_value
- actor_id
- created_at

## SQL

Veja o arquivo:

```txt
schemas/database_schema.sql
```
