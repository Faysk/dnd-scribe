-- DnD Scribe — Supabase/Postgres schema MVP
-- Este schema é uma base inicial. Ajustar nomes, RLS e indexes conforme implementação.

create extension if not exists "pgcrypto";

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  created_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key,
  display_name text not null,
  discord_id text,
  roll20_name text,
  default_character_name text,
  created_at timestamptz default now()
);

create table if not exists campaign_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('owner','master','player','reviewer','viewer')),
  created_at timestamptz default now(),
  unique (campaign_id, profile_id)
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  title text not null,
  slug text,
  session_date date,
  arc text,
  status text not null default 'planned' check (status in (
    'planned','recording','uploaded','processing','ready_for_review','reviewing','approved','published','archived','failed'
  )),
  summary_short text,
  summary_full text,
  consent_confirmed boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  profile_id uuid references profiles(id),
  player_name text,
  character_name text,
  role text default 'player',
  audio_track_label text,
  created_at timestamptz default now()
);

create table if not exists recording_files (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  participant_id uuid references participants(id),
  file_type text not null check (file_type in (
    'craig_track','craig_info','obs_backup','roll20_chat','discord_log','manual_notes','transcript_raw','processed_json','publication','other'
  )),
  storage_bucket text not null,
  storage_path text not null,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  duration_ms integer,
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists processing_jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','retrying','cancelled')),
  attempts integer default 0,
  input jsonb,
  output jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists audio_chunks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  source_file_id uuid not null references recording_files(id) on delete cascade,
  chunk_index integer not null,
  start_ms integer not null,
  end_ms integer not null,
  storage_bucket text,
  storage_path text,
  transcription_status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists transcript_segments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  speaker_profile_id uuid references profiles(id),
  participant_id uuid references participants(id),
  character_name text,
  source_file_id uuid references recording_files(id),
  source_chunk_id uuid references audio_chunks(id),
  start_ms integer not null,
  end_ms integer not null,
  text text not null,
  raw_confidence numeric,
  language text default 'pt',
  created_at timestamptz default now()
);

create index if not exists idx_transcript_segments_session_time on transcript_segments(session_id, start_ms);
create index if not exists idx_transcript_segments_text on transcript_segments using gin (to_tsvector('portuguese', text));

create table if not exists roll20_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  event_type text not null,
  roll20_who text,
  character_name text,
  approx_start_ms integer,
  text text,
  payload jsonb,
  raw_line text,
  created_at timestamptz default now()
);

create index if not exists idx_roll20_events_session_time on roll20_events(session_id, approx_start_ms);

create table if not exists session_markers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  source text not null check (source in ('craig','discord','roll20','site','manual','audio_detected')),
  marker_type text not null,
  text text,
  approx_start_ms integer,
  created_by uuid references profiles(id),
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists segment_classifications (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references transcript_segments(id) on delete cascade,
  segment_type text not null,
  canon_relevance text default 'none' check (canon_relevance in ('none','low','medium','high')),
  confidence numeric,
  needs_review boolean default false,
  reason text,
  model text,
  prompt_version text,
  created_at timestamptz default now()
);

create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text not null,
  slug text,
  entity_type text not null check (entity_type in ('pc','npc','location','item','organization','faction','arc','concept','song','quest','other')),
  status text default 'active',
  visibility text default 'private_players' check (visibility in ('private_master','private_players','review_only','public_campaign','public_web')),
  summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (campaign_id, name)
);

create table if not exists entity_mentions (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  segment_id uuid references transcript_segments(id) on delete set null,
  roll20_event_id uuid references roll20_events(id) on delete set null,
  mention_text text,
  confidence numeric,
  created_at timestamptz default now()
);

create table if not exists canon_candidates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  title text not null,
  claim text not null,
  candidate_type text not null default 'event',
  status text not null default 'candidate' check (status in (
    'candidate','approved_canon','rejected','interpretation','possible_hook','retcon_pending','private','published'
  )),
  confidence numeric,
  related_entity_ids uuid[],
  source_segment_ids uuid[],
  source_roll20_event_ids uuid[],
  reviewer_notes text,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists quote_candidates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  quote_text text not null,
  character_name text,
  speaker_profile_id uuid references profiles(id),
  context text,
  status text not null default 'candidate' check (status in ('candidate','approved','rejected','private','published')),
  approved_for_public boolean default false,
  source_segment_ids uuid[],
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists outtake_candidates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  title text,
  description text,
  start_ms integer,
  end_ms integer,
  sensitivity_level text default 'normal' check (sensitivity_level in ('normal','needs_speaker_approval','private','sensitive')),
  status text not null default 'candidate' check (status in ('candidate','approved_by_speaker','approved_by_all','rejected','private','published')),
  source_segment_ids uuid[],
  approved_by uuid[],
  created_at timestamptz default now()
);

create table if not exists review_decisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  target_table text not null,
  target_id uuid not null,
  decision text not null,
  notes text,
  decided_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists publications (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  publication_type text not null check (publication_type in (
    'recap_short','recap_full','canon_changes','timeline','quotes','outtakes_public','master_notes','player_version','other'
  )),
  title text,
  content text not null,
  format text default 'markdown',
  visibility text default 'private_players' check (visibility in ('private_master','private_players','review_only','public_campaign','public_web')),
  status text default 'draft' check (status in ('draft','approved','published','archived')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  actor_id uuid references profiles(id),
  action text not null,
  table_name text,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz default now()
);
