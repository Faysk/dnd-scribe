-- DnD Scribe - reclassify known artifacts after initial backfill.

with classified as (
  select
    aa.id,
    aa.artifact_type as old_artifact_type,
    aa.retention_class as old_retention_class,
    case
      when aa.source_role in ('craig_zip', 'craig_zip_upload')
        or aa.original_filename ilike '%.zip'
        or aa.storage_path ilike '%.zip'
        then 'craig_zip'
      when aa.source_role in ('transcript_master_md', 'transcript_master_json')
        or aa.source_role ilike '%transcript%'
        or aa.storage_path ilike '%.md'
        or aa.storage_path ilike '%.json'
        then 'transcript_source'
      when aa.source_role = 'craig_info'
        or aa.storage_path ilike '%info.txt'
        then 'craig_info'
      else aa.artifact_type
    end as new_artifact_type
  from audio_artifacts aa
), updates as (
  update audio_artifacts aa
  set
    artifact_type = c.new_artifact_type,
    retention_class = coalesce(policy.default_retention_class, aa.retention_class),
    metadata = coalesce(aa.metadata, '{}'::jsonb) || jsonb_build_object(
      'reclassified_by', '20260628_015_audio_artifact_reclassify',
      'previous_artifact_type', c.old_artifact_type,
      'previous_retention_class', c.old_retention_class
    ),
    updated_at = now()
  from classified c
  left join audio_retention_policies policy on policy.artifact_type = c.new_artifact_type
  where aa.id = c.id
    and c.new_artifact_type <> c.old_artifact_type
  returning aa.id, c.old_artifact_type, aa.artifact_type as new_artifact_type, c.old_retention_class, aa.retention_class as new_retention_class
)
insert into audio_artifact_events (artifact_id, event_type, note, payload)
select
  id,
  'classified',
  'Reclassificacao automatica de artefato conhecido.',
  jsonb_build_object(
    'migration', '20260628_015_audio_artifact_reclassify',
    'old_artifact_type', old_artifact_type,
    'new_artifact_type', new_artifact_type,
    'old_retention_class', old_retention_class,
    'new_retention_class', new_retention_class
  )
from updates;
