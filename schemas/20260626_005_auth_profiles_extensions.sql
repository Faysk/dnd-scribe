-- DnD Scribe - Supabase Auth profile mapping.
-- Prepares Google/Auth mapping without enabling restrictive RLS yet.

create extension if not exists "pgcrypto";

alter table profiles
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists email text,
  add column if not exists avatar_url text,
  add column if not exists last_sign_in_at timestamptz;

create unique index if not exists idx_profiles_auth_user_id_unique
  on profiles(auth_user_id)
  where auth_user_id is not null;

create unique index if not exists idx_profiles_email_unique
  on profiles(lower(email))
  where email is not null;

create schema if not exists app;

create or replace function app.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function app.is_campaign_member(target_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.profile_id = app.current_profile_id()
  )
$$;

create or replace function app.is_campaign_dm(target_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.profile_id = app.current_profile_id()
      and cm.role in ('owner', 'master', 'reviewer')
  )
$$;

grant usage on schema app to anon, authenticated, service_role;
grant execute on function app.current_profile_id() to anon, authenticated, service_role;
grant execute on function app.is_campaign_member(uuid) to anon, authenticated, service_role;
grant execute on function app.is_campaign_dm(uuid) to anon, authenticated, service_role;
