-- DnD Scribe - local Craig ingest extensions.
-- Complements the MVP schema with stable source identifiers used by local imports.

create extension if not exists "pgcrypto";

alter table campaigns
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table profiles
  add column if not exists source_system text,
  add column if not exists source_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists idx_profiles_discord_id_unique
  on profiles(discord_id)
  where discord_id is not null;

create unique index if not exists idx_profiles_source_unique
  on profiles(source_system, source_key)
  where source_system is not null and source_key is not null;

alter table sessions
  add column if not exists source_system text,
  add column if not exists source_session_id text,
  add column if not exists started_at timestamptz,
  add column if not exists duration_ms integer,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists idx_sessions_campaign_source_unique
  on sessions(campaign_id, source_system, source_session_id)
  where source_system is not null and source_session_id is not null;

alter table participants
  add column if not exists source_track_key text,
  add column if not exists discord_handle text,
  add column if not exists discord_id text,
  add column if not exists participant_status text,
  add column if not exists character_aliases text[] not null default '{}'::text[],
  add column if not exists needs_review boolean not null default false,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists idx_participants_session_track_unique
  on participants(session_id, source_track_key)
  where source_track_key is not null;

alter table recording_files
  add column if not exists source_system text,
  add column if not exists source_file_role text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists idx_recording_files_session_bucket_path_unique
  on recording_files(session_id, storage_bucket, storage_path);

alter table audio_chunks
  add column if not exists track_key text,
  add column if not exists source_chunk_name text,
  add column if not exists duration_ms integer,
  add column if not exists size_bytes bigint,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists idx_audio_chunks_session_track_index_unique
  on audio_chunks(session_id, track_key, chunk_index)
  where track_key is not null;

alter table transcript_segments
  add column if not exists source_segment_id text,
  add column if not exists source_sequence integer,
  add column if not exists track_key text,
  add column if not exists speaker_name text,
  add column if not exists speaker_role text,
  add column if not exists source_chunk_path text,
  add column if not exists response_path text,
  add column if not exists chunk_index integer,
  add column if not exists text_chars integer,
  add column if not exists text_words integer,
  add column if not exists is_empty boolean not null default false,
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_status text not null default 'pending',
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists idx_transcript_segments_session_source_unique
  on transcript_segments(session_id, source_segment_id)
  where source_segment_id is not null;

create index if not exists idx_transcript_segments_session_track_chunk
  on transcript_segments(session_id, track_key, chunk_index);
