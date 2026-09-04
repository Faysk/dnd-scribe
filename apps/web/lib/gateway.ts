export const MOVABLE_PUBLIC_HOSTNAME = 'dnd.faysk.dev'

export type LegacyRewrite = Readonly<{
  source: string
  destination: string
}>

export function parseLegacyGatewayOrigin(value: string | undefined): string | null {
  if (!value) return null

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return null
    if (parsed.hostname.toLowerCase() === MOVABLE_PUBLIC_HOSTNAME) return null
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') return null
    return parsed.origin
  } catch {
    return null
  }
}

export function buildLegacyFallbackRewrites(value: string | undefined): readonly LegacyRewrite[] {
  const origin = parseLegacyGatewayOrigin(value)
  if (!origin) return []

  return [
    { source: '/api/:path*', destination: `${origin}/api/:path*` },
    { source: '/edit', destination: `${origin}/edit` },
    { source: '/edit/:path*', destination: `${origin}/edit/:path*` },
    { source: '/central-local', destination: `${origin}/central-local` },
    { source: '/central-local/:path*', destination: `${origin}/central-local/:path*` },
    { source: '/terms', destination: `${origin}/terms` },
    { source: '/privacy', destination: `${origin}/privacy` },
    { source: '/linked-role', destination: `${origin}/linked-role` },
    { source: '/docs/api', destination: `${origin}/docs/api` },
    { source: '/docs/api/:path*', destination: `${origin}/docs/api/:path*` },
  ]
}
