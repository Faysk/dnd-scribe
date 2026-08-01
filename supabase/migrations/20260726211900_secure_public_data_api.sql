-- DnD Scribe serves campaign data through authenticated Vercel API routes.
-- Supabase's Data API remains available for Auth and a small, explicit set of
-- campaign access RPCs. Public tables and operational views are deny-by-default.

do $$
declare
  item record;
begin
  for item in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format(
      'alter table %I.%I enable row level security',
      item.schemaname,
      item.tablename
    );
  end loop;
end
$$;

-- The browser never reads campaign tables directly. The server uses its
-- dedicated Postgres connection and applies campaign membership checks.
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

-- Existing projects historically granted public function execution by
-- default. Remove that broad surface, then restore only reviewed RPCs.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.access_directory(text) to authenticated;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.has_campaign_role(uuid, text[]) to authenticated;
grant execute on function public.has_campaign_role_slug(text, text[]) to authenticated;
grant execute on function public.review_profile_claim(uuid, text, text) to authenticated;
grant execute on function public.review_table_note(uuid, text, text, text, text, text, text[]) to authenticated;
grant execute on function public.submit_profile_claim(text, uuid, text, text, text, text, text[], text) to authenticated;
grant execute on function public.table_notes_directory(text, text) to authenticated;

-- Views should never inherit the creator's access if they are queried by a
-- non-owner in the future. Direct Data API access remains revoked above.
alter view public.ai_usage_session_summary set (security_invoker = true);
alter view public.audio_artifact_inventory set (security_invoker = true);
alter view public.audio_storage_cleanup_candidates set (security_invoker = true);
alter view public.audio_transcription_work_units set (security_invoker = true);
alter view public.craig_manifest_quality set (security_invoker = true);
alter view public.craig_track_extraction_summary set (security_invoker = true);
alter view public.processing_job_step_summary set (security_invoker = true);

-- Make future exposure opt-in instead of inheriting permissive project
-- defaults. Service-side access is left unchanged.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

notify pgrst, 'reload schema';
