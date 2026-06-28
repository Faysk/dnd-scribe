-- DnD Scribe - tighten Craig manifest temporal quality rules.

update craig_manifests
set
  status = case
    when tracks_count <= 0 then 'invalid'
    when started_at is null
      or logical_date is null
      or duration_ms is null
      or duration_source is null
      or duration_source = 'pending_track_duration'
      then 'warning'
    else 'valid'
  end,
  validation_errors = (
    select coalesce(jsonb_agg(error_key), '[]'::jsonb)
    from (
      select 'manifest_without_flac_tracks'::text error_key where tracks_count <= 0
      union all select 'missing_start_time' where started_at is null
      union all select 'missing_logical_date' where logical_date is null
      union all select 'duration_pending' where duration_ms is null or duration_source is null or duration_source = 'pending_track_duration'
      union all select 'missing_participants' where participants_count <= 0
    ) errors
  ),
  updated_at = now();

create or replace view craig_manifest_quality as
select
  c.slug as campaign_slug,
  s.source_session_id,
  s.title as session_title,
  cm.session_id,
  cm.source_recording_file_id,
  cm.status,
  cm.recording_id,
  cm.logical_date,
  cm.started_at,
  cm.ended_at,
  cm.crosses_midnight,
  cm.duration_ms,
  cm.duration_source,
  cm.zip_object_size,
  cm.zip_entries,
  cm.tracks_count,
  cm.participants_count,
  cm.validation_errors,
  case
    when cm.status = 'invalid' then 'critical'
    when cm.tracks_count = 0 then 'critical'
    when cm.status = 'warning' then 'attention'
    when cm.started_at is null or cm.logical_date is null then 'attention'
    when cm.participants_count = 0 then 'attention'
    else 'ok'
  end as quality_status,
  cm.updated_at
from craig_manifests cm
join sessions s on s.id = cm.session_id
join campaigns c on c.id = s.campaign_id;
