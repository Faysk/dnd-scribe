import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'

const origin = process.env.TDA_SMOKE_ORIGIN || 'http://127.0.0.1:3100'
const get = (path) => fetch(new URL(path, origin), { signal: AbortSignal.timeout(30_000) })
let live
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    live = await get('/api/live')
    if (live.ok) break
  } catch { /* The container may still be starting. */ }
  await setTimeout(1000)
}
assert.ok(live?.ok, 'Container did not become live')
assert.equal(live.status, 200)
assert.equal((await live.json()).surface, 'tda-web')
const health = await get('/api/web/health')
assert.equal(health.status, 200)
const status = await health.json()
assert.match(status.runtime.node, /^24\./)
assert.equal(status.readinessMode, 'configuration-only')
assert.equal(status.deployment.environment, 'production')
for (const route of ['/', '/sessoes', '/login', '/brand/tda-mark-black.svg']) {
  const response = await get(route)
  assert.equal(response.status, 200, route)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff', route)
  assert.ok((await response.text()).length > 100, route)
}
for (const route of ['/apple-icon', '/opengraph-image']) {
  const response = await get(route)
  assert.equal(response.status, 200, route)
  const bytes = Buffer.from(await response.arrayBuffer())
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', route)
  assert.ok(bytes.length > 1000, route)
}
const privateRoute = await get('/api/web/library/transcript?sourceSessionId=synthetic')
assert.ok([400, 401, 403].includes(privateRoute.status), 'Unauthenticated transcript must remain private')
console.log(`CONTAINER_SMOKE_OK node=${status.runtime.node}; public routes, branding, headers and private access checked`)
