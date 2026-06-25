-- DnD Scribe v3 — modelo inicial simplificado
-- Ideia: separar visibilidade do sistema e conhecimento narrativo.

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key, -- auth.users.id
  display_name text not null,
  email text,
  created_at timestamptz default now()
);

create table campaign_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null check (role in ('dm','player','viewer','admin')),
  player_name text not null,
  character_name text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  title text not null,
  arc text,
  session_date date,
  status text default 'draft',
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table session_files (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  file_type text not null, -- craig_track, obs_backup, roll20_chat, craig_info, transcript_json
  storage_path text not null,
  owner_user_id uuid references profiles(id),
  visibility text not null default 'dm_only',
  created_at timestamptz default now()
);

create table transcript_segments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  speaker_user_id uuid references profiles(id),
  character_name text,
  start_ms integer not null,
  end_ms integer not null,
  text text not null,
  segment_type text,
  access_policy text not null default 'party',
  owner_user_id uuid references profiles(id),
  visible_user_ids uuid[] default '{}',
  fiction_knows text[] default '{}',
  tags text[] default '{}',
  created_at timestamptz default now()
);

create table secrets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  title text not null,
  body text not null,
  secret_type text not null, -- private_journal, character_secret, shared_secret, dm_secret
  access_policy text not null, -- owner_only, owner_dm, shared, dm_only, party
  owner_user_id uuid references profiles(id),
  visible_user_ids uuid[] default '{}',
  fiction_knows text[] default '{}',
  canon_status text default 'not_canon',
  can_affect_canon boolean default false,
  source_segment_ids uuid[] default '{}',
  reveal_state text default 'hidden',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table canon_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  title text not null,
  body text not null,
  canon_status text not null default 'candidate',
  access_policy text not null default 'party',
  owner_user_id uuid references profiles(id),
  visible_user_ids uuid[] default '{}',
  fiction_knows text[] default '{}',
  source_segment_ids uuid[] default '{}',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

create table review_decisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  reviewer_user_id uuid references profiles(id),
  decision text not null,
  notes text,
  created_at timestamptz default now()
);

-- RLS real deve usar funções auxiliares para verificar membership/campaign role.
-- Exemplo conceitual:
-- owner_only: auth.uid() = owner_user_id OR is_campaign_dm(campaign_id, auth.uid())
-- owner_dm: auth.uid() = owner_user_id OR is_campaign_dm(campaign_id, auth.uid())
-- shared: auth.uid() = any(visible_user_ids) OR is_campaign_dm(campaign_id, auth.uid())
-- dm_only: is_campaign_dm(campaign_id, auth.uid())
-- party: is_campaign_member(campaign_id, auth.uid())
