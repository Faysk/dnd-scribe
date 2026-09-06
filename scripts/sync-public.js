const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const sourceDir = path.join(root, 'web')
const integrationsDir = path.join(root, 'integrations')
const outputDir = path.join(root, 'public')

const browserVendors = [
  {
    source: path.join(root, 'node_modules', 'marked', 'lib', 'marked.umd.js'),
    target: path.join(outputDir, 'vendor', 'marked.umd.js'),
  },
  {
    source: path.join(root, 'node_modules', 'dompurify', 'dist', 'purify.min.js'),
    target: path.join(outputDir, 'vendor', 'purify.min.js'),
  },
]

// O serviço raiz não possui mais um frontend público próprio.
// Somente superfícies operacionais/legais e assets históricos são publicados aqui.
const publicAllowlist = [
  'central-local',
  'assets',
  'api-docs.css',
  'api-docs.html',
  'openapi-summary-v1.yaml',
  'privacy.html',
  'terms.html',
  'linked-role.html',
  'roll20.css',
  'roll20.html',
  'roll20.js',
  'roll20-bridge.html',
  'roll20-bridge.js',
  'roll20-bridge-page.js',
  'styles.css',
  'theme.js',
  'auth-fetch.js',
]

function fail(message) {
  console.error(`sync-public: ${message}`)
  process.exit(1)
}

function copyDirectory(source, target) {
  fs.mkdirSync(target, { recursive: true })
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name)
    const targetPath = path.join(target, entry.name)
    if (entry.isDirectory()) copyDirectory(sourcePath, targetPath)
    else if (entry.isFile()) fs.copyFileSync(sourcePath, targetPath)
  }
}

function copyAllowlistedEntry(relativePath) {
  const source = path.join(sourceDir, relativePath)
  const target = path.join(outputDir, relativePath)
  if (!fs.existsSync(source)) fail(`required operator asset not found: ${source}`)
  const stat = fs.statSync(source)
  if (stat.isDirectory()) copyDirectory(source, target)
  else {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(source, target)
  }
}

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0
  let total = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name)
    total += entry.isDirectory() ? countFiles(entryPath) : entry.isFile() ? 1 : 0
  }
  return total
}

if (!fs.existsSync(sourceDir)) fail(`source directory not found: ${sourceDir}`)

fs.rmSync(outputDir, { recursive: true, force: true })
fs.mkdirSync(outputDir, { recursive: true })

for (const entry of publicAllowlist) copyAllowlistedEntry(entry)

if (fs.existsSync(integrationsDir)) {
  copyDirectory(integrationsDir, path.join(outputDir, 'integrations'))
}

for (const vendor of browserVendors) {
  if (!fs.existsSync(vendor.source)) fail(`browser dependency not found: ${vendor.source}`)
  fs.mkdirSync(path.dirname(vendor.target), { recursive: true })
  fs.copyFileSync(vendor.source, vendor.target)
}

// Guardrail: este serviço nunca deve voltar a publicar uma Home paralela.
if (fs.existsSync(path.join(outputDir, 'index.html'))) {
  fail('legacy public index.html was generated; apps/web must remain the only public frontend')
}

if (!fs.existsSync(path.join(outputDir, 'central-local', 'index.html'))) {
  fail('operator Edit output is missing central-local/index.html')
}

const copiedFiles = countFiles(outputDir)
if (copiedFiles === 0) fail(`public output is empty after sync: ${outputDir}`)

console.log(`Synced operator-only public surface -> ${outputDir} (${copiedFiles} files)`)
