-- Tighten public API exposure for access and Discord review flows.
-- These tables are accessed through authorized SECURITY DEFINER RPCs, not directly
-- through the Supabase Data API.

revoke execute on function public.access_directory(text) from public, anon;
revoke execute on function public.submit_profile_claim(text, uuid, text, text, text, text, text[], text) from public, anon;
revoke execute on function public.review_profile_claim(uuid, text, text) from public, anon;
revoke execute on function public.table_notes_directory(text, text) from public, anon;
revoke execute on function public.review_table_note(uuid, text, text, text, text, text, text[]) from public, anon;

grant execute on function public.access_directory(text) to authenticated, service_role;
grant execute on function public.submit_profile_claim(text, uuid, text, text, text, text, text[], text) to authenticated, service_role;
grant execute on function public.review_profile_claim(uuid, text, text) to authenticated, service_role;
grant execute on function public.table_notes_directory(text, text) to authenticated, service_role;
grant execute on function public.review_table_note(uuid, text, text, text, text, text, text[]) to authenticated, service_role;

revoke all on table public.profile_claims from public, anon, authenticated;
revoke all on table public.table_notes from public, anon, authenticated;
revoke all on table public.discord_interactions from public, anon, authenticated;
