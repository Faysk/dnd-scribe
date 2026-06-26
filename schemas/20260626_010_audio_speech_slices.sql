-- DnD Scribe - speech-only audio slices for lower transcription cost.

create table if not exists audio_speech_slices (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  source_file_id uuid references recording_files(id) on delete cascade,
  source_chunk_id uuid not null references audio_chunks(id) on delete cascade,
  track_key text,
  slice_index integer not null,
  start_ms integer not null,
  end_ms integer not null,
  duration_ms integer,
  storage_bucket text not null default 'local',
  storage_path text not null,
  sha256 text,
  audio_rms numeric,
  audio_peak integer,
  audio_dbfs numeric,
  probably_silent boolean,
  silence_dbfs_threshold numeric,
  detection_method text not null default 'ffmpeg_silencedetect',
  detection_params jsonb not null default '{}'::jsonb,
  transcription_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (source_chunk_id, slice_index)
);

create index if not exists idx_audio_speech_slices_session
  on audio_speech_slices(session_id, track_key, start_ms);

create index if not exists idx_audio_speech_slices_chunk
  on audio_speech_slices(source_chunk_id, slice_index);

create index if not exists idx_audio_speech_slices_sha256
  on audio_speech_slices(sha256)
  where sha256 is not null;

create index if not exists idx_audio_speech_slices_transcription_status
  on audio_speech_slices(session_id, transcription_status);

create or replace view audio_transcription_work_units as
select
  'speech_slice'::text as unit_type,
  ss.id,
  ss.session_id,
  ss.source_file_id,
  ss.source_chunk_id,
  ss.track_key,
  ss.slice_index as unit_index,
  ss.start_ms,
  ss.end_ms,
  ss.duration_ms,
  ss.storage_bucket,
  ss.storage_path,
  ss.sha256,
  ss.audio_dbfs,
  ss.probably_silent,
  ss.transcription_status,
  ss.metadata,
  ss.created_at
from audio_speech_slices ss
union all
select
  'chunk'::text as unit_type,
  ac.id,
  ac.session_id,
  ac.source_file_id,
  ac.id as source_chunk_id,
  ac.track_key,
  ac.chunk_index as unit_index,
  ac.start_ms,
  ac.end_ms,
  ac.duration_ms,
  ac.storage_bucket,
  ac.storage_path,
  ac.sha256,
  ac.audio_dbfs,
  ac.probably_silent,
  ac.transcription_status,
  ac.metadata,
  ac.created_at
from audio_chunks ac
where not exists (
  select 1
  from audio_speech_slices ss
  where ss.source_chunk_id = ac.id
);
