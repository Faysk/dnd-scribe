import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'

import { DEFAULT_LEGACY_ORIGIN } from './lib/config'
import { buildLegacyFallbackRewrites } from './lib/gateway'

const basePermissionsPolicy = 'camera=(), geolocation=(), microphone=(), payment=(), usb=()'
const localNetworkPermissionsPolicy = `${basePermissionsPolicy}, local-network=(self), loopback-network=(self)`

const securityHeaders = [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'Permissions-Policy', value: basePermissionsPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
]

const localNetworkHeaders = [
  { key: 'Permissions-Policy', value: localNetworkPermissionsPolicy },
]

if (process.env.NODE_ENV === 'production') {
  securityHeaders.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000' })
}

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'dmrqnbdvbkfqzctcerbx.supabase.co' },
      { protocol: 'https', hostname: 'dnd.faysk.dev' },
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/edit',
        headers: localNetworkHeaders,
      },
      {
        source: '/edit/:path*',
        headers: localNetworkHeaders,
      },
      {
        source: '/central-local',
        headers: localNetworkHeaders,
      },
      {
        source: '/central-local/:path*',
        headers: localNetworkHeaders,
      },
    ]
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      // Fallback roda somente depois das rotas locais do Next. Assim /api/web/*
      // e qualquer outro handler moderno continuam locais; o restante segue para
      // o projeto legado durante coexistência/cutover.
      fallback: [
        ...buildLegacyFallbackRewrites(process.env.DND_LEGACY_ORIGIN || DEFAULT_LEGACY_ORIGIN),
      ],
    }
  },
}

export default nextConfig
