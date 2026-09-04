import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const staticRoot = fileURLToPath(new URL('../.next/static/', import.meta.url))
const forbidden = [
  'DND_LEGACY_ORIGIN',
  'DND_LEGACY_EDIT_ORIGIN',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'service_role',
]

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(path))
    else if (/\.(?:js|css|map)$/i.test(entry.name)) files.push(path)
  }
  return files
}

let files
try {
  files = await filesUnder(staticRoot)
} catch (error) {
  console.error('Client bundle não encontrado. Execute o build antes da auditoria.', error)
  process.exit(1)
}

const findings = []
for (const file of files) {
  const content = await readFile(file, 'utf8')
  for (const marker of forbidden) {
    if (content.includes(marker)) findings.push({ file, marker })
  }
}

if (findings.length) {
  console.error('Marcadores server-only encontrados no client bundle:', findings)
  process.exit(1)
}

console.log(`Client bundle auditado: ${files.length} arquivos, 0 marcadores server-only.`)
