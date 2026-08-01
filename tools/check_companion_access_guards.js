const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api', '[...path].js'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'web', 'central-local', 'app.js'), 'utf8');
const setup = fs.readFileSync(path.join(root, 'installer', 'CompanionSetup.cs'), 'utf8');
const tray = fs.readFileSync(path.join(root, 'installer', 'CompanionTray.cs'), 'utf8');
const companionApi = fs.readFileSync(path.join(root, 'local-companion', 'app', 'main.py'), 'utf8');
const transcriber = fs.readFileSync(path.join(root, 'local-companion', 'app', 'transcriber.py'), 'utf8');
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20260801143158_companion_distribution_permissions.sql'),
  'utf8'
);
const removalMigration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20260801150510_remove_local_publisher_permission.sql'),
  'utf8'
);

const checks = [
  [api.includes("permissions.has('campaign.permissions.manage')"), 'owner-only permission capability'],
  [api.includes("action: 'campaign.companion.download'"), 'authorized companion download'],
  [api.includes("action: 'campaign.local.process'"), 'local operator publication permission'],
  [!api.includes("campaign.local.publish"), 'removed publication-only capability'],
  [api.includes("roleSlug === 'site_permissions_owner'"), 'permission ownership transfer guard'],
  [api.includes('SITE_FEATURE_ROLE_SLUGS.has'), 'site feature mutation guard'],
  [editor.includes('canDownloadCompanion'), 'download UI capability guard'],
  [editor.includes('state.cloud.capabilities.canUseLocalProcessing'), 'publication follows processing capability'],
  [!editor.includes('local_publisher'), 'removed publication-only toggle'],
  [migration.includes("rd.slug = 'site_permissions_owner'"), 'exclusive owner seed'],
  [migration.includes("rd.slug in ('local_operator', 'audio_operator')"), 'approved operator seed'],
  [migration.includes("'companion-releases'"), 'private release bucket migration'],
  [removalMigration.includes("slug = 'local_publisher'"), 'obsolete role cleanup'],
  [removalMigration.includes("action = 'campaign.local.publish'"), 'obsolete capability cleanup'],
  [setup.includes('Environment.SpecialFolder.Startup'), 'tray starts with Windows login'],
  [tray.includes('● Parado') && tray.includes('● Rodando') && tray.includes('● Processando'), 'tray service states'],
  [tray.includes('Atualizar componentes') && tray.includes('Sobre') && tray.includes('Sair'), 'tray operator actions'],
  [companionApi.includes('companion-runtime.json'), 'service PID lifecycle contract'],
  [transcriber.includes('"percent": overall_percent'), 'real transcription progress contract']
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) throw new Error(`Companion access guards missing: ${failed.join(', ')}`);
console.log(`Companion access guards OK: ${checks.length} checks.`);
