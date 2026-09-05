export const CAMPAIGN_SLUG = 'yuhara-main'
export const THEME_STORAGE_KEY = 'dnd-scribe-theme'
export const PUBLIC_LEGACY_HOSTNAME = 'dnd.faysk.dev'

// Valores públicos e intencionalmente versionados como fallback de cutover.
// O alias legado não é o domínio móvel de produção e continua servindo somente
// como origem operacional enquanto a modernização convive com o backend antigo.
export const DEFAULT_LEGACY_ORIGIN = 'https://dnd-scribe-amber.vercel.app'
const DEFAULT_PUBLIC_SUPABASE_URL = 'https://dmrqnbdvbkfqzctcerbx.supabase.co'
const DEFAULT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_SsWmRNe0Erpdj1rmJ8wRMA_NMIUFJjS'

export type PublicSupabaseConfig = Readonly<{
  url: string
  publishableKey: string
}>

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]'
}

export function canRenderUnconfiguredPreview(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv !== 'production'
}

export function readPublicSupabaseConfig(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_PUBLIC_SUPABASE_URL,
  publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
): PublicSupabaseConfig | null {
  const key = String(publishableKey || '').trim()
  if (!url || !key || key.length > 4_096) return null

  try {
    const parsed = new URL(url)
    const secureOrigin = parsed.protocol === 'https:'
    const localDevelopmentOrigin = parsed.protocol === 'http:' && isLocalHostname(parsed.hostname)
    if (!secureOrigin && !localDevelopmentOrigin) return null
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') return null
    return { url: parsed.origin, publishableKey: key }
  } catch {
    return null
  }
}

export function parseLegacyOrigin(value: string | undefined) {
  if (!value) throw new Error('DND_LEGACY_ORIGIN não configurado.')

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('DND_LEGACY_ORIGIN inválido.')
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('DND_LEGACY_ORIGIN precisa usar HTTPS.')
  }
  if (parsed.hostname.toLowerCase() === PUBLIC_LEGACY_HOSTNAME) {
    throw new Error('DND_LEGACY_ORIGIN não pode usar o domínio público de produção.')
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('DND_LEGACY_ORIGIN deve conter somente a origem HTTPS.')
  }

  return parsed.origin
}

export function hasConfiguredLegacyOrigin(value = process.env.DND_LEGACY_ORIGIN) {
  try {
    parseLegacyOrigin(value)
    return true
  } catch {
    return false
  }
}

export function getLegacyOrigin() {
  return parseLegacyOrigin(process.env.DND_LEGACY_ORIGIN || DEFAULT_LEGACY_ORIGIN)
}

export function getLegacyEditUrl() {
  const raw = process.env.DND_LEGACY_EDIT_ORIGIN || process.env.DND_LEGACY_ORIGIN || DEFAULT_LEGACY_ORIGIN
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:') return null
    return new URL('/edit/', parsed.origin).toString()
  } catch {
    return null
  }
}
