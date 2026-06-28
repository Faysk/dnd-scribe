-- Track the real or estimated end of a session separately from the logical session date.
-- A session can start before midnight and end after midnight while keeping session_date
-- anchored to the local start date.

alter table sessions
  add column if not exists ended_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sessions_ended_after_started'
  ) then
    alter table sessions
      add constraint sessions_ended_after_started
      check (ended_at is null or started_at is null or ended_at > started_at);
  end if;
end $$;

create index if not exists sessions_ended_at_idx
  on sessions (ended_at)
  where ended_at is not null;
