-- DnD Scribe - Roll20 event import extensions.

alter table roll20_events
  add column if not exists source_system text,
  add column if not exists source_event_id text,
  add column if not exists created_at_roll20 timestamptz;

create unique index if not exists idx_roll20_events_session_source_id_unique
  on roll20_events(session_id, source_system, source_event_id)
  where source_system is not null and source_event_id is not null;

create index if not exists idx_roll20_events_session_type
  on roll20_events(session_id, event_type);
