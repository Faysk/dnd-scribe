const {
  getPool,
  httpError,
  readJsonBody,
  requireFeaturePermissions,
  sendJson,
} = require('../lib/feature-auth');

const ROLE_SLUG = 'transcript_viewer';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });

  let client = null;
  let inTransaction = false;
  try {
    const body = await readJsonBody(req);
    const campaign = String(body.campaignSlug || 'yuhara-main').trim().slice(0, 120);
    const targetProfileId = String(body.profileId || '').trim().slice(0, 80);
    const enabled = body.enabled === true;
    if (!targetProfileId) throw httpError(400, 'profileId obrigatório.');

    const actor = await requireFeaturePermissions(req, campaign, ['campaign.permissions.manage']);
    client = await getPool().connect();
    await client.query('begin');
    inTransaction = true;

    const target = await client.query(
      `
select p.id
from profiles p
join campaign_members cm on cm.profile_id = p.id
join campaigns c on c.id = cm.campaign_id
where p.id = $1::uuid and c.slug = $2
limit 1;`,
      [targetProfileId, campaign],
    );
    if (!target.rows[0]) throw httpError(404, 'Pessoa não vinculada à campanha.');

    const role = await client.query(
      'select id from role_definitions where slug = $1 limit 1;',
      [ROLE_SLUG],
    );
    const roleId = role.rows[0]?.id;
    if (!roleId) throw httpError(503, 'Permissão de transcrição ainda não foi instalada.');

    if (enabled) {
      await client.query(
        `
insert into role_assignments (
  profile_id, role_id, scope_type, scope_id, status, starts_at, assigned_by, reason, metadata
)
values ($1::uuid, $2::uuid, 'campaign', $3, 'active', now(), $4::uuid,
        'Permissão de transcrição alterada no Edit.', $5::jsonb)
on conflict (profile_id, role_id, scope_type, scope_id)
where status in ('active', 'eligible') and ends_at is null
do update set
  status = 'active',
  starts_at = least(role_assignments.starts_at, excluded.starts_at),
  assigned_by = excluded.assigned_by,
  reason = excluded.reason,
  metadata = coalesce(role_assignments.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();`,
        [
          targetProfileId,
          roleId,
          campaign,
          actor.profileId,
          JSON.stringify({ source: 'edit_permissions', action: 'transcript_access_grant' }),
        ],
      );
    } else {
      await client.query(
        `
update role_assignments
set status = 'revoked',
    ends_at = greatest(now(), starts_at + interval '1 second'),
    revoked_by = $4::uuid,
    reason = 'Permissão de transcrição removida no Edit.',
    metadata = coalesce(metadata, '{}'::jsonb) || $5::jsonb,
    updated_at = now()
where profile_id = $1::uuid
  and role_id = $2::uuid
  and scope_type = 'campaign'
  and scope_id = $3
  and status = 'active'
  and ends_at is null;`,
        [
          targetProfileId,
          roleId,
          campaign,
          actor.profileId,
          JSON.stringify({ source: 'edit_permissions', action: 'transcript_access_revoke' }),
        ],
      );
    }

    await client.query('commit');
    inTransaction = false;
    return sendJson(res, 200, { ok: true, profileId: targetProfileId, enabled });
  } catch (error) {
    if (client && inTransaction) await client.query('rollback').catch(() => {});
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || 'Erro interno.' });
  } finally {
    client?.release();
  }
};
