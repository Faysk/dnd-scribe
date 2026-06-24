-- Exemplo inicial para modelar segredos e conhecimento no Supabase/Postgres.
-- Não é schema definitivo, é base de discussão.

create type secret_type as enum (
  'private_journal',
  'character_secret',
  'shared_secret',
  'dm_secret',
  'public_canon',
  'outtake'
);

create type canon_status as enum (
  'not_canon',
  'candidate',
  'private_canon',
  'public_canon',
  'interpretation',
  'possible_hook',
  'rejected',
  'archived'
);

create table secrets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  session_id uuid,
  owner_user_id uuid not null,
  owner_character_id uuid,
  title text not null,
  description text not null,
  type secret_type not null,
  canon_status canon_status not null default 'not_canon',
  dm_can_view boolean not null default false,
  can_affect_canon boolean not null default false,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table secret_members (
  id uuid primary key default gen_random_uuid(),
  secret_id uuid not null references secrets(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'viewer',
  can_view boolean not null default true,
  can_edit boolean not null default false,
  can_reveal boolean not null default false,
  unique(secret_id, user_id)
);

create table knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  session_id uuid,
  title text not null,
  fact text not null,
  truth_status canon_status not null,
  source_ref text,
  created_at timestamptz not null default now()
);

create table knowledge_audience (
  id uuid primary key default gen_random_uuid(),
  knowledge_entry_id uuid not null references knowledge_entries(id) on delete cascade,
  user_id uuid,
  character_id uuid,
  npc_name text,
  audience_type text not null, -- system_viewer, character_knows, character_suspects, false_belief
  notes text
);

create table knowledge_reveals (
  id uuid primary key default gen_random_uuid(),
  knowledge_entry_id uuid not null references knowledge_entries(id) on delete cascade,
  revealed_by_user_id uuid,
  revealed_to_user_id uuid,
  revealed_to_character_id uuid,
  session_id uuid,
  source_ref text,
  notes text,
  created_at timestamptz not null default now()
);
