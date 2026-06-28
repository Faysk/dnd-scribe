-- DnD Scribe - cleanup readiness for audio artifacts without deleting objects.

update audio_artifacts aa
set
  retention_expires_at = coalesce(aa.retention_expires_at, aa.created_at + policy.expires_after),
  updated_at = now()
from audio_retention_policies policy
where policy.artifact_type = aa.artifact_type
  and policy.expires_after is not null
  and aa.retention_expires_at is null;

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
    coalesce(transcripts.objects, 0) as transcript_source_objects
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
        when base.artifact_type in ('chunk_wav', 'speech_slice_wav')
         and coalesce(base.transcript_source_objects, 0) = 0
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
    when evaluated.artifact_type in ('raw_track_flac', 'raw_track_other') then 'Gerar audio compacto permanente antes de remover a copia bruta.'
    when evaluated.artifact_type in ('chunk_wav', 'speech_slice_wav') then 'Remover somente depois de transcricao validada.'
    when evaluated.retention_class in ('permanent', 'permanent_compact') then 'Manter como acervo permanente.'
    else 'Revisar manualmente antes de qualquer acao destrutiva.'
  end as required_action,
  case
    when cardinality(evaluated.blockers) = 0
     and evaluated.retention_class not in ('permanent', 'permanent_compact', 'legal_hold', 'review_hold')
      then evaluated.size_bytes
    else 0
  end as reclaimable_bytes,
  evaluated.updated_at
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
    'marked_delete_ready_by', '20260628_020_audio_cleanup_readiness',
    'marked_delete_ready_at', now()
  ),
  updated_at = now()
from ready
where aa.id = ready.artifact_id;

insert into audio_artifact_events (artifact_id, event_type, note, payload)
select
  candidate.artifact_id,
  'marked_delete_ready',
  'Marked delete_ready by cleanup readiness policy; no R2 object was deleted.',
  jsonb_build_object(
    'migration', '20260628_020_audio_cleanup_readiness',
    'readiness_status', candidate.readiness_status,
    'artifact_type', candidate.artifact_type,
    'reclaimable_bytes', candidate.reclaimable_bytes
  )
from audio_storage_cleanup_candidates candidate
where candidate.readiness_status = 'delete_ready'
  and not exists (
    select 1
    from audio_artifact_events event
    where event.artifact_id = candidate.artifact_id
      and event.event_type = 'marked_delete_ready'
      and event.payload->>'migration' = '20260628_020_audio_cleanup_readiness'
  );
