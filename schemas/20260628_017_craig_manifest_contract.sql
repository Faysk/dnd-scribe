-- DnD Scribe - durable Craig manifest contract and quality view.

create table if not exists craig_manifests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  source_recording_file_id uuid references recording_files(id) on delete set null,
  created_by_job_id uuid references processing_jobs(id) on delete set null,
  schema_version integer not null default 1,
  status text not null default 'parsed' check (status in (
    'parsed',
    'valid',
    'warning',
    'invalid',
    'superseded'
  )),
  recording_id text,
  guild_name text,
  channel_name text,
  requester text,
  started_at timestamptz,
  ended_at timestamptz,
  logical_date date,
  time_zone text not null default 'Europe/London',
  duration_ms integer,
  duration_source text,
  crosses_midnight boolean not null default false,
  zip_object_size bigint,
  zip_entries integer not null default 0,
  tracks_count integer not null default 0,
  participants_count integer not null default 0,
  info_filename text,
  manifest_json jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, source_recording_file_id)
);

create index if not exists idx_craig_manifests_session
  on craig_manifests(session_id, status, updated_at desc);

create index if not exists idx_craig_manifests_recording
  on craig_manifests(recording_id)
  where recording_id is not null;

insert into craig_manifests (
  session_id,
  source_recording_file_id,
  created_by_job_id,
  schema_version,
  status,
  recording_id,
  guild_name,
  channel_name,
  requester,
  started_at,
  ended_at,
  logical_date,
  time_zone,
  duration_ms,
  duration_source,
  crosses_midnight,
  zip_object_size,
  zip_entries,
  tracks_count,
  participants_count,
  info_filename,
  manifest_json,
  validation_errors,
  created_at,
  updated_at
)
select
  s.id,
  rf.id,
  pj.id,
  1,
  case
    when coalesce((manifest->'zip'->>'tracks')::integer, 0) <= 0 then 'invalid'
    when coalesce((manifest->'session_window'->>'duration_source'), '') = 'pending_track_duration' then 'warning'
    else 'valid'
  end,
  manifest->'craig'->>'recording_id',
  manifest->'craig'->>'guild',
  manifest->'craig'->>'channel',
  manifest->'craig'->>'requester',
  nullif(manifest->'session_window'->>'started_at', '')::timestamptz,
  nullif(manifest->'session_window'->>'ended_at', '')::timestamptz,
  nullif(manifest->'session_window'->>'logical_date', '')::date,
  coalesce(nullif(manifest->'session_window'->>'time_zone', ''), 'Europe/London'),
  nullif(manifest->'session_window'->>'duration_ms', '')::integer,
  manifest->'session_window'->>'duration_source',
  coalesce((manifest->'session_window'->>'crosses_midnight')::boolean, false),
  nullif(manifest->'zip'->>'object_size', '')::bigint,
  coalesce((manifest->'zip'->>'entries')::integer, 0),
  coalesce((manifest->'zip'->>'tracks')::integer, 0),
  coalesce(jsonb_array_length(coalesce(manifest->'participants', '[]'::jsonb)), 0),
  manifest->'zip'->>'info_file',
  manifest,
  case
    when coalesce((manifest->'zip'->>'tracks')::integer, 0) <= 0
      then jsonb_build_array('manifest_without_flac_tracks')
    when coalesce((manifest->'session_window'->>'duration_source'), '') = 'pending_track_duration'
      then jsonb_build_array('duration_pending')
    else '[]'::jsonb
  end,
  coalesce(s.updated_at, now()),
  now()
from sessions s
cross join lateral (select s.metadata->'cloud_manifest_only' as manifest) m
left join recording_files rf on rf.id::text = manifest->>'source_recording_file_id'
left join processing_jobs pj on pj.id::text = manifest->>'source_job_id'
where manifest is not null
  and jsonb_typeof(manifest) = 'object'
on conflict (session_id, source_recording_file_id) do update set
  created_by_job_id = coalesce(craig_manifests.created_by_job_id, excluded.created_by_job_id),
  schema_version = excluded.schema_version,
  status = excluded.status,
  recording_id = excluded.recording_id,
  guild_name = excluded.guild_name,
  channel_name = excluded.channel_name,
  requester = excluded.requester,
  started_at = excluded.started_at,
  ended_at = excluded.ended_at,
  logical_date = excluded.logical_date,
  time_zone = excluded.time_zone,
  duration_ms = excluded.duration_ms,
  duration_source = excluded.duration_source,
  crosses_midnight = excluded.crosses_midnight,
  zip_object_size = excluded.zip_object_size,
  zip_entries = excluded.zip_entries,
  tracks_count = excluded.tracks_count,
  participants_count = excluded.participants_count,
  info_filename = excluded.info_filename,
  manifest_json = excluded.manifest_json,
  validation_errors = excluded.validation_errors,
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
    when cm.status = 'warning' then 'attention'
    when cm.tracks_count = 0 then 'critical'
    when cm.participants_count = 0 then 'attention'
    else 'ok'
  end as quality_status,
  cm.updated_at
from craig_manifests cm
join sessions s on s.id = cm.session_id
join campaigns c on c.id = s.campaign_id;
