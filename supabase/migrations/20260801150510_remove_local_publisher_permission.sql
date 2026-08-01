-- Processing locally and publishing the resulting text are one operator flow.
-- Deleting the obsolete role cascades its permission links and assignments.
delete from public.role_definitions
where slug = 'local_publisher';

delete from public.permission_catalog
where action = 'campaign.local.publish';
