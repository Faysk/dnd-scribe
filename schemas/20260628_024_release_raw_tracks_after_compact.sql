-- DnD Scribe - release raw FLAC tracks after compact audio and transcription evidence.

with slice_status as (
  select
    source_chunk_id,
    count(*)::int as total_slices,
    count(*) filter (
      where coalesce(transcription_status, 'pending') not in ('transcribed', 'cached', 'skipped_silence')
    )::int as pending_slices,
    count(*) filter (
      where coalesce(transcription_status, 'pending') in ('transcribed', 'cached')
    )::int as transcribed_slices,
    count(*) filter (
      where coalesce(transcription_status, 'pending') = 'skipped_silence'
    )::int as skipped_slices
  from audio_speech_slices
  group by source_chunk_id
), completed_chunks as (
  select
    ac.id,
    case
      when ss.pending_slices = 0 and ss.transcribed_slices > 0 then 'transcribed'
      when ss.pending_slices = 0 and ss.skipped_slices = ss.total_slices then 'skipped_silence'
      else ac.transcription_status
    end as next_status
  from audio_chunks ac
  join slice_status ss on ss.source_chunk_id = ac.id
  where ss.pending_slices = 0
)
update audio_chunks ac
set
  transcription_status = completed.next_status,
  updated_at = now()
from completed_chunks completed
where completed.id = ac.id
  and completed.next_status <> ac.transcription_status;

with complete_sessions as (
  select
    wu.session_id,
    count(*) filter (
      where coalesce(wu.transcription_status, 'pending') not in ('transcribed', 'cached', 'skipped_silence')
    )::int as pending_units,
    count(*) filter (
      where coalesce(wu.transcription_status, 'pending') in ('transcribed', 'cached', 'skipped_silence')
    )::int as completed_units
  from audio_transcription_work_units wu
  group by wu.session_id
), stale as (
  update processing_jobs pj
  set
    status = 'succeeded',
    error = null,
    finished_at = now(),
    output = coalesce(pj.output, '{}'::jsonb) || jsonb_build_object(
      'workerStatus', 'recovered_stale_transcription_after_completed_work_units',
      'recoveredBy', '20260628_024_release_raw_tracks_after_compact',
      'recoveredAt', now(),
      'recoveryReason', 'job_was_running_after_all_transcription_work_units_completed'
    )
  from complete_sessions complete
  where pj.session_id = complete.session_id
    and pj.job_type = 'transcription_execute'
    and pj.status = 'running'
    and pj.started_at < now() - interval '30 minutes'
    and complete.pending_units = 0
    and complete.completed_units > 0
  returning pj.id
)
insert into processing_job_steps (
  job_id,
  step_key,
  label,
  status,
  attempts,
  retryable,
  order_index,
  progress,
  started_at,
  finished_at,
  created_at,
  updated_at
)
select
  stale.id,
  'stale_transcription_recovery',
  'Recuperar transcricao orfa',
  'succeeded',
  1,
  false,
  95,
  jsonb_build_object(
    'recoveredBy', '20260628_024_release_raw_tracks_after_compact',
    'recoveryReason', 'all_transcription_work_units_completed'
  ),
  now(),
  now(),
  now(),
  now()
from stale
on conflict (job_id, step_key) do update set
  status = excluded.status,
  retryable = excluded.retryable,
  progress = excluded.progress,
  finished_at = excluded.finished_at,
  updated_at = excluded.updated_at;

