-- DnD Scribe - persistent audio artifact inventory and retention model.

create table if not exists audio_artifacts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  source_file_id uuid references recording_files(id) on delete set null,
  source_chunk_id uuid references audio_chunks(id) on delete set null,
  created_by_job_id uuid references processing_jobs(id) on delete set null,
  parent_artifact_id uuid references audio_artifacts(id) on delete set null,
  artifact_type text not null check (artifact_type in (
    'craig_zip',
    'craig_info',
    'raw_track_flac',
    'raw_track_other',
    'chunk_wav',
    'speech_slice_wav',
    'compact_track_opus',
    'compact_session_opus',
    'transcript_source',
    'manifest_json',
    'roll20_export',
    'discord_export',
    'other'
  )),
  retention_class text not null check (retention_class in (
    'permanent',
    'permanent_compact',
    'review_hold',
    'work_temp',
    'delete_after_success',
    'delete_candidate',
    'legal_hold'
  )),
  lifecycle_status text not null default 'active' check (lifecycle_status in (
    'planned',
    'active',
    'superseded',
    'delete_ready',
    'delete_queued',
    'deleted',
    'missing',
    'failed'
  )),
  storage_bucket text not null,
  storage_path text not null,
  original_filename text,
  mime_type text,
  codec text,
  sample_rate_hz integer,
  channels integer,
  size_bytes bigint not null default 0,
  duration_ms integer,
  sha256 text,
  source_system text not null default 'unknown',
  source_role text,
  track_key text,
  start_ms integer,
  end_ms integer,
  retention_expires_at timestamptz,
  delete_after_job_type text,
  delete_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists idx_audio_artifacts_session_type
  on audio_artifacts(session_id, artifact_type, lifecycle_status);

create index if not exists idx_audio_artifacts_retention
  on audio_artifacts(retention_class, lifecycle_status, retention_expires_at)
  where lifecycle_status in ('active', 'superseded', 'delete_ready');

create index if not exists idx_audio_artifacts_source_file
  on audio_artifacts(source_file_id)
  where source_file_id is not null;

create index if not exists idx_audio_artifacts_source_chunk
  on audio_artifacts(source_chunk_id)
  where source_chunk_id is not null;

