const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api', '[...path].js'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'web', 'central-local', 'app.js'), 'utf8');
const processingUi = fs.readFileSync(path.join(root, 'web', 'central-local', 'processing-v04.js'), 'utf8');
const setup = fs.readFileSync(path.join(root, 'installer', 'CompanionSetup.cs'), 'utf8');
const tray = fs.readFileSync(path.join(root, 'installer', 'CompanionTray.cs'), 'utf8');
const build = fs.readFileSync(path.join(root, 'installer', 'build.ps1'), 'utf8');
const companionApi = fs.readFileSync(path.join(root, 'local-companion', 'app', 'main.py'), 'utf8');
const updater = fs.readFileSync(path.join(root, 'local-companion', 'app', 'updater.py'), 'utf8');
const transcriber = fs.readFileSync(path.join(root, 'local-companion', 'app', 'transcriber.py'), 'utf8');
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20260801143158_companion_distribution_permissions.sql'),
  'utf8'
);
const removalMigration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20260801150510_remove_local_publisher_permission.sql'),
  'utf8'
);

function capture(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`Companion version missing from ${label}`);
  return match[1];
}

const versions = {
  service: capture(companionApi, /COMPANION_VERSION\s*=\s*"([0-9]+\.[0-9]+\.[0-9]+)"/, 'local service'),
  setup: capture(setup, /private const string Version = "([0-9]+\.[0-9]+\.[0-9]+)"/, 'installer'),
  tray: capture(tray, /private const string Version = "([0-9]+\.[0-9]+\.[0-9]+)"/, 'tray'),
  build: capture(build, /version\s*=\s*'([0-9]+\.[0-9]+\.[0-9]+)'/, 'build release'),
  hostedUi: capture(processingUi, /LATEST_COMPANION_VERSION\s*=\s*"([0-9]+\.[0-9]+\.[0-9]+)"/, 'hosted update UI')
};
const releaseVersionsMatch = new Set(Object.values(versions)).size === 1;

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
  [tray.includes('Reparar componentes') && tray.includes('Sobre') && tray.includes('Sair'), 'tray operator actions'],
  [companionApi.includes('companion-runtime.json'), 'service PID lifecycle contract'],
  [companionApi.includes('@app.post("/api/update")'), 'local update endpoint'],
  [updater.includes('TRUSTED_RELEASE_HOST') && updater.includes('TRUSTED_RELEASE_PATH'), 'trusted release URL allowlist'],
  [updater.includes('verify_installer') && updater.includes('"/verify"'), 'installer self-verification before update'],
  [processingUi.includes('Atualizar Companion') && processingUi.includes('/api/update'), 'hosted update UX'],
  [releaseVersionsMatch, `release version consistency (${JSON.stringify(versions)})`],
  [transcriber.includes('"percent": overall_percent'), 'real transcription progress contract']
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) throw new Error(`Companion access guards missing: ${failed.join(', ')}`);
console.log(`Companion access guards OK: ${checks.length} checks. Release ${versions.service}.`);