create or replace view audio_storage_cleanup_candidates
with (security_invoker = true) as
with compact_tracks as (
  select session_id, track_key, count(*)::int objects
  from audio_artifacts
  where artifact_type = 'compact_track_opus'
    and lifecycle_status in ('active', 'planned')
  group by session_id, track_key
), transcript_sources as (
  select session_id, count(*)::int objects
  from audio_artifacts
  where artifact_type = 'transcript_source'
    and lifecycle_status in ('active', 'planned')
  group by session_id
), transcription_evidence as (
  select aa.id artifact_id, count(*)::int objects
  from audio_artifacts aa
  left join audio_speech_slices ss
    on aa.artifact_type = 'speech_slice_wav'
   and ss.session_id = aa.session_id
   and ss.storage_bucket is not distinct from aa.storage_bucket
   and ss.storage_path = aa.storage_path
   and ss.transcription_status in ('transcribed', 'cached', 'skipped_silence')
  left join audio_chunks ac
    on aa.artifact_type = 'chunk_wav'
   and ac.session_id = aa.session_id
   and (
     (aa.source_chunk_id is not null and ac.id = aa.source_chunk_id)
     or (
       aa.source_chunk_id is null
       and ac.storage_bucket is not distinct from aa.storage_bucket
       and ac.storage_path = aa.storage_path
     )
   )
   and ac.transcription_status in ('transcribed', 'cached', 'skipped_silence')
  where aa.artifact_type in ('chunk_wav', 'speech_slice_wav')
    and (ss.id is not null or ac.id is not null)
  group by aa.id
), work_unit_completion as (
  select
    session_id,
    track_key,
    count(*) filter (
      where coalesce(transcription_status, 'pending') not in ('transcribed', 'cached', 'skipped_silence')
    )::int as pending_work_unit_objects,
    count(*) filter (
      where coalesce(transcription_status, 'pending') in ('transcribed', 'cached', 'skipped_silence')
    )::int as completed_work_unit_objects
  from audio_transcription_work_units
  group by session_id, track_key
), base as (
  select
    aa.*,
    c.slug as campaign_slug,
    s.source_session_id,
    s.title as session_title,
    policy.keep_original,
    policy.preferred_codec,
    policy.target_bitrate_kbps,
    policy.delete_when_superseded,
    cmq.quality_status as manifest_quality_status,
    cmq.status as manifest_status,
    cmq.tracks_count as manifest_tracks_count,
    ctes.extraction_status,
    ctes.total_tracks,
    ctes.succeeded_tracks,
    coalesce(compact.objects, 0) as compact_track_objects,
    coalesce(transcripts.objects, 0) as transcript_source_objects,
    coalesce(transcribed.objects, 0) as transcription_evidence_objects,
    coalesce(work_units.pending_work_unit_objects, 0) as pending_work_unit_objects,
    coalesce(work_units.completed_work_unit_objects, 0) as completed_work_unit_objects
  from audio_artifacts aa
  join sessions s on s.id = aa.session_id
  join campaigns c on c.id = s.campaign_id
  left join audio_retention_policies policy on policy.artifact_type = aa.artifact_type
  left join craig_manifest_quality cmq
    on cmq.session_id = aa.session_id
   and (
     cmq.source_recording_file_id = aa.source_file_id
     or aa.artifact_type <> 'craig_zip'
   )
  left join craig_track_extraction_summary ctes
    on ctes.session_id = aa.session_id
   and (
     ctes.source_recording_file_id = aa.source_file_id
     or aa.artifact_type <> 'craig_zip'
   )
  left join compact_tracks compact
    on compact.session_id = aa.session_id
   and compact.track_key is not distinct from aa.track_key
  left join transcript_sources transcripts on transcripts.session_id = aa.session_id
  left join transcription_evidence transcribed on transcribed.artifact_id = aa.id
  left join work_unit_completion work_units
    on work_units.session_id = aa.session_id
   and work_units.track_key is not distinct from aa.track_key
), evaluated as (
  select
    base.*,
    array_remove(array[
      case
        when base.retention_class in ('permanent', 'permanent_compact', 'legal_hold', 'review_hold')
          or coalesce(base.keep_original, false)
          then 'retention_policy_keeps_original'
      end,
      case
        when base.lifecycle_status not in ('active', 'superseded', 'delete_ready')
          then 'lifecycle_not_deletable'
      end,
      case
        when base.retention_expires_at is not null
         and base.retention_expires_at > now()
         and base.retention_class <> 'delete_after_success'
         and not (
           base.artifact_type in ('raw_track_flac', 'raw_track_other')
           and coalesce(base.delete_when_superseded, false)
           and coalesce(base.compact_track_objects, 0) > 0
           and coalesce(base.pending_work_unit_objects, 0) = 0
           and coalesce(base.completed_work_unit_objects, 0) > 0
         )
          then 'retention_window_not_expired'
      end,
      case
        when base.artifact_type = 'craig_zip'
         and not (
           coalesce(base.manifest_tracks_count, 0) > 0
           and coalesce(base.manifest_quality_status, 'critical') <> 'critical'
         )
          then 'manifest_not_ready'
      end,
      case
        when base.artifact_type = 'craig_zip'
         and not (
           coalesce(base.total_tracks, 0) > 0
           and coalesce(base.succeeded_tracks, 0) = coalesce(base.total_tracks, 0)
         )
          then 'tracks_not_fully_extracted'
      end,
      case
        when base.artifact_type in ('raw_track_flac', 'raw_track_other')
         and coalesce(base.compact_track_objects, 0) = 0
          then 'compact_audio_missing'
      end,
      case
        when base.artifact_type in ('raw_track_flac', 'raw_track_other')
         and coalesce(base.compact_track_objects, 0) > 0
         and coalesce(base.pending_work_unit_objects, 0) > 0
          then 'transcription_work_units_pending'
      end,
      case
        when base.artifact_type in ('raw_track_flac', 'raw_track_other')
         and coalesce(base.compact_track_objects, 0) > 0
         and coalesce(base.completed_work_unit_objects, 0) = 0
          then 'transcription_work_units_missing'
      end,
      case
        when base.artifact_type in ('chunk_wav', 'speech_slice_wav')
         and coalesce(base.transcript_source_objects, 0) = 0
         and coalesce(base.transcription_evidence_objects, 0) = 0
          then 'transcript_source_missing'
      end
    ], null) as blockers
  from base
)
select
  evaluated.id as artifact_id,
  evaluated.session_id,
  evaluated.campaign_slug,
  evaluated.source_session_id,
  evaluated.session_title,
  evaluated.source_file_id,
  evaluated.source_chunk_id,
  evaluated.created_by_job_id,
  evaluated.artifact_type,
  evaluated.retention_class,
  evaluated.lifecycle_status,
  evaluated.storage_bucket,
  evaluated.storage_path,
  evaluated.original_filename,
  evaluated.mime_type,
  evaluated.codec,
  evaluated.size_bytes,
  evaluated.duration_ms,
  evaluated.track_key,
  evaluated.retention_expires_at,
  evaluated.delete_reason,
  evaluated.manifest_quality_status,
  evaluated.extraction_status,
  evaluated.total_tracks,
  evaluated.succeeded_tracks,
  evaluated.compact_track_objects,
  evaluated.transcript_source_objects,
  evaluated.blockers,
  case
    when evaluated.retention_class in ('permanent', 'permanent_compact', 'legal_hold', 'review_hold')
      or coalesce(evaluated.keep_original, false)
      then 'hold'
    when cardinality(evaluated.blockers) = 0 then 'delete_ready'
    else 'blocked'
  end as readiness_status,
  case
    when evaluated.artifact_type = 'craig_zip' then 'ZIP Craig original ja pode sair depois que manifest e faixas extraidas estiverem confirmados.'
    when evaluated.artifact_type in ('raw_track_flac', 'raw_track_other')
     and coalesce(evaluated.compact_track_objects, 0) > 0
     and coalesce(evaluated.pending_work_unit_objects, 0) = 0
     and coalesce(evaluated.completed_work_unit_objects, 0) > 0
      then 'Remover FLAC bruto: Opus compacto e transcricao da faixa ja existem.'
    when evaluated.artifact_type in ('raw_track_flac', 'raw_track_other') then 'Gerar audio compacto permanente antes de remover a copia bruta.'
    when evaluated.artifact_type in ('chunk_wav', 'speech_slice_wav') then 'Remover somente depois de transcricao validada ou silencio confirmado.'
    when evaluated.retention_class in ('permanent', 'permanent_compact') then 'Manter como acervo permanente.'
    else 'Revisar manualmente antes de qualquer acao destrutiva.'
  end as required_action,
  case
    when cardinality(evaluated.blockers) = 0
     and evaluated.retention_class not in ('permanent', 'permanent_compact', 'legal_hold', 'review_hold')
      then evaluated.size_bytes
    else 0
  end as reclaimable_bytes,
  evaluated.updated_at,
  evaluated.transcription_evidence_objects,
  evaluated.pending_work_unit_objects,
  evaluated.completed_work_unit_objects
