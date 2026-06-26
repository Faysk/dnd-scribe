-- DnD Scribe - expose speech slice work units with absolute session timestamps.

create or replace view audio_transcription_work_units as
select
  'speech_slice'::text as unit_type,
  ss.id,
  ss.session_id,
  ss.source_file_id,
  ss.source_chunk_id,
  ss.track_key,
  ss.slice_index as unit_index,
  ac.start_ms + ss.start_ms as start_ms,
  ac.start_ms + ss.end_ms as end_ms,
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
join audio_chunks ac on ac.id = ss.source_chunk_id
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
