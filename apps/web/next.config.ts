import type { NextConfig } from 'next'

import { buildLegacyFallbackRewrites } from './lib/gateway'

const securityHeaders = [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(), payment=(), usb=()' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
]

const localNetworkHeaders = [
  { key: 'Permissions-Policy', value: 'local-network=(self), loopback-network=(self)' },
]

if (process.env.NODE_ENV === 'production') {
  securityHeaders.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000' })
}

const nextConfig: NextConfig = {
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
      fallback: [...buildLegacyFallbackRewrites(process.env.DND_LEGACY_ORIGIN)],
    }
  },
}

export default nextConfig