from evaluated;

with ready as (
  select artifact_id
  from audio_storage_cleanup_candidates
  where readiness_status = 'delete_ready'
    and lifecycle_status in ('active', 'superseded')
)
update audio_artifacts aa
set
  lifecycle_status = 'delete_ready',
  delete_reason = coalesce(aa.delete_reason, 'cleanup_readiness_policy'),
  metadata = coalesce(aa.metadata, '{}'::jsonb) || jsonb_build_object(
    'marked_delete_ready_by', '20260628_024_release_raw_tracks_after_compact',
    'marked_delete_ready_at', now()
  ),
  updated_at = now()
from ready
where aa.id = ready.artifact_id;

insert into audio_artifact_events (artifact_id, event_type, note, payload)
select
  candidate.artifact_id,
  'marked_delete_ready',
  'Marked delete_ready after compact track and transcription evidence; no R2 object was deleted.',
  jsonb_build_object(
    'migration', '20260628_024_release_raw_tracks_after_compact',
    'readiness_status', candidate.readiness_status,
    'artifact_type', candidate.artifact_type,
    'reclaimable_bytes', candidate.reclaimable_bytes,
    'pendingWorkUnitObjects', candidate.pending_work_unit_objects,
    'completedWorkUnitObjects', candidate.completed_work_unit_objects,
    'compactTrackObjects', candidate.compact_track_objects
  )
from audio_storage_cleanup_candidates candidate
where candidate.readiness_status = 'delete_ready'
  and not exists (
    select 1
    from audio_artifact_events event
    where event.artifact_id = candidate.artifact_id
      and event.event_type = 'marked_delete_ready'
      and event.payload->>'migration' = '20260628_024_release_raw_tracks_after_compact'
  );
