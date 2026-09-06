import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const readJson = async (file) => JSON.parse(await readFile(new URL(file, root), 'utf8'))
const packages = await Promise.all(['package.json', 'apps/web/package.json'].map(readJson))
const dependencies = Object.assign({}, ...packages.flatMap(pkg => [pkg.dependencies, pkg.devDependencies]))
dependencies.pnpm = packages[0].packageManager.split('@').at(-1)
const currentNode = (await readFile(new URL('.node-version', root), 'utf8')).trim()
const fetchJson = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Version registry returned ${response.status}: ${url}`)
  return response.json()
}
const releases = await fetchJson('https://nodejs.org/dist/index.json')
const latestNode = releases.find(item => /^v\d+\.\d+\.\d+$/.test(item.version)).version.slice(1)
// Owner-approved exception: Vercel's free deployment supports Node 24.
// Still require the newest patch in that line, and report the upstream gap.
const latestSupportedNode = releases.find(item => /^v24\.\d+\.\d+$/.test(item.version)).version.slice(1)
const rows = [{ name: 'node', pinned: currentNode, latest: latestSupportedNode, upstream: latestNode }]
for (const [name, pinned] of Object.entries(dependencies).sort()) {
  const latest = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`)
  if (name === '@types/node') {
    const metadata = await fetchJson('https://registry.npmjs.org/@types%2fnode')
    const supported = Object.keys(metadata.versions).filter(version => /^24\.\d+\.\d+$/.test(version))
      .sort((a, b) => {
        const left = a.split('.').map(Number)
        const right = b.split('.').map(Number)
        return right[1] - left[1] || right[2] - left[2]
      })[0]
    rows.push({ name, pinned, latest: supported, upstream: latest.version })
  } else rows.push({ name, pinned, latest: latest.version })
}
for (const { name, pinned, latest, upstream } of rows) {
  console.log(`${name}: pinned=${pinned} latest=${latest} ${pinned === latest ? 'OK' : 'UPDATE_REQUIRED'}`)
  if (upstream && upstream !== latest) console.log(`  APPROVED_EXCEPTION: Node 24 hosting compatibility; upstream=${upstream}; docs/reboot/registros/node24-gratuito.md`)
}
console.log(`Verified at ${new Date().toISOString()}; web workspace only; no dependencies changed.`)
if (rows.some(row => row.pinned !== row.latest)) process.exitCode = 1
