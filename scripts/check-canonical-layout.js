const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

const forbidden = [
  'index.html',
  'pitch.html',
  'app.js',
  'data.js',
  'styles.css',
  'css',
  'js',
  'assets',
  'web/index.html',
  'web/app.js',
  'web/library.js',
  'web/library.css',
  'web/jobs.js',
  'web/jobs.css',
  'web/costs.js',
  'web/costs.css',
  'web/access.js',
  'web/access.css',
  'web/notes.js',
  'web/notes.css',
  'web/monitoring.js',
  'web/monitoring.css',
  'web/storage-inventory.js',
  'web/ui-bridge.js',
]

const required = [
  'apps/web/package.json',
  'apps/web/app',
  'apps/web/components',
  'web/central-local/index.html',
  'web/central-local/app.js',
  'web/central-local/styles.css',
  'vercel.json',
]

const offenders = forbidden.filter((entry) => fs.existsSync(path.join(root, entry)))
const missing = required.filter((entry) => !fs.existsSync(path.join(root, entry)))

if (offenders.length || missing.length) {
  if (offenders.length) {
    console.error('Canonical layout violation: obsolete public UI returned:')
    offenders.forEach((entry) => console.error(`  - ${entry}`))
  }
  if (missing.length) {
    console.error('Canonical layout violation: required canonical surface missing:')
    missing.forEach((entry) => console.error(`  - ${entry}`))
  }
  process.exit(1)
}

console.log('Canonical layout OK: apps/web is the only public frontend.')
