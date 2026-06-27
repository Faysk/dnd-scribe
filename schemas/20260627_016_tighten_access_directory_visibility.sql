-- Limit access directory visibility for authenticated users that are not yet
-- approved campaign members.

create or replace function public.access_directory(campaign_slug text default 'yuhara-main')
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  viewer_auth uuid := auth.uid();
  campaign_row record;
  viewer_profile public.profiles%rowtype;
  viewer_role text;
  can_manage boolean := false;
  profile_list jsonb := '[]'::jsonb;
  character_list jsonb := '[]'::jsonb;
  claim_list jsonb := '[]'::jsonb;
begin
  select * into campaign_row from public.campaigns where slug = campaign_slug limit 1;
  if campaign_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'campaign_not_found');
  end if;

  if viewer_auth is not null then
    select * into viewer_profile from public.profiles where auth_user_id = viewer_auth limit 1;
    if viewer_profile.id is not null then
      select cm.role into viewer_role
      from public.campaign_members cm
      where cm.campaign_id = campaign_row.id and cm.profile_id = viewer_profile.id
      limit 1;
      can_manage := viewer_role in ('owner','master');
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'displayName', p.display_name,
    'roll20Name', p.roll20_name,
    'discordId', case when can_manage or p.auth_user_id = viewer_auth then p.discord_id else null end,
    'discordHandle', case when can_manage or p.auth_user_id = viewer_auth then p.discord_handle else null end,
    'defaultCharacterName', p.default_character_name,
    'linked', p.auth_user_id is not null,
    'isCurrentUser', p.auth_user_id = viewer_auth,
    'role', case when can_manage or viewer_role is not null then cm.role else null end
  ) order by case cm.role when 'owner' then 0 when 'master' then 1 when 'player' then 2 when 'reviewer' then 3 when 'viewer' then 4 else 5 end, p.display_name), '[]'::jsonb)
  into profile_list
  from public.profiles p
  left join public.campaign_members cm on cm.profile_id = p.id and cm.campaign_id = campaign_row.id
  where
    case
      when can_manage then cm.id is not null or p.auth_user_id = viewer_auth or p.auth_user_id is null
      when viewer_role is not null then cm.id is not null or p.auth_user_id = viewer_auth
      else p.auth_user_id is null
    end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', pc.id,
    'profileId', pc.profile_id,
    'characterName', pc.character_name,
    'aliases', case when can_manage or viewer_role is not null then pc.aliases else '{}'::text[] end,
    'status', pc.status,
    'approvedAt', case when can_manage or viewer_role is not null then pc.approved_at else null end
  ) order by pc.character_name), '[]'::jsonb)
  into character_list
  from public.profile_characters pc
  join public.profiles p on p.id = pc.profile_id
  where pc.campaign_id = campaign_row.id
    and (
      can_manage
      or viewer_role is not null
      or p.auth_user_id is null
      or p.auth_user_id = viewer_auth
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', pc.id,
    'status', pc.status,
    'createdAt', pc.created_at,
    'reviewedAt', pc.reviewed_at,
    'requesterEmail', case when can_manage or pc.requester_auth_user_id = viewer_auth then pc.requester_email else null end,
    'requesterName', pc.requester_name,
    'targetProfileId', pc.target_profile_id,
    'requestedDisplayName', pc.requested_display_name,
    'requestedRoll20Name', pc.requested_roll20_name,
    'requestedDiscordId', case when can_manage or pc.requester_auth_user_id = viewer_auth then pc.requested_discord_id else null end,
    'requestedDiscordHandle', case when can_manage or pc.requester_auth_user_id = viewer_auth then pc.requested_discord_handle else null end,
    'requestedCharacterNames', pc.requested_character_names,
    'playerNote', case when can_manage or pc.requester_auth_user_id = viewer_auth then pc.player_note else null end,
    'reviewNote', pc.review_note
  ) order by pc.created_at desc), '[]'::jsonb)
  into claim_list
  from public.profile_claims pc
  where pc.campaign_id = campaign_row.id
    and (can_manage or pc.requester_auth_user_id = viewer_auth);

  return jsonb_build_object(
    'ok', true,
    'campaign', jsonb_build_object('id', campaign_row.id, 'slug', campaign_row.slug, 'name', campaign_row.name),
    'viewer', jsonb_build_object(
      'authenticated', viewer_auth is not null,
      'profileId', viewer_profile.id,
      'displayName', viewer_profile.display_name,
      'campaignRole', viewer_role,
      'canManageAccess', can_manage
    ),
    'profiles', profile_list,
    'characters', character_list,
    'claims', claim_list,
    'rules', jsonb_build_object(
      'playerCanRequest', true,
      'dmApprovesFinalLink', true,
      'dmCanOverride', true,
      'canonApprover', 'dm'
    )
  );
end;
$$;

revoke execute on function public.access_directory(text) from public, anon;
grant execute on function public.access_directory(text) to authenticated, service_role;
