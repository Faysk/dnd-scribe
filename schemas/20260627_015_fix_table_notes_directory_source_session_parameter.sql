-- Fix ambiguous source_session_id resolution inside the table notes directory RPC.

create or replace function public.table_notes_directory(
  campaign_slug text default 'yuhara-main',
  source_session_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  campaign_row record;
  viewer_profile_id uuid;
  viewer_role text;
  can_manage boolean;
begin
  select id, slug, name into campaign_row
  from public.campaigns
  where slug = campaign_slug
  limit 1;

  if campaign_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'campaign_not_found', 'notes', '[]'::jsonb);
  end if;

  select p.id, cm.role into viewer_profile_id, viewer_role
  from public.profiles p
  join public.campaign_members cm on cm.profile_id = p.id
  where p.auth_user_id = auth.uid()
    and cm.campaign_id = campaign_row.id
  limit 1;

  can_manage := viewer_role = any(array['owner','master','reviewer']);

  if viewer_role is null then
    return jsonb_build_object(
      'ok', true,
      'campaign', jsonb_build_object('id', campaign_row.id, 'slug', campaign_row.slug, 'name', campaign_row.name),
      'viewer', jsonb_build_object('profileId', null, 'role', null, 'canManageNotes', false),
      'notes', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'campaign', jsonb_build_object('id', campaign_row.id, 'slug', campaign_row.slug, 'name', campaign_row.name),
    'viewer', jsonb_build_object('profileId', viewer_profile_id, 'role', viewer_role, 'canManageNotes', can_manage),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id,
        'sessionId', n.session_id,
        'sourceSystem', n.source_system,
        'sourceId', n.source_id,
        'noteType', n.note_type,
        'visibility', n.visibility,
        'reviewStatus', n.review_status,
        'content', n.content,
        'authorProfileId', n.author_profile_id,
        'authorDiscordId', n.author_discord_id,
        'authorName', n.author_name,
        'tags', n.tags,
        'metadata', n.metadata,
        'reviewNote', n.review_note,
        'createdAt', n.created_at,
        'reviewedAt', n.reviewed_at,
        'session', case when s.id is null then null else jsonb_build_object(
          'sourceSessionId', s.source_session_id,
          'title', s.title,
          'status', s.status,
          'sessionDate', s.session_date
        ) end
      ) order by n.created_at desc)
      from public.table_notes n
      left join public.sessions s on s.id = n.session_id
      where n.campaign_id = campaign_row.id
        and (
          table_notes_directory.source_session_id is null
          or table_notes_directory.source_session_id = ''
          or s.source_session_id = table_notes_directory.source_session_id
        )
        and (
          can_manage
          or n.author_profile_id = viewer_profile_id
          or n.visibility in ('player_visible', 'public_candidate')
        )
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.table_notes_directory(text, text) from public, anon;
grant execute on function public.table_notes_directory(text, text) to authenticated, service_role;
