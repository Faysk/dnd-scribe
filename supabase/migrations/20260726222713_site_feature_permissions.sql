-- Independent site capabilities keep narrative roles separate from access to
-- editing and to the operator's local machine.

insert into public.permission_catalog (action, plane, description)
values
  ('campaign.edit.access', 'narrative', 'Open the campaign Edit workspace in read-only mode.'),
  ('campaign.content.edit', 'narrative', 'Edit published session metadata, summaries and transcript text.'),
  ('campaign.local.process', 'mixed', 'Use the local companion for uploads and heavy transcription processing.'),
  ('campaign.audio.read', 'mixed', 'Read or play audio stored by a local companion.')
on conflict (action) do update
set plane = excluded.plane,
    description = excluded.description;

insert into public.role_definitions (slug, name, plane, description, is_system)
values
  ('edit_viewer', 'Edit Viewer', 'narrative', 'Can open Edit without changing published content.', true),
  ('site_editor', 'Site Editor', 'narrative', 'Can open Edit and revise published campaign content.', true),
  ('local_operator', 'Local Processing Operator', 'mixed', 'Can use local uploads and heavy processing.', true),
  ('audio_operator', 'Local Audio Operator', 'mixed', 'Can access audio exposed by a local companion.', true)
on conflict (slug) do update
set name = excluded.name,
    plane = excluded.plane,
    description = excluded.description,
    is_system = excluded.is_system,
    updated_at = now();

insert into public.role_permissions (role_id, permission_action)
select rd.id, permission.action
from public.role_definitions rd
join (
  values
    ('edit_viewer', 'campaign.edit.access'),
    ('site_editor', 'campaign.edit.access'),
    ('site_editor', 'campaign.content.edit'),
    ('local_operator', 'campaign.local.process'),
    ('local_operator', 'campaign.upload.manage'),
    ('audio_operator', 'campaign.audio.read')
) as permission(role_slug, action) on permission.role_slug = rd.slug
on conflict (role_id, permission_action) do nothing;
