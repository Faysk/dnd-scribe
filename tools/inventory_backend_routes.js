const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const API_ROOT = path.join(ROOT, 'api');
const MONOLITH = path.join(API_ROOT, '[...path].js');
const MONOLITH_BASELINE_BYTES = 336927;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && entry.name.endsWith('.js') ? [full] : [];
  });
}

function routeFromEntrypoint(file) {
  const relative = path.relative(API_ROOT, file).replaceAll(path.sep, '/');
  if (relative === '[...path].js') return null;
  return `/api/${relative.replace(/\.js$/, '').replace(/\/index$/, '')}`;
}

function extractLiteralRoutes(source) {
  const routes = new Set();
  const patterns = [
    /(?:path|pathname)\s*===\s*['"`]([^'"`]+)['"`]/g,
    /['"`]([^'"`]+)['"`]\s*===\s*(?:path|pathname)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1].startsWith('/api/')) routes.add(match[1]);
    }
  }
  return [...routes].sort();
}

function domainForRoute(route) {
  const parts = route.split('/').filter(Boolean);
  if (parts[1] === 'cron') return parts[2] || 'cron';
  if (parts[1] === 'jobs') return 'jobs';
  if (parts[1] === 'uploads') return 'uploads';
  if (parts[1] === 'storage') return 'storage';
  if (parts[1] === 'roll20') return 'roll20';
  if (parts[1] === 'discord') return 'discord';
  if (parts[1] === 'rbac') return 'rbac';
  if (parts[1] === 'library') return 'library';
  if (parts[1] === 'sessions') return 'sessions';
  return (parts[1] || 'unknown').split('-')[0];
}

function buildInventory() {
  const monolithSource = fs.readFileSync(MONOLITH, 'utf8');
  const monolithRoutes = extractLiteralRoutes(monolithSource);
  const entrypoints = walk(API_ROOT)
    .map((file) => ({
      file: path.relative(ROOT, file).replaceAll(path.sep, '/'),
      route: routeFromEntrypoint(file),
      bytes: Buffer.byteLength(fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n')),
    }))
    .filter((item) => item.route)
    .sort((a, b) => a.route.localeCompare(b.route));

  const domains = {};
  for (const route of monolithRoutes) {
    const domain = domainForRoute(route);
    domains[domain] ||= [];
    domains[domain].push(route);
  }

  return {
    generatedAt: new Date().toISOString(),
    monolith: {
      file: 'api/[...path].js',
      // Compare canonical LF bytes so Windows checkout conversion is not growth.
      bytes: Buffer.byteLength(monolithSource.replaceAll('\r\n', '\n')),
      baselineBytes: MONOLITH_BASELINE_BYTES,
      literalRoutes: monolithRoutes,
      literalRouteCount: monolithRoutes.length,
      domains,
    },
    standaloneEntrypoints: entrypoints,
  };
}

function check(inventory) {
  const errors = [];
  if (inventory.monolith.bytes > MONOLITH_BASELINE_BYTES) {
    errors.push(`api/[...path].js cresceu: ${inventory.monolith.bytes} > baseline ${MONOLITH_BASELINE_BYTES} bytes`);
  }
  if (inventory.monolith.literalRouteCount < 25) {
    errors.push(`inventário encontrou poucas rotas literais no monólito: ${inventory.monolith.literalRouteCount}`);
  }
  if (!inventory.standaloneEntrypoints.length) {
    errors.push('nenhum entrypoint standalone em api/ foi encontrado');
  }
  const invalid = inventory.monolith.literalRoutes.filter((route) => !route.startsWith('/api/'));
  if (invalid.length) errors.push(`rotas inválidas: ${invalid.join(', ')}`);

  if (errors.length) {
    console.error('Backend inventory check FAILED');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Backend inventory OK: ${inventory.monolith.literalRouteCount} rotas literais no monólito, ` +
    `${inventory.standaloneEntrypoints.length} entrypoints standalone, ${inventory.monolith.bytes} bytes.`
  );
}

const inventory = buildInventory();
if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
} else if (process.argv.includes('--check')) {
  check(inventory);
} else {
  console.log('Backend route inventory');
  console.log(`Monólito: ${inventory.monolith.bytes} bytes / ${inventory.monolith.literalRouteCount} rotas literais`);
  for (const [domain, routes] of Object.entries(inventory.monolith.domains).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`- ${domain}: ${routes.length}`);
  }
  console.log(`Entrypoints standalone: ${inventory.standaloneEntrypoints.length}`);
  console.log('Use --json para detalhes ou --check para o gate de CI.');
}
