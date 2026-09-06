import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

type HeaderRule = Readonly<{
  source?: string
  headers?: Array<Readonly<{ key?: string; value?: string }>>
}>

const testDir = path.dirname(fileURLToPath(import.meta.url))
const rootVercelConfigPath = path.resolve(testDir, '../../../../vercel.json')

function permissionsPolicyForSource(source: string) {
  const config = JSON.parse(fs.readFileSync(rootVercelConfigPath, 'utf8')) as { headers?: HeaderRule[] }
  const rule = config.headers?.find((candidate) => candidate.source === source)
  return rule?.headers?.find((header) => header.key === 'Permissions-Policy')?.value || ''
}

describe('root gateway security configuration', () => {
  it('preserva a política base ao liberar rede local para Edit/Central Local', () => {
    const sources = [
      '/edit',
      '/edit/',
      '/edit/:path*',
      '/central-local',
      '/central-local/',
      '/central-local/:path*',
    ]

    for (const source of sources) {
      const policy = permissionsPolicyForSource(source)
      expect(policy, source).toContain('camera=()')
      expect(policy, source).toContain('geolocation=()')
      expect(policy, source).toContain('microphone=()')
      expect(policy, source).toContain('payment=()')
      expect(policy, source).toContain('usb=()')
      expect(policy, source).toContain('local-network=(self)')
      expect(policy, source).toContain('loopback-network=(self)')
    }
  })
})
