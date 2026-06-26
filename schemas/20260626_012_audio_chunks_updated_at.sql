-- DnD Scribe - keep audio chunk status updates timestamped.

alter table audio_chunks
  add column if not exists updated_at timestamptz default now();