create table if not exists audio_artifact_events (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references audio_artifacts(id) on delete cascade,
  event_type text not null check (event_type in (
    'created',
    'classified',
    'compacted',
    'superseded',
    'marked_delete_ready',
    'delete_queued',
    'deleted',
    'missing_detected',
    'restore_requested',
    'note'
  )),
  actor_profile_id uuid references profiles(id) on delete set null,
  job_id uuid references processing_jobs(id) on delete set null,
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audio_artifact_events_artifact_time
  on audio_artifact_events(artifact_id, created_at desc);

create table if not exists audio_retention_policies (
  artifact_type text primary key,
  default_retention_class text not null check (default_retention_class in (
    'permanent',
    'permanent_compact',
    'review_hold',
    'work_temp',
    'delete_after_success',
    'delete_candidate',
    'legal_hold'
  )),
  keep_original boolean not null default false,
  preferred_codec text,
  target_bitrate_kbps integer,
  expires_after interval,
  delete_when_superseded boolean not null default false,
  notes text,
  updated_at timestamptz not null default now()
);

insert into audio_retention_policies (
  artifact_type,
  default_retention_class,
  keep_original,
  preferred_codec,
  target_bitrate_kbps,
  expires_after,
  delete_when_superseded,
  notes
)
values
  ('craig_zip', 'delete_after_success', false, null, null, interval '7 days', true, 'ZIP Craig original deve existir so ate manifest/extracao/compactacao serem validados.'),
  ('craig_info', 'permanent', true, null, null, null, false, 'info.txt e metadados sao leves e importantes para auditoria.'),
  ('raw_track_flac', 'work_temp', false, 'opus', 32, interval '7 days', true, 'FLAC e copia de trabalho; Opus compacto vira referencia permanente.'),
  ('raw_track_other', 'work_temp', false, 'opus', 32, interval '7 days', true, 'Audio bruto nao-FLAC deve ser compactado antes de persistir.'),
  ('chunk_wav', 'delete_after_success', false, null, null, interval '2 days', true, 'Chunks sao trabalho intermediario e nao devem virar acervo.'),
  ('speech_slice_wav', 'delete_after_success', false, null, null, interval '2 days', true, 'Slices reduzem custo OpenAI e somem apos transcricao validada.'),
  ('compact_track_opus', 'permanent_compact', true, 'opus', 32, null, false, 'Referencia de audio por faixa para playback/timeline.'),
  ('compact_session_opus', 'permanent_compact', true, 'opus', 48, null, false, 'Mix compacto opcional da sessao inteira.'),
  ('transcript_source', 'permanent', true, null, null, null, false, 'Texto/JSON de transcricao e barato e essencial para reprocessar narrativa.'),
  ('manifest_json', 'permanent', true, null, null, null, false, 'Manifest normalizado ancora sessoes, faixas e datas logicas.'),
  ('roll20_export', 'permanent', true, null, null, null, false, 'Export Roll20 e leve e faz parte da timeline canonica.'),
  ('discord_export', 'permanent', true, null, null, null, false, 'Export Discord e leve e faz parte da timeline canonica.'),
  ('other', 'review_hold', false, null, null, interval '30 days', false, 'Artefato desconhecido precisa de classificacao manual antes de apagar.')
on conflict (artifact_type) do update set
  default_retention_class = excluded.default_retention_class,
  keep_original = excluded.keep_original,
  preferred_codec = excluded.preferred_codec,
  target_bitrate_kbps = excluded.target_bitrate_kbps,
  expires_after = excluded.expires_after,
  delete_when_superseded = excluded.delete_when_superseded,
  notes = excluded.notes,
  updated_at = now();

insert into audio_artifacts (
  session_id,
  source_file_id,
  artifact_type,
  retention_class,
  lifecycle_status,
  storage_bucket,
  storage_path,
  original_filename,
  mime_type,
  size_bytes,
  duration_ms,
  source_system,
  source_role,
  track_key,
  metadata,
  created_at,
  updated_at
)
select
  rf.session_id,
  rf.id,
  case
    when rf.file_type = 'craig_info' then 'craig_info'
    when rf.file_type = 'roll20_chat' then 'roll20_export'
    when rf.file_type = 'discord_log' then 'discord_export'
    when rf.file_type in ('transcript_raw', 'processed_json') then 'transcript_source'
    when rf.file_type = 'craig_track' and coalesce(rf.mime_type, '') ilike '%flac%' then 'raw_track_flac'
    when rf.file_type = 'craig_track' then 'raw_track_other'
    else 'other'
  end as artifact_type,
  coalesce(policy.default_retention_class, 'review_hold') as retention_class,
  'active' as lifecycle_status,
  rf.storage_bucket,
  rf.storage_path,
  rf.original_filename,
  rf.mime_type,
  coalesce(rf.size_bytes, 0),
  rf.duration_ms,
  coalesce(rf.source_system, 'recording_files'),
  rf.source_file_role,
  rf.source_track_key,
  jsonb_build_object('backfilled_from', 'recording_files'),
  coalesce(rf.created_at, now()),
  now()
from recording_files rf
left join audio_retention_policies policy on policy.artifact_type = case
    when rf.file_type = 'craig_info' then 'craig_info'
    when rf.file_type = 'roll20_chat' then 'roll20_export'
    when rf.file_type = 'discord_log' then 'discord_export'
    when rf.file_type in ('transcript_raw', 'processed_json') then 'transcript_source'
    when rf.file_type = 'craig_track' and coalesce(rf.mime_type, '') ilike '%flac%' then 'raw_track_flac'
    when rf.file_type = 'craig_track' then 'raw_track_other'
    else 'other'
  end
where nullif(rf.storage_bucket, '') is not null
  and nullif(rf.storage_path, '') is not null
on conflict (storage_bucket, storage_path) do update set
  source_file_id = coalesce(audio_artifacts.source_file_id, excluded.source_file_id),
  artifact_type = excluded.artifact_type,
  retention_class = excluded.retention_class,
  size_bytes = greatest(coalesce(audio_artifacts.size_bytes, 0), coalesce(excluded.size_bytes, 0)),
  duration_ms = coalesce(audio_artifacts.duration_ms, excluded.duration_ms),
  source_system = coalesce(nullif(audio_artifacts.source_system, 'unknown'), excluded.source_system),
  source_role = coalesce(audio_artifacts.source_role, excluded.source_role),
  track_key = coalesce(audio_artifacts.track_key, excluded.track_key),
  metadata = coalesce(audio_artifacts.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

create or replace view audio_artifact_inventory as
select
  c.slug as campaign_slug,
  s.source_session_id,
  s.title as session_title,
  aa.session_id,
  aa.artifact_type,
  aa.retention_class,
  aa.lifecycle_status,
  count(*)::int as objects,
  coalesce(sum(aa.size_bytes), 0)::bigint as bytes,
  round((coalesce(sum(aa.duration_ms), 0) / 60000.0)::numeric, 3) as audio_minutes,
  min(aa.retention_expires_at) as next_expiration_at,
  max(aa.updated_at) as last_seen_at
from audio_artifacts aa
join sessions s on s.id = aa.session_id
join campaigns c on c.id = s.campaign_id
group by c.slug, s.source_session_id, s.title, aa.session_id, aa.artifact_type, aa.retention_class, aa.lifecycle_status;
