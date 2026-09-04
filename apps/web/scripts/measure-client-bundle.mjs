import { readdir, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { join, relative } from 'node:path'

const staticRoot = fileURLToPath(new URL('../.next/static/', import.meta.url))

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(path))
    else if (/\.(?:js|css)$/i.test(entry.name)) files.push(path)
  }
  return files
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`
  return `${(value / 1024 / 1024).toFixed(2)} MiB`
}

let files
try {
  files = await filesUnder(staticRoot)
} catch (error) {
  console.error('Bundle estático não encontrado. Execute o build antes da medição.', error)
  process.exit(1)
}

const measurements = []
for (const file of files) {
  const info = await stat(file)
  const content = await readFile(file)
  measurements.push({
    file: relative(staticRoot, file),
    type: file.endsWith('.css') ? 'css' : 'js',
    rawBytes: info.size,
    gzipBytes: gzipSync(content).byteLength,
  })
}

const aggregate = (type) => measurements
  .filter((item) => item.type === type)
  .reduce((acc, item) => ({ rawBytes: acc.rawBytes + item.rawBytes, gzipBytes: acc.gzipBytes + item.gzipBytes }), { rawBytes: 0, gzipBytes: 0 })

const js = aggregate('js')
const css = aggregate('css')
const largest = [...measurements]
  .sort((a, b) => b.gzipBytes - a.gzipBytes)
  .slice(0, 8)

console.log('Inventário estático do client bundle')
console.log(`JS:  ${formatBytes(js.rawBytes)} raw / ${formatBytes(js.gzipBytes)} gzip em ${measurements.filter((item) => item.type === 'js').length} arquivo(s)`)
console.log(`CSS: ${formatBytes(css.rawBytes)} raw / ${formatBytes(css.gzipBytes)} gzip em ${measurements.filter((item) => item.type === 'css').length} arquivo(s)`)
console.log('Maiores arquivos por gzip:')
for (const item of largest) {
  console.log(`- ${item.file}: ${formatBytes(item.rawBytes)} raw / ${formatBytes(item.gzipBytes)} gzip`)
}

const budget = Number(process.env.DND_STATIC_CLIENT_GZIP_BUDGET_BYTES || 0)
const totalGzip = js.gzipBytes + css.gzipBytes
if (Number.isFinite(budget) && budget > 0 && totalGzip > budget) {
  console.error(`Budget excedido: ${formatBytes(totalGzip)} gzip > ${formatBytes(budget)}.`)
  process.exit(1)
}
